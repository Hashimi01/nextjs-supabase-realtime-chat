import { useEffect, useRef, useState } from 'react'
import styles from '../styles/Chat.module.css'
import { uploadFile as uploadFileUtil } from '../utils/fileUpload'
import AudioPlayer from './AudioPlayer'
import { PaperclipIcon, MicIcon, StopIcon, CloseIcon, CheckIcon, WaveIcon } from './Icons'


const Chat = ({ currentUser, session, supabase }) => {
    if (!currentUser) return null
    const [messages, setMessages] = useState([])
    const [editingUsername, setEditingUsername] = useState(false)
    const [users, setUsers] = useState({})
    const [isConnected, setIsConnected] = useState(false)
    const [uploadingFile, setUploadingFile] = useState(false)
    const [selectedFile, setSelectedFile] = useState(null)
    const [isRecording, setIsRecording] = useState(false)
    const [audioBlob, setAudioBlob] = useState(null)
    const [audioUrl, setAudioUrl] = useState(null)
    const message = useRef(null)
    const newUsername = useRef(currentUser.username)
    const fileInputRef = useRef(null)
    const messagesEndRef = useRef(null)
    const messagesContainerRef = useRef(null)
    const channelsRef = useRef([])
    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])
    
    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        // Get initial messages and users
        const initializeChat = async () => {
            try {
                // Get messages with user info
                const { data: messagesData, error: messagesError } = await supabase
                .from('message')
                .select('*')
                    .order('created_at', { ascending: true })
                    .limit(100)
                
                if (messagesError) {
                    console.error('Error fetching messages:', messagesError)
                } else {
                    setMessages(messagesData || [])
                }

                // Get all users
                const { data: usersData, error: usersError } = await supabase
                    .from('user')
                    .select('id, username')
                
                if (!usersError && usersData) {
                    const usersMap = {}
                    usersData.forEach(user => {
                        usersMap[user.id] = user
                    })
                    setUsers(usersMap)
                }
            } catch (error) {
                console.error('Error initializing chat:', error)
            }
        }

        initializeChat()

        // Create a single optimized channel for all real-time updates
        // Use a unique channel name per user to avoid conflicts
        const chatChannel = supabase
            .channel(`chat-realtime-${session.user.id}`, {
                config: {
                    broadcast: { self: true },
                    presence: { key: session.user.id }
                }
            })
            // Listen for new messages - CRITICAL for instant delivery
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'message'
                },
                (payload) => {
                    console.log('📨 New message received:', payload.new)
                    // Add message immediately for instant display
                    setMessages(previous => {
                        if (!payload?.new?.id) return previous
                        // Avoid duplicates - check by ID
                        const exists = previous.some(msg => msg.id === payload.new.id)
                        if (exists) {
                            console.log('⚠️ Duplicate message detected, skipping')
                            return previous
                        }

                        // Remove matching optimistic message (same user & file)
                        const cleaned = previous.filter(msg => {
                            if (typeof msg?.id !== 'string') return true
                            if (!msg.id.startsWith('temp-')) return true
                            const sameUser = msg.user_id === payload.new.user_id
                            const sameFile = msg.file_url && msg.file_url === payload.new.file_url
                            const noFile = !msg.file_url && !payload.new.file_url && msg.content === payload.new.content
                            return !(sameUser && (sameFile || noFile))
                        })
                        
                        // Add immediately to the end for instant display
                        const newMessages = [...cleaned, payload.new]
                        console.log('✅ Message added, total messages:', newMessages.length)
                        return newMessages
                    })
                    // Scroll to bottom immediately
                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                    }, 50)
                }
            )
            // Also listen for broadcast messages (fallback)
            .on('broadcast', { event: 'new_message' }, (payload) => {
                console.log('📢 Broadcast message received:', payload)
            })
            // Listen for user updates
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'user'
                },
                (payload) => {
                    setUsers(users => ({
                        ...users,
                        [payload.new.id]: payload.new
                    }))
                }
            )
            // Listen for new users
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user'
                },
                (payload) => {
                    setUsers(users => ({
                        ...users,
                            [payload.new.id]: payload.new
                    }))
                }
            )
            // Handle connection status
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setIsConnected(true)
                    console.log('✅ Connected to real-time updates')
                } else if (status === 'CHANNEL_ERROR') {
                    setIsConnected(false)
                    console.error('❌ Real-time connection error')
                } else if (status === 'TIMED_OUT') {
                    setIsConnected(false)
                    console.warn('⏱️ Real-time connection timed out')
                } else if (status === 'CLOSED') {
                    setIsConnected(false)
                    console.log('🔌 Real-time connection closed')
                }
            })

        channelsRef.current = [chatChannel]

        // Cleanup subscriptions on unmount
        return () => {
            channelsRef.current.forEach(channel => {
                supabase.removeChannel(channel)
            })
            channelsRef.current = []
            setIsConnected(false)
        }
    }, [supabase, session.user.id])
    
    const uploadFile = async (file) => {
        if (!file) return null
        
        setUploadingFile(true)
        
        try {
            // Check file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('حجم الملف كبير جداً. الحد الأقصى 10 MB')
            }

            // Check if file has content
            if (!file.size || file.size === 0) {
                throw new Error('الملف فارغ')
            }

            const fileInfo = await uploadFileUtil(file, session.user.id, supabase)
            
            setUploadingFile(false)
            return fileInfo
        } catch (error) {
            console.error('Error uploading file:', error)
            setUploadingFile(false)
            const errorMsg = error.message || 'فشل رفع الملف. يرجى التحقق من الاتصال وإعدادات الرفع.'
            alert(`❌ ${errorMsg}`)
            return null
        }
    }

    const handleFileSelect = (e) => {
        const file = e.target.files[0]
        if (!file) return
        
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            alert('❌ حجم الملف كبير جداً. الحد الأقصى 10 MB')
            return
        }
        
        setSelectedFile(file)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                const url = URL.createObjectURL(audioBlob)
                setAudioBlob(audioBlob)
                setAudioUrl(url)
                stream.getTracks().forEach(track => track.stop())
            }

            mediaRecorder.start()
            setIsRecording(true)
        } catch (error) {
            console.error('Error starting recording:', error)
            alert('❌ لا يمكن الوصول إلى الميكروفون. يرجى التحقق من الصلاحيات.')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
    }

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl)
        }
        setAudioBlob(null)
        setAudioUrl(null)
        audioChunksRef.current = []
    }

    const sendMessageWithFile = async (content, fileInfo = null, existingTempId = null) => {
        if (!content && !fileInfo) return

        if (!isConnected) {
            alert('⚠️ غير متصل بالإنترنت. يرجى المحاولة مرة أخرى.')
            return
        }

        // Clear input
        if (message.current) message.current.value = ""

        let tempId = existingTempId
        if (tempId) {
            setMessages(previous =>
                previous.map(msg =>
                    msg.id === tempId ? { ...msg, uploading: true } : msg
                )
            )
        }

        if (!tempId) {
            tempId = `temp-${Date.now()}`
            const tempMessage = {
                id: tempId,
                content: content || '',
                user_id: session.user.id,
                file_url: fileInfo?.file_url || null,
                file_type: fileInfo?.file_type || null,
                file_name: fileInfo?.file_name || null,
                created_at: new Date().toISOString(),
                uploading: !!fileInfo
            }
            
            setMessages(previous => [...previous, tempMessage])
            scrollToBottom()
        }

        const messageData = {
            content: content || '',
            user_id: session.user.id
        }
        
        // Add file info if available
        if (fileInfo?.file_url) messageData.file_url = fileInfo.file_url
        if (fileInfo?.file_type) messageData.file_type = fileInfo.file_type
        if (fileInfo?.file_name) messageData.file_name = fileInfo.file_name

        const { data, error } = await supabase
            .from('message')
            .insert([messageData])
            .select()
            .single()
        
        if (error) {
            console.error('Error sending message:', error)
            setMessages(previous => previous.filter(msg => msg.id !== tempId))
            alert('❌ فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.')
            if (!existingTempId && message.current) message.current.value = content
            return null
        } else {
            setMessages(previous => 
                previous.map(msg => 
                    msg.id === tempId ? data : msg
                )
            )
            return data
        }
    }

    const sendMessage = async evt => {
        evt.preventDefault()
        if (!message.current) return
        const content = message.current.value.trim()
        let fileToSend = selectedFile
        let fileInfo = null

        // Handle audio file
        if (audioBlob && !selectedFile) {
            // Convert audio blob to file
            const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' })
            fileToSend = audioFile
        }

        if (!content && !fileToSend) return

        // Upload file if exists
        if (fileToSend) {
            const tempId = `temp-${Date.now()}`
            let previewUrl = null
            const isAudio = fileToSend.type?.startsWith('audio/') || fileToSend.type === 'audio/webm'
            if (audioUrl && isAudio) {
                previewUrl = audioUrl
            } else if (fileToSend.type?.startsWith('image/')) {
                previewUrl = URL.createObjectURL(fileToSend)
            }

            const optimisticMessage = {
                id: tempId,
                content: content || '',
                user_id: session.user.id,
                file_url: previewUrl || null,
                previewUrl: previewUrl || null,
                file_type: fileToSend.type || (isAudio ? 'audio/webm' : null),
                file_name: fileToSend.name || (isAudio ? `audio_${Date.now()}.webm` : null),
                created_at: new Date().toISOString(),
                uploading: true
            }

            setMessages(previous => [...previous, optimisticMessage])
            scrollToBottom()

            const originalFile = fileToSend
            const hadSelectedFile = !!selectedFile
            if (hadSelectedFile) {
                setSelectedFile(null)
            }

            setUploadingFile(true)
            fileInfo = await uploadFile(fileToSend)
            setUploadingFile(false)
            
            if (fileInfo) {
                const result = await sendMessageWithFile(content || '', fileInfo, tempId)
                if (result && previewUrl && previewUrl !== audioUrl) {
                    URL.revokeObjectURL(previewUrl)
                }

                setSelectedFile(null)
                if (audioUrl) {
                    URL.revokeObjectURL(audioUrl)
                }
                setAudioBlob(null)
                setAudioUrl(null)
                audioChunksRef.current = []
            } else {
                setMessages(previous => previous.filter(msg => msg.id !== tempId))
                if (hadSelectedFile && originalFile) {
                    setSelectedFile(originalFile)
                }
                if (previewUrl && previewUrl !== audioUrl) {
                    URL.revokeObjectURL(previewUrl)
                }
            }
        } else {
            await sendMessageWithFile(content)
        }
    }
    const logout = async evt =>{
        evt.preventDefault()
        await supabase.auth.signOut()
        window.location.reload()
    }
    const setUsername = async evt =>{
        evt.preventDefault()
        const username = newUsername.current.value
        const { error } = await supabase
            .from('user')
            .upsert({
                id: currentUser.id,
                ...currentUser,
                username
            }, { onConflict: 'id' })
        
        if (error) {
            console.error('Error updating username:', error)
        } else {
            newUsername.current.value = ""
        setEditingUsername(false)
        }
    }


    const username = user_id => {
        if (!user_id) return "مجهول"
        const user = users[user_id]
        if (!user) return session?.user?.email?.split('@')[0] || "مستخدم"
        return user.username || session?.user?.email?.split('@')[0] || "مستخدم"
    }

    const formatTime = (timestamp) => {
        if (!timestamp) return ''
        const date = new Date(timestamp)
        const hours = date.getHours()
        const minutes = date.getMinutes()
        const ampm = hours >= 12 ? 'م' : 'ص'
        const displayHours = hours % 12 || 12
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`
    }

    return ( 
    <>
        <div className={styles.header}>
            <div className={styles.headerText}>
                <h1>محادثة فورية</h1>
                <p className={styles.headerUser}>
                    مرحباً، {currentUser.username || session.user.email}
                    <span className={`${styles.connectionStatus} ${isConnected ? styles.connected : styles.disconnected}`}>
                        <span className={`${styles.statusDot} ${isConnected ? styles.statusDotOnline : styles.statusDotOffline}`} aria-hidden="true"></span>
                        {isConnected ? 'متصل' : 'غير متصل'}
                    </span>
                </p>
            </div>
            
            <div className={styles.settings}>
                {editingUsername ? (
                    <form onSubmit={setUsername}>
                        <input 
                            className={styles.updateUser} 
                            placeholder="اسم المستخدم الجديد" 
                            required 
                            ref={newUsername}
                            defaultValue={currentUser.username || ''}
                        />
                        <button className={styles.btnnn} type="submit">تحديث</button>
                        <button 
                            className={styles.btnnn} 
                            type="button"
                            onClick={() => setEditingUsername(false)}
                            style={{ marginLeft: '5px' }}
                        >
                            إلغاء
                        </button>
                    </form>
                ) : (
                    <div>
                        <button className={styles.btn} onClick={() => setEditingUsername(true)}>
                            تعديل الاسم
                        </button>
                        <button className={styles.btnn} onClick={evt => logout(evt)}>
                            تسجيل الخروج
                        </button>
                    </div>
                )}
            </div>
        </div>
        <div className={styles.container} ref={messagesContainerRef}>
            {messages.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>
                        <WaveIcon size={20} className={styles.emptyStateIcon} />
                        لا توجد رسائل بعد. كن أول من يرسل رسالة!
                    </p>
                </div>
            ) : (
                messages.map((msg, index) => {
                    const isOwnMessage = msg.user_id === session.user.id
                    const prevMessage = index > 0 ? messages[index - 1] : null
                    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null
                    const showTime = !nextMessage || nextMessage.user_id !== msg.user_id || 
                                    (new Date(nextMessage.created_at) - new Date(msg.created_at)) > 300000 // 5 minutes
                    
                    const fileUrl = msg.previewUrl || msg.file_url
                    const fileType = msg.file_type

                    return (
                        <div 
                            key={msg.id} 
                            className={`${styles.messageWrapper} ${isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper}`}
                        >
                            <div className={`${styles.messageBubble} ${isOwnMessage ? styles.ownMessage : styles.otherMessage} ${msg.uploading ? styles.uploadingBubble : ''}`}>
                                {fileUrl && (
                                    <div className={styles.messageFile}>
                                        {fileType?.startsWith('image/') ? (
                                            <img 
                                                src={fileUrl} 
                                                alt={msg.file_name || 'صورة'}
                                                className={styles.messageImage}
                                                onClick={() => !msg.uploading && window.open(msg.file_url, '_blank')}
                                            />
                                        ) : fileType?.startsWith('audio/') ? (
                                            msg.uploading && fileUrl?.startsWith('blob:')
                                                ? <audio controls src={fileUrl} className={styles.messageAudio} />
                                                : <AudioPlayer src={fileUrl} isOwn={msg.user_id === session.user.id} />
                                        ) : (
                                            <a 
                                                href={msg.uploading ? undefined : msg.file_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className={styles.messageFileLink}
                                                onClick={(e) => {
                                                    if (msg.uploading) {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                    }
                                                }}
                                            >
                                                <PaperclipIcon size={16} className={styles.messageFileLinkIcon} />
                                                {msg.file_name || 'ملف'}
                                            </a>
                                        )}
                                    </div>
                                )}
                                {msg.content && 
                                 !(msg.file_type?.startsWith('audio/') && (msg.content === '🎤 رسالة صوتية' || msg.content === '')) &&
                                 !(msg.file_url && !msg.file_type?.startsWith('audio/') && !msg.file_type?.startsWith('image/') && (msg.content === '📎 ملف' || msg.content === '')) ? (
                                    <div className={styles.messageText}>
                                        {msg.content}
                                    </div>
                                ) : null}
                                {msg.uploading && (
                                    <div className={styles.uploadingStatus}>
                                        <span className={styles.uploadingSpinner}></span>
                                        جاري الرفع...
                                    </div>
                                )}
                                {showTime && (
                                    <div className={styles.messageTime}>
                                        {formatTime(msg.created_at)}
                                        {isOwnMessage && <CheckIcon size={16} className={styles.messageTickIcon} />}
                </div>
            )}
                            </div>
                        </div>
                    )
                })
            )}
            <div ref={messagesEndRef} />
        </div>
    
        <form className={styles.chat} onSubmit={sendMessage}>
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept="*/*"
                style={{ display: 'none' }}
            />
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={styles.attachButton}
                disabled={uploadingFile || isRecording}
                aria-label="إرفاق ملف"
            >
                {uploadingFile ? <span className={styles.buttonSpinner} aria-hidden="true"></span> : <PaperclipIcon size={20} />}
            </button>
            {selectedFile && (
                <div className={styles.selectedFileChip}>
                    <PaperclipIcon size={16} />
                    <span>{selectedFile.name}</span>
                    <button 
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        aria-label="إلغاء الملف"
                    >
                        <CloseIcon size={14} />
                    </button>
                </div>
            )}
            {audioUrl && !selectedFile && (
                <div className={styles.selectedFileChip}>
                    <MicIcon size={16} />
                    <span>تسجيل صوتي</span>
                    <button 
                        type="button"
                        onClick={cancelRecording}
                        aria-label="إلغاء التسجيل"
                    >
                        <CloseIcon size={14} />
                    </button>
                </div>
            )}
            {!isRecording && !audioUrl && (
                <button
                    type="button"
                    onClick={startRecording}
                    className={styles.recordButton}
                    disabled={uploadingFile || selectedFile}
                    aria-label="تسجيل صوتي"
                >
                    <MicIcon size={20} />
                </button>
            )}
            {(isRecording || audioUrl) && (
                <button
                    type="button"
                    onClick={isRecording ? stopRecording : cancelRecording}
                    className={styles.stopRecordButton}
                    aria-label={isRecording ? "إيقاف التسجيل" : "إلغاء"}
                >
                    {isRecording ? <StopIcon size={18} /> : <CloseIcon size={16} />}
                </button>
            )}
            <input 
                className={styles.messageInput} 
                type="text" 
                placeholder={uploadingFile ? "جاري رفع الملف..." : isRecording ? "جاري التسجيل..." : "اكتب رسالتك هنا..."}
                ref={message}
                disabled={uploadingFile || isRecording}
            />
            <button className={styles.submit} type="submit" aria-label="إرسال" disabled={uploadingFile || isRecording}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.946 9.315c-.284-.1-.478-.415-.478-.796 0-.38.194-.695.478-.796l18.5-6.5c.297-.104.64-.005.82.248.18.252.17.59-.01.838L9.5 12l11.336 9.5c.18.248.19.586.01.838-.18.253-.523.352-.82.248l-18.5-6.5z" fill="currentColor"/>
                </svg>
            </button>
        </form>
    </>
    )
}
export default Chat

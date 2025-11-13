import { useEffect, useRef, useState } from 'react'
import styles from '../styles/Chat.module.css'
import { uploadFile as uploadFileUtil } from '../utils/fileUpload'
import AudioPlayer from './AudioPlayer'
import { PaperclipIcon, MicIcon, StopIcon, CloseIcon, CheckIcon, WaveIcon, SendIcon } from './Icons'


const Chat = ({ currentUser, session, supabase }) => {
    if (!currentUser) return null
    const [messages, setMessages] = useState([])
    const [editingUsername, setEditingUsername] = useState(false)
    const [users, setUsers] = useState({})
    const [isConnected, setIsConnected] = useState(false)
    const [uploadingFile, setUploadingFile] = useState(false)
    const [pendingFiles, setPendingFiles] = useState([])
    const [isRecording, setIsRecording] = useState(false)
    const message = useRef(null)
    const newUsername = useRef(currentUser.username)
    const fileInputRef = useRef(null)
    const messagesEndRef = useRef(null)
    const messagesContainerRef = useRef(null)
    const channelsRef = useRef([])
    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])
    const recordingCancelledRef = useRef(false)
    
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
        const files = Array.from(e.target.files || [])
        if (!files.length) return

        const newEntries = []

        files.forEach(file => {
            if (file.size > 10 * 1024 * 1024) {
                alert(`❌ الملف "${file.name}" يتجاوز الحد الأقصى 10 MB`)
                return
            }

            const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            let previewUrl = null
            if (file.type?.startsWith('image/') || file.type?.startsWith('audio/')) {
                try {
                    previewUrl = URL.createObjectURL(file)
                } catch (err) {
                    console.warn('Unable to create preview url', err)
                }
            }

            newEntries.push({
                id,
                file,
                name: file.name,
                type: file.type,
                previewUrl,
                caption: ''
            })
        })

        if (newEntries.length > 0) {
            setPendingFiles(prev => [...prev, ...newEntries])
        }

        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removePendingFile = (id) => {
        setPendingFiles(prev => {
            const target = prev.find(file => file.id === id)
            if (target?.previewUrl) {
                URL.revokeObjectURL(target.previewUrl)
            }
            return prev.filter(file => file.id !== id)
        })
    }

    const clearPendingFiles = () => {
        setPendingFiles(prev => {
            prev.forEach(file => {
                if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
            })
            return []
        })
    }

    const updatePendingFileCaption = (id, value) => {
        setPendingFiles(prev =>
            prev.map(file =>
                file.id === id ? { ...file, caption: value.slice(0, 200) } : file
            )
        )
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []
            recordingCancelledRef.current = false

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const cancelled = recordingCancelledRef.current
                recordingCancelledRef.current = false
                const chunks = [...audioChunksRef.current]
                audioChunksRef.current = []
                stream.getTracks().forEach(track => track.stop())

                if (cancelled || chunks.length === 0) {
                    return
                }

                const audioFile = new File(chunks, `audio_${Date.now()}.webm`, { type: 'audio/webm' })
                const audioPreview = URL.createObjectURL(audioFile)

                setPendingFiles(prev => [
                    ...prev,
                    {
                        id: `local-audio-${Date.now()}`,
                        file: audioFile,
                        name: audioFile.name,
                        type: audioFile.type,
                        previewUrl: audioPreview,
                        caption: ''
                    }
                ])
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
            recordingCancelledRef.current = true
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
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
        const pending = pendingFiles
        const hasAttachments = pending.length > 0

        if (!content && !hasAttachments) return

        const hadPendingAudio = pending.some(file => file.type?.startsWith('audio/'))

        if (!hasAttachments) {
            await sendMessageWithFile(content)
            if (message.current) message.current.value = ""
            return
        }

        setUploadingFile(true)

        try {
            for (const entry of pending) {
                const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                const previewUrl = entry.previewUrl || (entry.type?.startsWith('image/') ? URL.createObjectURL(entry.file) : null)

                const optimisticMessage = {
                    id: tempId,
                    content: entry.caption || '',
                    user_id: session.user.id,
                    file_url: previewUrl || null,
                    previewUrl: previewUrl || null,
                    file_type: entry.type || null,
                    file_name: entry.name || entry.file.name,
                    created_at: new Date().toISOString(),
                    uploading: true
                }

                setMessages(previous => [...previous, optimisticMessage])

                const fileInfo = await uploadFile(entry.file)

                if (fileInfo) {
                    const result = await sendMessageWithFile(entry.caption || '', fileInfo, tempId)
                    if (result && previewUrl && previewUrl !== result.file_url) {
                        URL.revokeObjectURL(previewUrl)
                    }
                } else {
                    setMessages(previous => previous.filter(msg => msg.id !== tempId))
                    alert(`❌ فشل رفع الملف "${entry.name}". يرجى المحاولة مرة أخرى.`)
                }
            }

            if (!hadPendingAudio && content) {
                await sendMessageWithFile(content)
            }

            if (message.current) message.current.value = ""
            clearPendingFiles()
        } finally {
            setUploadingFile(false)
            audioChunksRef.current = []
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

    const hasPendingFiles = pendingFiles.length > 0
    const hasPendingAudio = pendingFiles.some(file => file.type?.startsWith('audio/'))
    const hasPendingImages = pendingFiles.some(file => file.type?.startsWith('image/'))
    const showMessageInput = !hasPendingAudio
    const showAttachButton = !isRecording && !hasPendingAudio
    const showRecordButton = !isRecording && !hasPendingAudio && !hasPendingImages

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
    
        {hasPendingFiles && (
            <div className={styles.pendingAttachments}>
                <div className={styles.pendingAttachmentsList}>
                    {pendingFiles.map(file => (
                        <div
                            key={file.id}
                            className={`${styles.pendingAttachmentCard} ${file.type?.startsWith('image/') ? styles.pendingAttachmentImageCard : ''}`}
                        >
                            <button
                                type="button"
                                className={styles.pendingAttachmentRemove}
                                onClick={() => removePendingFile(file.id)}
                                aria-label="إزالة المرفق"
                            >
                                <CloseIcon size={14} />
                            </button>
                            {file.type?.startsWith('image/') ? (
                                <>
                                    <img
                                        src={file.previewUrl}
                                        alt={file.name}
                                        className={styles.pendingAttachmentImage}
                                    />
                                    <input
                                        type="text"
                                        className={styles.pendingCaptionInput}
                                        placeholder="أضف تعليقاً"
                                        value={file.caption}
                                        onChange={(e) => updatePendingFileCaption(file.id, e.target.value)}
                                    />
                                </>
                            ) : file.type?.startsWith('audio/') ? (
                                <audio controls src={file.previewUrl} className={styles.pendingAttachmentAudio} />
                            ) : (
                                <div className={styles.pendingAttachmentFile}>
                                    <PaperclipIcon size={20} />
                                    <span>{file.name}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {hasPendingAudio && (
                    <div className={styles.pendingNotice}>
                        سيتم إرسال التسجيل الصوتي فقط. أرسل أو احذف التسجيل لمتابعة الكتابة.
                    </div>
                )}
            </div>
        )}
        <form className={`${styles.chat} ${hasPendingAudio ? styles.chatAudioPending : ''}`} onSubmit={sendMessage}>
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept="*/*"
                multiple
                style={{ display: 'none' }}
            />
            {showAttachButton && (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={styles.attachButton}
                    disabled={uploadingFile}
                    aria-label="إرفاق ملف"
                >
                    {uploadingFile ? <span className={styles.buttonSpinner} aria-hidden="true"></span> : <PaperclipIcon size={20} />}
                </button>
            )}
            {showRecordButton && (
                <button
                    type="button"
                    onClick={startRecording}
                    className={styles.recordButton}
                    disabled={uploadingFile}
                    aria-label="تسجيل صوتي"
                >
                    <MicIcon size={20} />
                </button>
            )}
            {isRecording && (
                <>
                    <button
                        type="button"
                        onClick={stopRecording}
                        className={styles.stopRecordButton}
                        aria-label="إيقاف التسجيل"
                    >
                        <StopIcon size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={cancelRecording}
                        className={styles.cancelRecordButton}
                        aria-label="إلغاء التسجيل"
                    >
                        <CloseIcon size={16} />
                    </button>
                </>
            )}
            <input 
                className={styles.messageInput} 
                type="text" 
                placeholder={hasPendingFiles ? "أضف رسالة..." : isRecording ? "جاري التسجيل..." : "اكتب رسالتك هنا..."}
                ref={message}
                disabled={uploadingFile || isRecording || hasPendingAudio}
            />
            <button className={styles.submit} type="submit" aria-label="إرسال" disabled={uploadingFile || isRecording}>
                <SendIcon size={20} />
            </button>
        </form>
    </>
    )
}
export default Chat

import { useEffect, useMemo, useRef, useState } from 'react'
import styles from '../styles/Chat.module.css'
import dmStyles from '../styles/DirectMessages.module.css'
import { uploadFile as uploadFileUtil } from '../utils/fileUpload'
import AudioPlayer from './AudioPlayer'
import PendingAudioPreview from './PendingAudioPreview'
import { PaperclipIcon, MicIcon, StopIcon, CloseIcon, CheckIcon, SendIcon } from './Icons'

const DirectMessages = ({ currentUser, session, supabase }) => {
  if (!session?.user?.id) return null

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [threads, setThreads] = useState([])
  const [threadsWithLastMessage, setThreadsWithLastMessage] = useState([])
  const [currentThread, setCurrentThread] = useState(null)
  const [dmMessages, setDmMessages] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [usersMap, setUsersMap] = useState({})
  const [showSidebar, setShowSidebar] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [previewMedia, setPreviewMedia] = useState(null)

  const inputRef = useRef('')
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingCancelledRef = useRef(false)

  const myUserId = session.user.id

  const otherUserId = useMemo(() => {
    if (!currentThread) return null
    return currentThread.user_a === myUserId ? currentThread.user_b : currentThread.user_a
  }, [currentThread, myUserId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => { scrollToBottom() }, [dmMessages])

  // Load my threads with last message info
  useEffect(() => {
    const loadThreads = async () => {
      // Get threads
      const { data: threadsData, error: threadsError } = await supabase
        .from('direct_message_thread')
        .select('*')
        .or(`user_a.eq.${myUserId},user_b.eq.${myUserId}`)
      
      if (threadsError) {
        console.error('Error loading threads:', threadsError)
        return
      }

      if (!threadsData || threadsData.length === 0) {
        setThreads([])
        setThreadsWithLastMessage([])
        return
      }

      setThreads(threadsData)

      // Get last message for each thread
      const threadsWithLastMsg = await Promise.all(
        threadsData.map(async (thread) => {
          const { data: lastMsg } = await supabase
            .from('direct_message')
            .select('content, created_at, sender_id')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          const otherUserId = thread.user_a === myUserId ? thread.user_b : thread.user_a
          
          return {
            ...thread,
            lastMessage: lastMsg?.content || null,
            lastMessageTime: lastMsg?.created_at || thread.created_at,
            otherUserId
          }
        })
      )

      // Sort by last message time
      threadsWithLastMsg.sort((a, b) => 
        new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      )

      setThreadsWithLastMessage(threadsWithLastMsg)
    }

    loadThreads()

    // Refresh every 30 seconds
    const interval = setInterval(loadThreads, 30000)
    return () => clearInterval(interval)
  }, [supabase, myUserId])

  // Realtime new thread for me (so المستلم يرى المحادثة فوراً)
  useEffect(() => {
    const ch = supabase
      .channel(`dm-threads:${myUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_message_thread', filter: `user_a=eq.${myUserId}` }, (payload) => {
        setThreads(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_message_thread', filter: `user_b=eq.${myUserId}` }, (payload) => {
        setThreads(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, myUserId])

  // Search users by name or email
  useEffect(() => {
    const run = async () => {
      if (!query.trim()) { setSearchResults([]); return }
      
      // Search by username first, then by email if no results
      const { data: usernameData, error: usernameError } = await supabase
        .from('user')
        .select('id, username')
        .ilike('username', `%${query}%`)
        .limit(10)

      if (!usernameError && usernameData) {
        setSearchResults((usernameData || []).filter(u => u.id !== myUserId))
      } else {
        // Fallback: search auth.users by email (if we have access)
        // For now, just show username results
        setSearchResults([])
      }
    }
    const t = setTimeout(run, 250)
    return () => clearTimeout(t)
  }, [query, supabase, myUserId])

  // Open or create a thread with userId
  const openWithUser = async (partnerId) => {
    const { data: threadId, error } = await supabase.rpc('ensure_dm_thread', { partner_id: partnerId })
    if (error) return console.error('ensure_dm_thread error:', error)

    const { data: thread } = await supabase
      .from('direct_message_thread')
      .select('*')
      .eq('id', threadId)
      .single()
    clearPendingFiles()
    if (inputRef.current) inputRef.current.value = ''
    setCurrentThread(thread)
  }

  // Load missing users (to show names in list)
  useEffect(() => {
    const loadUsers = async () => {
      const ids = new Set()
      threadsWithLastMessage.forEach(t => ids.add(t.otherUserId))
      searchResults.forEach(u => ids.add(u.id))
      if (otherUserId) ids.add(otherUserId)
      
      const missing = Array.from(ids).filter(id => !usersMap[id] && id)
      if (missing.length === 0) return
      
      const { data } = await supabase
        .from('user')
        .select('id, username')
        .in('id', missing)
      
      if (data) {
        const map = {}
        data.forEach(u => { map[u.id] = u })
        setUsersMap(prev => ({ ...prev, ...map }))
      }
    }
    loadUsers()
  }, [threadsWithLastMessage, searchResults, otherUserId, myUserId, supabase])

  // Load messages + subscribe realtime for currentThread
  useEffect(() => {
    if (!currentThread?.id) return

    const load = async () => {
      const { data, error } = await supabase
        .from('direct_message')
        .select('*')
        .eq('thread_id', currentThread.id)
        .order('created_at', { ascending: true })
      if (!error) setDmMessages(data || [])
    }
    load()

    // realtime
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase
      .channel(`dm:${currentThread.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'direct_message', filter: `thread_id=eq.${currentThread.id}`
      }, (payload) => {
        if (!payload?.new?.id) return
        setDmMessages(prev => {
          const exists = prev.some(m => m.id === payload.new.id)
          if (exists) return prev
          const cleaned = prev.filter(m => {
            if (typeof m?.id !== 'string' || !m.id.startsWith('temp-')) return true
            const sameSender = m.sender_id === payload.new.sender_id
            const sameFile = m.file_url && m.file_url === payload.new.file_url
            const noFile = !m.file_url && !payload.new.file_url && m.content === payload.new.content
            return !(sameSender && (sameFile || noFile))
          })
          return [...cleaned, payload.new]
        })
      })
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'))

    channelRef.current = ch
    return () => { if (ch) supabase.removeChannel(ch) }
  }, [supabase, currentThread])

  const loadAudioDuration = (url) => new Promise((resolve) => {
    const audio = document.createElement('audio')
    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', handleLoaded)
      audio.removeEventListener('error', handleError)
      audio.remove()
    }
    const handleLoaded = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0
      cleanup()
      resolve(duration)
    }
    const handleError = () => {
      cleanup()
      resolve(0)
    }
    audio.addEventListener('loadedmetadata', handleLoaded, { once: true })
    audio.addEventListener('error', handleError, { once: true })
    audio.preload = 'metadata'
    audio.src = url
  })

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

      const fileInfo = await uploadFileUtil(file, myUserId, supabase)
      
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

    files.forEach((file, index) => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`❌ الملف "${file.name}" يتجاوز الحد الأقصى 10 MB`)
        return
      }

      const id = `local-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`
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
        caption: '',
        duration: 0
      })

      if (file.type?.startsWith('audio/')) {
        const targetId = id
        loadAudioDuration(previewUrl || file)
          .then(duration => {
            setPendingFiles(prev =>
              prev.map(item => item.id === targetId ? { ...item, duration } : item)
            )
          })
          .catch(() => {
            setPendingFiles(prev =>
              prev.map(item => item.id === targetId ? { ...item, duration: 0 } : item)
            )
          })
      }
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

        if (cancelled || chunks.length === 0) return

        const audioFile = new File(chunks, `audio_${Date.now()}.webm`, { type: 'audio/webm' })
        const audioPreview = URL.createObjectURL(audioFile)
        const audioId = `local-audio-${Date.now()}`

        setPendingFiles(prev => [
          ...prev,
          {
            id: audioId,
            file: audioFile,
            name: audioFile.name,
            type: audioFile.type,
            previewUrl: audioPreview,
            caption: '',
            duration: 0
          }
        ])

        loadAudioDuration(audioPreview)
          .then(duration => {
            setPendingFiles(prev =>
              prev.map(item => item.id === audioId ? { ...item, duration } : item)
            )
          })
          .catch(() => {
            setPendingFiles(prev =>
              prev.map(item => item.id === audioId ? { ...item, duration: 0 } : item)
            )
          })
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
    if (!currentThread?.id) return
    if (!content && !fileInfo) return

    if (inputRef.current) inputRef.current.value = ''

    let tempId = existingTempId
    if (tempId) {
      setDmMessages(prev =>
        prev.map(m =>
          m.id === tempId ? { ...m, uploading: true } : m
        )
      )
    }

    if (!tempId) {
      tempId = `temp-${Date.now()}`
      const temp = { 
        id: tempId, 
        content: content || '', 
        sender_id: myUserId, 
        thread_id: currentThread.id,
        file_url: fileInfo?.file_url || null,
        file_type: fileInfo?.file_type || null,
        file_name: fileInfo?.file_name || null,
        created_at: new Date().toISOString(),
        uploading: !!fileInfo 
      }
      setDmMessages(prev => [...prev, temp])
      scrollToBottom()
    }

    const messageData = {
      content: content || '',
      sender_id: myUserId,
      thread_id: currentThread.id
    }
    
    if (fileInfo) {
      messageData.file_url = fileInfo.file_url
      messageData.file_type = fileInfo.file_type
      messageData.file_name = fileInfo.file_name
    }

    const { data, error } = await supabase
      .from('direct_message')
      .insert([messageData])
      .select()
      .single()

    if (error) {
      setDmMessages(prev => prev.filter(m => m.id !== tempId))
      console.error('send dm error', error)
      alert('❌ فشل إرسال الرسالة الخاصة. حاول مرة أخرى.')
      return null
    }

    if (data) {
      setDmMessages(prev => prev.map(m => m.id === tempId ? data : m))
    }
    return data
  }

  const send = async (e) => {
    e.preventDefault()
    if (!currentThread?.id) return

    const content = inputRef.current.value.trim()
    const pending = pendingFiles
    const hasAttachments = pending.length > 0

    if (!content && !hasAttachments) return

    const hadPendingAudio = pending.some(file => file.type?.startsWith('audio/'))

    if (!hasAttachments) {
      await sendMessageWithFile(content)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setUploadingFile(true)

    try {
      for (const entry of pending) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const previewUrl = entry.previewUrl || (entry.type?.startsWith('image/') ? URL.createObjectURL(entry.file) : null)

        const optimistic = {
          id: tempId,
          content: entry.caption || '',
          sender_id: myUserId,
          thread_id: currentThread.id,
          file_url: previewUrl || null,
          previewUrl: previewUrl || null,
          file_type: entry.type || null,
          file_name: entry.name || entry.file.name,
          created_at: new Date().toISOString(),
          uploading: true
        }
        setDmMessages(prev => [...prev, optimistic])

        const fileInfo = await uploadFile(entry.file)

        if (fileInfo) {
          const result = await sendMessageWithFile(entry.caption || '', fileInfo, tempId)
          if (result && previewUrl && previewUrl !== result.file_url) {
            URL.revokeObjectURL(previewUrl)
          }
        } else {
          setDmMessages(prev => prev.filter(m => m.id !== tempId))
          alert(`❌ فشل رفع الملف "${entry.name}". يرجى المحاولة مرة أخرى.`)
        }
      }

      if (!hadPendingAudio && content) {
        await sendMessageWithFile(content)
      }

      if (inputRef.current) inputRef.current.value = ''
      clearPendingFiles()
    } finally {
      setUploadingFile(false)
      audioChunksRef.current = []
    }
  }

  const isOwn = (m) => m.sender_id === myUserId

  const getDisplayName = (userId) => {
    const user = usersMap[userId]
    if (!user) return userId?.substring(0, 8) || 'مستخدم'
    return user.username || userId?.substring(0, 8) || 'مستخدم'
  }

  const getAvatarLetter = (userId) => {
    const user = usersMap[userId]
    const name = user?.username || userId || 'U'
    return name[0].toUpperCase()
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

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'الآن'
    if (minutes < 60) return `منذ ${minutes} دقيقة`
    if (minutes < 1440) return `منذ ${Math.floor(minutes / 60)} ساعة`
    return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })
  }

  const hasPendingFiles = pendingFiles.length > 0
  const hasPendingAudio = pendingFiles.some(file => file.type?.startsWith('audio/'))
  const hasPendingImages = pendingFiles.some(file => file.type?.startsWith('image/'))
  const showAttachButton = !isRecording && !hasPendingAudio
  const showRecordButton = !isRecording && !hasPendingAudio && !hasPendingImages

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setPreviewMedia(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div className={dmStyles.dmContainer}>
      {/* Sidebar */}
      <div className={dmStyles.sidebar} style={{ display: showSidebar ? 'flex' : 'none' }}>
        <div className={dmStyles.sidebarHeader}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: 20, color: '#111b21' }}>المحادثات</h2>
          <div style={{ position: 'relative' }}>
            <input
              className={dmStyles.searchBox}
              type="text"
              placeholder="ابحث عن مستخدم..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && searchResults.length > 0 && (
              <div className={dmStyles.searchResults}>
                {searchResults.map(u => (
                  <div
                    key={u.id}
                    className={dmStyles.searchResultItem}
                    onClick={() => {
                      openWithUser(u.id)
                      setQuery('')
                    }}
                  >
                    <div className={dmStyles.searchResultAvatar}>
                      {getAvatarLetter(u.id)}
                    </div>
                    <div>
                      <p className={dmStyles.searchResultName}>
                        {getDisplayName(u.id)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={dmStyles.threadsList}>
          {threadsWithLastMessage.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#667781' }}>
              لا توجد محادثات. ابحث عن مستخدم لبدء محادثة جديدة
            </div>
          ) : (
            threadsWithLastMessage.map(thread => {
              const otherUser = usersMap[thread.otherUserId]
              const isSelected = currentThread?.id === thread.id
              
              return (
                <div
                  key={thread.id}
                  className={`${dmStyles.threadItem} ${isSelected ? dmStyles.active : ''}`}
                  onClick={() => {
                    setCurrentThread(thread)
                    setShowSidebar(false)
                  }}
                >
                  <div className={dmStyles.avatar}>
                    {getAvatarLetter(thread.otherUserId)}
                  </div>
                  <div className={dmStyles.threadInfo}>
                    <p className={dmStyles.threadName}>
                      {getDisplayName(thread.otherUserId)}
                    </p>
                    {thread.lastMessage && (
                      <p className={dmStyles.lastMessage}>
                        {thread.lastMessage}
                      </p>
                    )}
                    <p className={dmStyles.lastMessageTime}>
                      {formatRelativeTime(thread.lastMessageTime)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={dmStyles.chatArea} style={{ display: currentThread ? 'flex' : 'none' }}>
        {currentThread && (
          <>
            <div className={dmStyles.chatHeader}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  onClick={() => setShowSidebar(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: 20,
                    cursor: 'pointer',
                    marginLeft: 12,
                    padding: '4px 8px'
                  }}
                >
                  ☰
                </button>
                <div className={dmStyles.chatHeaderInfo}>
                  <div>
                    <h3 className={dmStyles.chatHeaderName}>
                      {getDisplayName(otherUserId)}
                    </h3>
                    <p className={dmStyles.chatHeaderStatus}>
                      <span className={`${styles.connectionStatus} ${isConnected ? styles.connected : styles.disconnected}`}>
                        <span className={`${styles.statusDot} ${isConnected ? styles.statusDotOnline : styles.statusDotOffline}`} aria-hidden="true"></span>
                        {isConnected ? 'متصل' : 'غير متصل'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.container} style={{ padding: '8px 0 80px 0', flex: 1 }}>
              {dmMessages.map((m, i) => {
                const prevMessage = i > 0 ? dmMessages[i - 1] : null
                const nextMessage = i < dmMessages.length - 1 ? dmMessages[i + 1] : null
                const showTime = !nextMessage || nextMessage.sender_id !== m.sender_id || 
                                (new Date(nextMessage.created_at) - new Date(m.created_at)) > 300000
                const fileUrl = m.previewUrl || m.file_url
                const fileType = m.file_type

                return (
                  <div key={m.id} className={`${styles.messageWrapper} ${isOwn(m) ? styles.ownMessageWrapper : styles.otherMessageWrapper}`}>
                    <div className={`${styles.messageBubble} ${isOwn(m) ? styles.ownMessage : styles.otherMessage} ${m.uploading ? styles.uploadingBubble : ''}`}>
                      {fileUrl && (
                        <div className={styles.messageFile}>
                          {fileType?.startsWith('image/') ? (
                            <button
                              type="button"
                              className={styles.messageImageButton}
                              onClick={() => !m.uploading && setPreviewMedia({ url: fileUrl, name: m.file_name || 'صورة' })}
                              disabled={m.uploading}
                            >
                              <img 
                                src={fileUrl} 
                                alt={m.file_name || 'صورة'}
                                className={styles.messageImage}
                              />
                            </button>
                          ) : fileType?.startsWith('audio/') ? (
                            m.uploading && fileUrl?.startsWith('blob:')
                              ? <audio controls src={fileUrl} className={styles.messageAudio} />
                              : <AudioPlayer src={fileUrl} isOwn={isOwn(m)} />
                          ) : (
                            <a 
                              href={m.uploading ? undefined : m.file_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={styles.messageFileLink}
                              onClick={(e) => {
                                if (m.uploading) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }
                              }}
                            >
                              <PaperclipIcon size={16} className={styles.messageFileLinkIcon} />
                              {m.file_name || 'ملف'}
                            </a>
                          )}
                        </div>
                      )}
                      {m.content && 
                       !(m.file_type?.startsWith('audio/') && (m.content === '🎤 رسالة صوتية' || m.content === '')) &&
                       !(m.file_url && !m.file_type?.startsWith('audio/') && !m.file_type?.startsWith('image/') && (m.content === '📎 ملف' || m.content === '')) ? (
                        <div className={styles.messageText}>{m.content}</div>
                      ) : null}
                      {m.uploading && (
                        <div className={styles.uploadingStatus}>
                          <span className={styles.uploadingSpinner}></span>
                          جاري الرفع...
                        </div>
                      )}
                      {showTime && (
                        <div className={styles.messageTime}>
                          {formatTime(m.created_at)}
                          {isOwn(m) && <CheckIcon size={16} className={styles.messageTickIcon} />}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {hasPendingFiles && (
              <div className={styles.pendingAttachments}>
                <div className={styles.pendingAttachmentsList}>
                  {pendingFiles.map(file => (
                    file.type?.startsWith('audio/') ? (
                      <PendingAudioPreview
                        key={file.id}
                        file={file}
                        onRemove={() => removePendingFile(file.id)}
                      />
                    ) : (
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
                            <button
                              type="button"
                              className={styles.pendingAttachmentImageButton}
                              onClick={() => setPreviewMedia({ url: file.previewUrl, name: file.name })}
                            >
                              <img
                                src={file.previewUrl}
                                alt={file.name}
                                className={styles.pendingAttachmentImage}
                              />
                            </button>
                            <input
                              type="text"
                              className={styles.pendingCaptionInput}
                              placeholder="أضف تعليقاً"
                              value={file.caption}
                              onChange={(e) => updatePendingFileCaption(file.id, e.target.value)}
                            />
                          </>
                        ) : (
                          <div className={styles.pendingAttachmentFile}>
                            <PaperclipIcon size={20} />
                            <span>{file.name}</span>
                          </div>
                        )}
                      </div>
                    )
                  ))}
                </div>
                {hasPendingAudio && (
                  <div className={styles.pendingNotice}>
                    سيتم إرسال التسجيل الصوتي فقط. أرسل أو احذف التسجيل لمتابعة الكتابة.
                  </div>
                )}
              </div>
            )}
            <form className={`${styles.chat} ${hasPendingAudio ? styles.chatAudioPending : ''}`} onSubmit={send}>
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
                ref={inputRef}
                className={styles.messageInput}
                type="text"
                placeholder={hasPendingFiles ? "أضف رسالة..." : isRecording ? "جاري التسجيل..." : "اكتب رسالتك هنا..."}
                disabled={uploadingFile || isRecording || hasPendingAudio}
              />
              <button className={styles.submit} type="submit" aria-label="إرسال" disabled={uploadingFile || isRecording}>
                <SendIcon size={20} />
              </button>
            </form>
            {previewMedia && (
              <div className={styles.mediaPreviewOverlay} onClick={() => setPreviewMedia(null)}>
                <div className={styles.mediaPreviewContainer} onClick={(e) => e.stopPropagation()}>
                  <button
                    className={styles.mediaPreviewClose}
                    type="button"
                    onClick={() => setPreviewMedia(null)}
                    aria-label="إغلاق المعاينة"
                  >
                    <CloseIcon size={18} />
                  </button>
                  <img src={previewMedia.url} alt={previewMedia.name || 'صورة'} className={styles.mediaPreviewImage} />
                  {previewMedia.name && (
                    <div className={styles.mediaPreviewCaption}>{previewMedia.name}</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {!currentThread && (
          <div className={dmStyles.emptyChat}>
            اختر محادثة من القائمة للبدء
          </div>
        )}
      </div>
    </div>
  )
}

export default DirectMessages



import { useEffect, useRef, useState } from 'react'
import styles from '../styles/Chat.module.css'


const Chat = ({ currentUser, session, supabase }) => {
    if (!currentUser) return null
    const [messages, setMessages] = useState([])
    const [editingUsername, setEditingUsername] = useState(false)
    const [users, setUsers] = useState({})
    const [isConnected, setIsConnected] = useState(false)
    const message = useRef("")
    const newUsername = useRef(currentUser.username)
    const messagesEndRef = useRef(null)
    const messagesContainerRef = useRef(null)
    const channelsRef = useRef([])
    
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
                        // Avoid duplicates - check by ID
                        const exists = previous.some(msg => msg.id === payload.new.id)
                        if (exists) {
                            console.log('⚠️ Duplicate message detected, skipping')
                            return previous
                        }
                        
                        // Add immediately to the end for instant display
                        const newMessages = [...previous, payload.new]
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
    
    const sendMessage = async evt => {
        evt.preventDefault()

        const content = message.current.value.trim()
        if (!content) return

        if (!isConnected) {
            alert('⚠️ غير متصل بالإنترنت. يرجى المحاولة مرة أخرى.')
            return
        }

        // Clear input immediately for better UX
        message.current.value = ""

        // Optimistic update - show message immediately
        const tempMessage = {
            id: `temp-${Date.now()}`,
            content,
            user_id: session.user.id,
            created_at: new Date().toISOString()
        }
        
        setMessages(previous => [...previous, tempMessage])
        scrollToBottom()

        const { data, error } = await supabase
            .from('message')
            .insert([
                { content, user_id: session.user.id }
            ])
            .select()
            .single()
        
        if (error) {
            console.error('Error sending message:', error)
            // Remove temp message on error
            setMessages(previous => previous.filter(msg => msg.id !== tempMessage.id))
            alert('❌ فشل إرسال الرسالة. يرجى المحاولة مرة أخرى.')
            message.current.value = content // Restore message
        } else {
            // Replace temp message with real one
            setMessages(previous => 
                previous.map(msg => 
                    msg.id === tempMessage.id ? data : msg
                )
            )
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
                        {isConnected ? '🟢 متصل' : '🔴 غير متصل'}
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
                    <p>لا توجد رسائل بعد. كن أول من يرسل رسالة! 👋</p>
                </div>
            ) : (
                messages.map((msg, index) => {
                    const isOwnMessage = msg.user_id === session.user.id
                    const prevMessage = index > 0 ? messages[index - 1] : null
                    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null
                    const showTime = !nextMessage || nextMessage.user_id !== msg.user_id || 
                                    (new Date(nextMessage.created_at) - new Date(msg.created_at)) > 300000 // 5 minutes
                    
                    return (
                        <div 
                            key={msg.id} 
                            className={`${styles.messageWrapper} ${isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper}`}
                        >
                            <div className={`${styles.messageBubble} ${isOwnMessage ? styles.ownMessage : styles.otherMessage}`}>
                                <div className={styles.messageText}>
                                    {msg.content}
                                </div>
                                {showTime && (
                                    <div className={styles.messageTime}>
                                        {formatTime(msg.created_at)}
                                        {isOwnMessage && <span className={styles.messageTick}>✓</span>}
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
                className={styles.messageInput} 
                required 
                type="text" 
                placeholder="اكتب رسالتك هنا..." 
                ref={message}
            />
            <button className={styles.submit} type="submit" aria-label="إرسال">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.946 9.315c-.284-.1-.478-.415-.478-.796 0-.38.194-.695.478-.796l18.5-6.5c.297-.104.64-.005.82.248.18.252.17.59-.01.838L9.5 12l11.336 9.5c.18.248.19.586.01.838-.18.253-.523.352-.82.248l-18.5-6.5z" fill="currentColor"/>
                </svg>
            </button>
        </form>
    </>
    )
}
export default Chat

import { useEffect, useMemo, useRef, useState } from 'react'
import styles from '../styles/Chat.module.css'
import dmStyles from '../styles/DirectMessages.module.css'

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

  const inputRef = useRef('')
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)

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
        setDmMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'))

    channelRef.current = ch
    return () => { if (ch) supabase.removeChannel(ch) }
  }, [supabase, currentThread])

  const send = async (e) => {
    e.preventDefault()
    if (!currentThread?.id) return
    const content = inputRef.current.value.trim()
    if (!content) return
    inputRef.current.value = ''

    const temp = { id: `temp-${Date.now()}`, content, sender_id: myUserId, thread_id: currentThread.id, created_at: new Date().toISOString() }
    setDmMessages(prev => [...prev, temp])

    const { data, error } = await supabase
      .from('direct_message')
      .insert([{ content, sender_id: myUserId, thread_id: currentThread.id }])
      .select()
      .single()
    if (!error && data) {
      setDmMessages(prev => prev.map(m => m.id === temp.id ? data : m))
    } else {
      setDmMessages(prev => prev.filter(m => m.id !== temp.id))
      console.error('send dm error', error)
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
                        {isConnected ? '🟢 متصل' : '🔴 غير متصل'}
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
                
                return (
                  <div key={m.id} className={`${styles.messageWrapper} ${isOwn(m) ? styles.ownMessageWrapper : styles.otherMessageWrapper}`}>
                    <div className={`${styles.messageBubble} ${isOwn(m) ? styles.ownMessage : styles.otherMessage}`}>
                      <div className={styles.messageText}>{m.content}</div>
                      {showTime && (
                        <div className={styles.messageTime}>
                          {formatTime(m.created_at)}
                          {isOwn(m) && <span className={styles.messageTick}>✓</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <form className={styles.chat} onSubmit={send}>
              <input
                ref={inputRef}
                className={styles.messageInput}
                required
                type="text"
                placeholder="اكتب رسالتك هنا..."
              />
              <button className={styles.submit} type="submit" aria-label="إرسال">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.946 9.315c-.284-.1-.478-.415-.478-.796 0-.38.194-.695.478-.796l18.5-6.5c.297-.104.64-.005.82.248.18.252.17.59-.01.838L9.5 12l11.336 9.5c.18.248.19.586.01.838-.18.253-.523.352-.82.248l-18.5-6.5z" fill="currentColor"/>
                </svg>
              </button>
            </form>
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



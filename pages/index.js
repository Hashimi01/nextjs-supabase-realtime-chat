import Head from 'next/head'
import { motion, AnimatePresence } from 'framer-motion'
import styles from '../styles/Home.module.css'
import sidebarStyles from '../styles/Sidebar.module.css'
import Auth from '../components/Auth'
import Chat from '../components/Chat'
import DirectMessages from '../components/DirectMessages'
import Profile from '../components/Profile'
import useTranslation from '../utils/useTranslation'
import { useEffect, useRef, useState } from 'react'

const tabTransition = {
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1],
}

export default function Home({ currentUser, session, supabase }) {
  const { t, locale, toggleLanguage } = useTranslation()
  const [loggedIn, setLoggedIn] = useState(false)
  const [tab, setTab] = useState('public')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDesktop, setIsDesktop] = useState(true)

  const directMessagesRef = useRef(null)

  useEffect(() => {
    setLoggedIn(!!session)

    const checkDesktop = () => {
      setIsDesktop(window.innerWidth > 768)
    }
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [session])

  const handleOpenDirectMessages = (userId) => {
    setTab('private')
    setTimeout(() => {
      directMessagesRef.current?.openThreadWith(userId)
    }, 0)
  }

  const getAvatarLetter = () => {
    const name = currentUser?.username || session?.user?.email || 'U'
    return name[0].toUpperCase()
  }

  const mainMargin =
    loggedIn && isDesktop && sidebarOpen ? 'var(--sidebar-w)' : '0'

  return (
    <div className={styles.container}>
      <Head>
        <title>Realtime Chat Workspace</title>
        <meta
          name="description"
          content="Private realtime chat workspace with public rooms, direct messages, and Supabase authentication."
        />
      </Head>

      <main
        className={styles.main}
        style={{
          marginInlineEnd: mainMargin,
        }}
      >
        <AnimatePresence mode="wait">
          {!loggedIn ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={tabTransition}
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Auth supabase={supabase} />
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={tabTransition}
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {tab === 'profile' ? (
                <Profile
                  currentUser={currentUser}
                  session={session}
                  supabase={supabase}
                  onBack={() => setTab('public')}
                />
              ) : tab === 'public' ? (
                <Chat
                  currentUser={currentUser}
                  session={session}
                  supabase={supabase}
                  onOpenDirectMessages={handleOpenDirectMessages}
                />
              ) : (
                <DirectMessages
                  ref={directMessagesRef}
                  currentUser={currentUser}
                  session={session}
                  supabase={supabase}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {loggedIn && (
        <>
          <div
            className={`${sidebarStyles.sidebarOverlay} ${sidebarOpen ? sidebarStyles.open : ''}`}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />

          <div
            className={`${sidebarStyles.sidebar} ${sidebarOpen ? sidebarStyles.open : ''} ${!sidebarOpen && isDesktop ? sidebarStyles.closed : ''}`}
          >
            <div className={sidebarStyles.sidebarHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>{t.navigation}</h2>
                <button 
                  onClick={toggleLanguage}
                  className={sidebarStyles.langToggle}
                  title={t.language}
                >
                  {locale === 'ar' ? 'EN' : 'AR'}
                </button>
              </div>
              <p>{t.workspaceSub}</p>
            </div>

            <div className={sidebarStyles.navItems}>
              <div
                className={`${sidebarStyles.navItem} ${tab === 'public' ? sidebarStyles.active : ''}`}
                onClick={() => {
                  setTab('public')
                  setSidebarOpen(false)
                }}
              >
                <div className={sidebarStyles.navItemIcon}>💬</div>
                <div className={sidebarStyles.navItemText}>{t.publicChat}</div>
              </div>

              <div
                className={`${sidebarStyles.navItem} ${tab === 'private' ? sidebarStyles.active : ''}`}
                onClick={() => {
                  setTab('private')
                  setSidebarOpen(false)
                }}
              >
                <div className={sidebarStyles.navItemIcon}>✉️</div>
                <div className={sidebarStyles.navItemText}>{t.privateMessages}</div>
              </div>

              <div
                className={`${sidebarStyles.navItem} ${tab === 'profile' ? sidebarStyles.active : ''}`}
                onClick={() => {
                  setTab('profile')
                  setSidebarOpen(false)
                }}
              >
                <div className={sidebarStyles.navItemIcon}>👤</div>
                <div className={sidebarStyles.navItemText}>{t.profile}</div>
              </div>
            </div>

            <div className={sidebarStyles.userInfo}>
              <div className={sidebarStyles.userAvatar}>{getAvatarLetter()}</div>
              <div className={sidebarStyles.userName}>
                {currentUser?.username || t.unnamed}
              </div>
              <div className={sidebarStyles.userEmail}>{session?.user?.email}</div>
            </div>
          </div>

          <motion.button
            type="button"
            className={sidebarStyles.sidebarToggle}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            whileTap={{ scale: 0.94 }}
            aria-label={sidebarOpen ? t.closeMenu : t.openMenu}
          >
            {sidebarOpen ? '✕' : '☰'}
          </motion.button>
        </>
      )}
    </div>
  )
}

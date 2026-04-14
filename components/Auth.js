import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from '../styles/Auth.module.css'
import useTranslation from '../utils/useTranslation'

const Auth = ({ supabase }) => {
  const { t } = useTranslation()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      if (isSignUp) {
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL ||
          (typeof window !== 'undefined' ? window.location.origin : undefined)

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: siteUrl ? { emailRedirectTo: siteUrl } : undefined,
        })

        if (error) throw error

        setMessage({
          type: 'success',
          text: 'Account created successfully! Please verify your email.',
        })
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        setMessage({
          type: 'success',
          text: 'Logged in successfully!',
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'An error occurred. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.authCard}
        initial={{ opacity: 0, y: 30, scale: 0.95, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className={styles.title}>
          {isSignUp ? t.register : t.login}
        </h2>
        <p className={styles.subtitle}>{t.authSub}</p>

        <form onSubmit={handleAuth} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              {t.emailPlaceholder}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="example@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              {t.passwordPlaceholder}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <AnimatePresence>
            {message.text && (
              <motion.div
                className={`${styles.message} ${styles[message.type]}`}
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
          >
            {loading
              ? isSignUp ? t.registering : t.loggingIn
              : isSignUp
                ? t.register
                : t.login}
          </motion.button>
        </form>

        <div className={styles.switch}>
          <span>
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setMessage({ type: '', text: '' })
            }}
            className={styles.switchButton}
            disabled={loading}
          >
            {isSignUp ? t.login : t.register}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default Auth

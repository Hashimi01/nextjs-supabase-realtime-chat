import { useState } from 'react'
import { motion } from 'framer-motion'
import styles from '../styles/Auth.module.css'

const Auth = ({ supabase }) => {
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
          text: 'تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني.',
        })
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        setMessage({
          type: 'success',
          text: 'تم تسجيل الدخول بنجاح!',
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'حدث خطأ. يرجى المحاولة مرة أخرى.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.authCard}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className={styles.title}>
          {isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
        </h2>

        <form onSubmit={handleAuth} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              البريد الإلكتروني
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
              كلمة المرور
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

          {message.text && (
            <motion.div
              className={`${styles.message} ${styles[message.type]}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.22 }}
            >
              {message.text}
            </motion.div>
          )}

          <motion.button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
          >
            {loading
              ? 'جاري المعالجة...'
              : isSignUp
                ? 'إنشاء حساب'
                : 'تسجيل الدخول'}
          </motion.button>
        </form>

        <div className={styles.switch}>
          <span>
            {isSignUp ? 'لديك حساب بالفعل؟ ' : 'ليس لديك حساب؟ '}
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
            {isSignUp ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default Auth

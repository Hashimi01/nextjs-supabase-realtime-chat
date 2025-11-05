import { useState } from 'react'
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
                // تسجيل حساب جديد
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                })

                if (error) throw error

                setMessage({
                    type: 'success',
                    text: 'تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني.'
                })
            } else {
                // تسجيل الدخول
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })

                if (error) throw error

                // سيتم التوجيه تلقائياً بعد تسجيل الدخول
                setMessage({
                    type: 'success',
                    text: 'تم تسجيل الدخول بنجاح!'
                })
            }
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.message || 'حدث خطأ. يرجى المحاولة مرة أخرى.'
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.authCard}>
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
                        <div className={`${styles.message} ${styles[message.type]}`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={loading}
                    >
                        {loading
                            ? 'جاري المعالجة...'
                            : isSignUp
                            ? 'إنشاء حساب'
                            : 'تسجيل الدخول'}
                    </button>
                </form>

                <div className={styles.switch}>
                    <span>
                        {isSignUp
                            ? 'لديك حساب بالفعل؟ '
                            : 'ليس لديك حساب؟ '}
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
            </div>
        </div>
    )
}

export default Auth
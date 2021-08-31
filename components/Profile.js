import { useState } from 'react'
import { motion } from 'framer-motion'
import styles from '../styles/Profile.module.css'

const Profile = ({ currentUser, session, supabase, onBack }) => {
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState(currentUser?.username || '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const updateUsername = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const { error } = await supabase.from('user').upsert(
        {
          id: currentUser.id,
          ...currentUser,
          username: newUsername.trim(),
        },
        { onConflict: 'id' }
      )

      if (error) throw error

      setMessage({ type: 'success', text: 'تم تحديث الاسم بنجاح!' })
      setEditingUsername(false)
      window.location.reload()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'حدث خطأ أثناء التحديث',
      })
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.headerRow}>
          <motion.button
            type="button"
            className={styles.back}
            onClick={onBack}
            whileTap={{ scale: 0.95 }}
            aria-label="رجوع"
          >
            ←
          </motion.button>
          <h1 className={styles.title}>الملف الشخصي</h1>
        </div>

        <div className={styles.avatar}>
          {(currentUser?.username || session?.user?.email || 'U')[0].toUpperCase()}
        </div>

        <div className={styles.identity}>
          <h2 className={styles.name}>
            {currentUser?.username || 'بدون اسم'}
          </h2>
          <p className={styles.email}>{session?.user?.email}</p>
        </div>

        {message.text && (
          <motion.div
            className={`${styles.banner} ${message.type === 'success' ? styles.bannerSuccess : styles.bannerError}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {message.text}
          </motion.div>
        )}

        {editingUsername ? (
          <form onSubmit={updateUsername}>
            <label className={styles.fieldLabel} htmlFor="username">
              اسم المستخدم
            </label>
            <input
              id="username"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className={styles.fieldInput}
              placeholder="أدخل اسم المستخدم"
              required
            />
            <div className={styles.actions}>
              <motion.button
                type="submit"
                className={styles.btnPrimary}
                disabled={loading}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                {loading ? 'جاري الحفظ...' : 'حفظ'}
              </motion.button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => {
                  setEditingUsername(false)
                  setNewUsername(currentUser?.username || '')
                  setMessage({ type: '', text: '' })
                }}
              >
                إلغاء
              </button>
            </div>
          </form>
        ) : (
          <motion.button
            type="button"
            className={styles.btnBlock}
            onClick={() => setEditingUsername(true)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            تعديل اسم المستخدم
          </motion.button>
        )}

        <div className={styles.divider}>
          <motion.button
            type="button"
            className={styles.btnDanger}
            onClick={logout}
            whileTap={{ scale: 0.99 }}
          >
            تسجيل الخروج
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

export default Profile

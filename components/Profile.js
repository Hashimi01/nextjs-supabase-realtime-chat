import { useState } from 'react'
import styles from '../styles/Chat.module.css'

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
            const { error } = await supabase
                .from('user')
                .upsert({
                    id: currentUser.id,
                    ...currentUser,
                    username: newUsername.trim()
                }, { onConflict: 'id' })

            if (error) throw error

            setMessage({ type: 'success', text: 'تم تحديث الاسم بنجاح!' })
            setEditingUsername(false)
            window.location.reload()
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'حدث خطأ أثناء التحديث' })
        } finally {
            setLoading(false)
        }
    }

    const logout = async () => {
        await supabase.auth.signOut()
        window.location.reload()
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '20px' }}>
            <div style={{ maxWidth: 600, margin: '0 auto', background: '#fff', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                    <button 
                        onClick={onBack}
                        style={{ 
                            background: 'none', 
                            border: 'none', 
                            fontSize: 24, 
                            cursor: 'pointer',
                            marginRight: 16
                        }}
                    >
                        ←
                    </button>
                    <h1 style={{ margin: 0, fontSize: 24, color: '#111b21' }}>الملف الشخصي</h1>
                </div>

                <div style={{ marginBottom: 32 }}>
                    <div style={{ 
                        width: 120, 
                        height: 120, 
                        borderRadius: '50%', 
                        background: '#075e54',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        fontSize: 48,
                        color: '#fff',
                        fontWeight: 'bold'
                    }}>
                        {(currentUser?.username || session?.user?.email || 'U')[0].toUpperCase()}
                    </div>
                    
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: 20, color: '#111b21' }}>
                            {currentUser?.username || 'بدون اسم'}
                        </h2>
                        <p style={{ margin: 0, color: '#667781', fontSize: 14 }}>
                            {session?.user?.email}
                        </p>
                    </div>

                    {message.text && (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: 8,
                            marginBottom: 16,
                            background: message.type === 'success' ? '#dcf8c6' : '#ffebee',
                            color: message.type === 'success' ? '#075e54' : '#c62828'
                        }}>
                            {message.text}
                        </div>
                    )}

                    {editingUsername ? (
                        <form onSubmit={updateUsername}>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', marginBottom: 8, color: '#111b21', fontWeight: 500 }}>
                                    اسم المستخدم
                                </label>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid #ddd',
                                        borderRadius: 8,
                                        fontSize: 16
                                    }}
                                    placeholder="أدخل اسم المستخدم"
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: '#075e54',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 8,
                                        fontSize: 16,
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.6 : 1
                                    }}
                                >
                                    {loading ? 'جاري الحفظ...' : 'حفظ'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingUsername(false)
                                        setNewUsername(currentUser?.username || '')
                                        setMessage({ type: '', text: '' })
                                    }}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#f0f2f5',
                                        color: '#111b21',
                                        border: 'none',
                                        borderRadius: 8,
                                        fontSize: 16,
                                        cursor: 'pointer'
                                    }}
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div style={{ marginBottom: 24 }}>
                            <button
                                onClick={() => setEditingUsername(true)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#f0f2f5',
                                    color: '#111b21',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontSize: 16,
                                    cursor: 'pointer'
                                }}
                            >
                                تعديل اسم المستخدم
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ borderTop: '1px solid #e9edef', paddingTop: 24 }}>
                    <button
                        onClick={logout}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#ff4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 16,
                            cursor: 'pointer',
                            fontWeight: 500
                        }}
                    >
                        تسجيل الخروج
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Profile


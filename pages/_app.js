import '../styles/globals.css'
import { Cairo } from 'next/font/google'
import useSupabase from '../utils/useSupabase'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-cairo',
})

function MyApp({ Component, pageProps }) {
  const { currentUser, session, supabase } = useSupabase()
  const router = useRouter()
  const locale = router.locale || 'ar'
  const isRTL = locale === 'ar'

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    document.documentElement.lang = locale
  }, [locale, isRTL])

  return (
    <div className={`${cairo.className} ${cairo.variable} app-root`} dir={isRTL ? 'rtl' : 'ltr'}>
      <Component
        currentUser={currentUser}
        session={session}
        supabase={supabase}
        {...pageProps}
      />
    </div>
  )
}

export default MyApp

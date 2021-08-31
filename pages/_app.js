import '../styles/globals.css'
import { Cairo } from 'next/font/google'
import useSupabase from '../utils/useSupabase'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-cairo',
})

function MyApp({ Component, pageProps }) {
  const { currentUser, session, supabase } = useSupabase()
  return (
    <div className={`${cairo.className} ${cairo.variable} app-root`}>
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

import { useRouter } from 'next/router'
import { translations } from './translations'

export default function useTranslation() {
  const router = useRouter()
  // Ensure locale fallbacks to 'ar' if router is not ready yet
  const locale = router.locale || 'ar'
  const t = translations[locale] || translations.ar

  const toggleLanguage = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar'
    // Update direction attribute on body/html
    document.documentElement.dir = nextLocale === 'ar' ? 'rtl' : 'ltr'
    
    // Change route locale without full reload
    router.replace(router.pathname, router.asPath, { locale: nextLocale })
  }

  return { t, locale, toggleLanguage }
}

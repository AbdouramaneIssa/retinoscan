import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr'
import en from './locales/en'
import ar from './locales/ar'

export const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'ar', label: 'العربية',  flag: '🇸🇦' },
]

const saved = (() => {
  try { return localStorage.getItem('lang') } catch { return null }
})()

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: saved || 'fr',
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  })

// Persiste le choix de langue (mise en page conservée en LTR, texte arabe traduit)
i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem('lang', lng) } catch {}
  document.documentElement.setAttribute('lang', lng)
})

document.documentElement.setAttribute('lang', i18n.language)

export default i18n

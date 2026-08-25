import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'

/**
 * Bannière d'installation PWA : apparaît quand le navigateur signale
 * que l'app est installable (évènement beforeinstallprompt).
 */
export default function InstallPWA() {
  const { t } = useTranslation()
  const [deferred, setDeferred] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('pwaDismissed') === '1') return
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setShow(false))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const installer = async () => {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setShow(false)
  }

  const plusTard = () => {
    setShow(false)
    try { localStorage.setItem('pwaDismissed', '1') } catch {}
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="fixed bottom-6 left-6 z-50 w-[300px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
                <Download size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm">{t('pwa.title')}</p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5">{t('pwa.desc')}</p>
              </div>
              <button onClick={plusTard} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition flex-shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={installer}
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                {t('pwa.install')}
              </button>
              <button onClick={plusTard}
                className="px-4 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-xl transition">
                {t('pwa.later')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

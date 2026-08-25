import { CheckCircle, AlertTriangle, ChevronRight, Mail, Share2, MessageCircle, Activity } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useStades } from '../constants'

export default function ResultatRetino({ resultat, onChat, onShare, onRapport, avecInfos }) {
  const { t } = useTranslation()
  const STADES = useStades()
  if (!resultat) return null
  if (!resultat.valide) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="mt-6 p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={20} className="text-red-600" />
        </div>
        <div>
          <p className="font-semibold text-red-700">{t('result.rejected')}</p>
          <p className="text-sm text-red-600 mt-1">{resultat.message}</p>
          {resultat.confiance && <p className="text-xs text-red-500 mt-1">{t('result.confidence', { val: resultat.confiance })}</p>}
        </div>
      </motion.div>
    )
  }

  const stade = STADES[resultat.stade]
  const probas = resultat.toutes_probabilites || {}

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className={`mt-6 border-2 ${stade.border} ${stade.bg} rounded-2xl overflow-hidden`}>
      {/* Header stade */}
      <div className="p-5 border-b border-opacity-30" style={{ borderColor: stade.couleur + '40' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: stade.couleur + '20' }}>
              <CheckCircle size={24} style={{ color: stade.couleur }} />
            </div>
            <div>
              <span className={`text-xs font-semibold uppercase tracking-wider ${stade.text}`}>{t('result.detected', { n: resultat.stade })}</span>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">{stade.label}</h3>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${stade.urgenceBadge}`}>
            ⚡ {stade.urgence}
          </span>
        </div>

        {/* Barre de confiance */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">{t('result.modelConfidence')}</span>
            <span className="text-sm font-bold" style={{ color: stade.couleur }}>{resultat.confiance}%</span>
          </div>
          <div className="h-2.5 bg-white rounded-full overflow-hidden shadow-inner">
            <motion.div initial={{ width: 0 }} animate={{ width: `${resultat.confiance}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full" style={{ backgroundColor: stade.couleur }} />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="p-5">
        <p className="text-sm text-slate-600 leading-relaxed mb-4">{stade.description}</p>

        {/* Recommandations */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Activity size={14} className="text-blue-600" /> {t('result.recoTitle')}
          </h4>
          <ul className="space-y-1.5">
            {stade.recommandations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <ChevronRight size={14} style={{ color: stade.couleur }} className="mt-0.5 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Probabilités par stade */}
        {Object.keys(probas).length > 0 && (
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('result.distribTitle')}</h4>
            <div className="space-y-1.5">
              {Object.entries(probas).filter(([k]) => !k.includes('non')).slice(0, 5).map(([label, prob]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-28 text-slate-500 truncate">{label}</span>
                  <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-slate-300" style={{ width: `${prob}%` }} />
                  </div>
                  <span className="w-10 text-right text-slate-600 font-medium">{prob}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/60">
          <button onClick={onChat}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition">
            <MessageCircle size={15} /> {t('result.chatIA')}
          </button>
          <button onClick={onShare}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 border-2 border-slate-300 text-slate-600 rounded-xl hover:bg-white transition">
            <Share2 size={15} /> {t('result.share')}
          </button>
          {avecInfos && (
            <button onClick={onRapport}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 border-2 border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 transition">
              <Mail size={15} /> {t('result.sendPdf')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Activity, Share2, ShieldCheck, ShieldAlert, TrendingUp } from 'lucide-react'

const TIERS = {
  low:  { couleur: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', label: 'tierLow',  Icon: ShieldCheck },
  mod:  { couleur: '#f59e0b', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',     label: 'tierMod',  Icon: TrendingUp },
  high: { couleur: '#ef4444', bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',         label: 'tierHigh', Icon: ShieldAlert },
}

function tierFromProb(p) {
  if (p < 25) return 'low'
  if (p < 50) return 'mod'
  return 'high'
}

/**
 * Affichage riche d'un résultat de risque (diabète / HTA / CHD),
 * dans le même esprit que le résultat de rétinopathie.
 * type : 'diabete' | 'hta' | 'chd'
 */
export default function ResultatRisque({ type, resultat, onShare }) {
  const { t } = useTranslation()
  if (!resultat || resultat.probabilite === undefined || resultat.probabilite === null) return null

  const tk = tierFromProb(resultat.probabilite)
  const tier = TIERS[tk]
  const TierIcon = tier.Icon
  const recos = [1, 2, 3, 4].map(i => t(`risk.${type}.${tk}R${i}`))

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className={`mt-6 border-2 ${tier.border} ${tier.bg} rounded-2xl overflow-hidden`}>

      {/* En-tête */}
      <div className="p-5 border-b" style={{ borderColor: tier.couleur + '30' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: tier.couleur + '20' }}>
              <TierIcon size={24} style={{ color: tier.couleur }} />
            </div>
            <div>
              <span className={`text-xs font-semibold uppercase tracking-wider ${tier.text}`}>{t('risk.level')}</span>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">{resultat.label}</h3>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${tier.badge}`}>{t(`risk.${tier.label}`)}</span>
        </div>

        {/* Barre de probabilité */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500 font-medium">{t('diag.probability')}</span>
            <span className="text-sm font-bold" style={{ color: tier.couleur }}>{resultat.probabilite}%</span>
          </div>
          <div className="h-2.5 bg-white rounded-full overflow-hidden shadow-inner">
            <motion.div initial={{ width: 0 }} animate={{ width: `${resultat.probabilite}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full" style={{ backgroundColor: tier.couleur }} />
          </div>
        </div>
      </div>

      {/* Description + recommandations */}
      <div className="p-5">
        <p className="text-sm text-slate-600 leading-relaxed mb-4">{t(`risk.${type}.${tk}Desc`)}</p>

        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Activity size={14} className="text-blue-600" /> {t('risk.recoTitle')}
          </h4>
          <ul className="space-y-1.5">
            {recos.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <ChevronRight size={14} style={{ color: tier.couleur }} className="mt-0.5 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        {onShare && (
          <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-white/60">
            <button onClick={onShare}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 border-2 border-slate-300 text-slate-600 rounded-xl hover:bg-white transition">
              <Share2 size={15} /> {t('result.share')}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

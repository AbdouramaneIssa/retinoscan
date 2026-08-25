import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Calendar, TrendingUp, BarChart2, Eye, Mail, X, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { db } from '../firebase'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { BACKEND_URL, useStades } from '../constants'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

const COULEURS_STADES = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6']
const PAGE_SIZE = 10

function StatCard({ icon: Icon, titre, valeur, sub, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900">{valeur}</p>
        <p className="font-semibold text-slate-700 text-sm">{titre}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  )
}

function ModalDetail({ consultation, onClose, onRapport }) {
  const { t, i18n } = useTranslation()
  const STADES = useStades()
  if (!consultation) return null
  const r = consultation.resultat
  const date = consultation.date?.toDate?.()?.toLocaleString(i18n.language) || '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-bold text-slate-800 text-lg">{t('dash.modalTitle')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{t('dash.mPatient')}</p>
              <p className="font-semibold text-slate-700">{consultation.nomPatient}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{t('dash.mDate')}</p>
              <p className="font-semibold text-slate-700">{date}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{t('dash.mType')}</p>
              <p className="font-semibold text-slate-700 capitalize">{consultation.type?.replace('_', ' + ')}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{t('dash.mMode')}</p>
              <p className="font-semibold text-slate-700">{consultation.anonyme ? t('dash.mAnon') : t('dash.mIdentified')}</p>
            </div>
          </div>

          {/* Résultat rétinopathie */}
          {r?.valide !== undefined && r.valide && (
            <div className={`p-4 rounded-xl border-2 ${STADES[r.stade]?.bg} ${STADES[r.stade]?.border}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">{t('dash.mRetino')}</p>
              <p className="font-bold text-slate-800">{r.label}</p>
              <p className="text-sm" style={{ color: STADES[r.stade]?.couleur }}>{t('dash.mConfidence', { val: r.confiance })}</p>
              <p className="text-xs text-slate-500 mt-1">{t('dash.mUrgency', { val: STADES[r.stade]?.urgence })}</p>
            </div>
          )}

          {/* Résultat diabète */}
          {r?.prediction !== undefined && consultation.type === 'diabete' && (
            <div className={`p-4 rounded-xl border-2 ${r.prediction === 1 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">{t('dash.mDiab')}</p>
              <p className="font-bold text-slate-800">{r.label}</p>
              <p className={`text-sm ${r.prediction === 1 ? 'text-red-600' : 'text-emerald-600'}`}>{t('dash.mProbability', { val: r.probabilite })}</p>
            </div>
          )}

          {/* Résultat HTA + CHD */}
          {r?.hta && (
            <div className="grid grid-cols-2 gap-3">
              {[{ label: t('diag.resHta'), data: r.hta }, { label: t('diag.resChd'), data: r.chd }].map(({ label, data }) => data && (
                <div key={label} className={`p-3 rounded-xl border-2 ${data.prediction === 1 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <p className="text-xs font-bold text-slate-500 mb-1">{label}</p>
                  <p className="font-bold text-slate-700 text-sm">{data.label}</p>
                  <p className={`text-xs ${data.prediction === 1 ? 'text-red-600' : 'text-emerald-600'}`}>{data.probabilite}%</p>
                </div>
              ))}
            </div>
          )}

          {!consultation.anonyme && (
            <button onClick={() => { onRapport(consultation); onClose() }}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition">
              <Mail size={16} /> {t('dash.mSendReport')}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const STADES = useStades()
  const [consultations, setConsultations] = useState([])
  const [loading, setLoading]             = useState(true)
  const [selected, setSelected]           = useState(null)
  const [search, setSearch]               = useState('')
  const [filterType, setFilterType]       = useState('tous')
  const [page, setPage]                   = useState(1)
  const [envoyant, setEnvoyant]           = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'consultations'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setConsultations(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  // Stats
  const total        = consultations.length
  const aujourdhui   = consultations.filter(c => {
    const d = c.date?.toDate?.()
    if (!d) return false
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  const stadesCounts = [0, 1, 2, 3, 4].map(s => ({
    stade: STADES[s].shortLabel,
    count: consultations.filter(c => c.resultat?.stade === s).length
  }))

  const stadeFrequent = stadesCounts.reduce((a, b) => b.count > a.count ? b : a, stadesCounts[0])

  const tauxPositif = total > 0
    ? Math.round((consultations.filter(c => c.resultat?.stade > 0 || c.resultat?.prediction === 1 || c.resultat?.hta?.prediction === 1).length / total) * 100)
    : 0

  // Filtrage
  const filtered = consultations.filter(c => {
    const matchSearch = search === '' || c.nomPatient?.toLowerCase().includes(search.toLowerCase())
    const matchType   = filterType === 'tous' || c.type === filterType
    return matchSearch && matchType
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const envoyerRapport = async (c) => {
    if (!c.emailPatient) return toast.error(t('dash.tEmailUnavailable'))
    setEnvoyant(true)
    const tid = toast.loading(t('dash.tGenerating'))
    try {
      await fetch(`${BACKEND_URL}/rapport/envoyer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom_patient: c.nomPatient, email_patient: c.emailPatient,
          date_analyse: c.date?.toDate?.()?.toLocaleDateString('fr-FR') || '',
          resultat_retinopathie: c.type === 'retinopathie' ? c.resultat : null,
          resultat_diabete: c.type === 'diabete' ? c.resultat : null,
          resultat_hypertension: c.resultat?.hta || null,
          resultat_chd: c.resultat?.chd || null,
        }),
      })
      toast.success(t('dash.tSent'), { id: tid })
    } catch { toast.error(t('dash.tSendError'), { id: tid }) }
    finally { setEnvoyant(false) }
  }

  const getBadgeResultat = (c) => {
    if (c.type === 'retinopathie' && c.resultat?.valide) {
      const s = STADES[c.resultat.stade]
      return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s?.badge}`}>{s?.shortLabel}</span>
    }
    if (c.type === 'diabete') {
      return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.resultat?.prediction === 1 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {c.resultat?.label || '—'}
      </span>
    }
    if (c.type === 'hypertension_chd') {
      return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.resultat?.hta?.prediction === 1 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
        {t('dash.htaBadge', { val: c.resultat?.hta?.prediction === 1 ? t('diag.yes') : t('diag.no') })}
      </span>
    }
    return <span className="text-slate-400 text-xs">—</span>
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text={t('dash.loading')} />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{t('dash.title')}</h1>
          <p className="text-slate-500">{t('dash.subtitle')}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard icon={Activity}    titre={t('dash.total')}   valeur={total}                          sub={t('dash.totalSub')}       color="bg-blue-600" />
          <StatCard icon={TrendingUp}  titre={t('dash.frequent')} valeur={stadeFrequent?.stade || '—'}  sub={t('dash.frequentSub', { count: stadeFrequent?.count || 0 })} color="bg-orange-500" />
          <StatCard icon={Calendar}    titre={t('dash.today')} valeur={aujourdhui}                sub={new Date().toLocaleDateString(i18n.language)} color="bg-cyan-500" />
          <StatCard icon={BarChart2}   titre={t('dash.positiveRate')} valeur={`${tauxPositif}%`}        sub={t('dash.positiveRateSub')}       color="bg-violet-600" />
        </div>

        {/* Graphique */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
          <h2 className="font-bold text-slate-800 text-lg mb-6">{t('dash.chartTitle')}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stadesCounts} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="stade" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="count" name={t('dash.chartSeries')} radius={[6, 6, 0, 0]}>
                {stadesCounts.map((_, i) => <Cell key={i} fill={COULEURS_STADES[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Liste consultations */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filtres */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-3.5 text-slate-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder={t('dash.searchPlaceholder')}
                className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div className="relative">
              <Filter size={15} className="absolute left-3 top-3.5 text-slate-400" />
              <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
                className="pl-9 pr-8 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white">
                <option value="tous">{t('dash.allTypes')}</option>
                <option value="retinopathie">{t('dash.typeRetino')}</option>
                <option value="diabete">{t('dash.typeDiab')}</option>
                <option value="hypertension_chd">{t('dash.typeHta')}</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[t('dash.thPatient'), t('dash.thType'), t('dash.thDate'), t('dash.thResult'), t('dash.thActions')].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400">{t('dash.noConsult')}</td></tr>
                ) : paginated.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-4 font-medium text-slate-800">
                      {c.anonyme
                        ? <span className="text-slate-400 italic flex items-center gap-1"><span>🔒</span> {t('dash.anon')}</span>
                        : c.nomPatient}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                        ${c.type === 'retinopathie' ? 'bg-blue-100 text-blue-700'
                        : c.type === 'diabete' ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-orange-100 text-orange-700'}`}>
                        {c.type === 'retinopathie' ? t('dash.badgeRetino') : c.type === 'diabete' ? t('dash.badgeDiab') : t('dash.badgeHta')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {c.date?.toDate?.()?.toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—'}
                    </td>
                    <td className="px-5 py-4">{getBadgeResultat(c)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelected(c)} title={t('dash.viewDetail')}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Eye size={16} />
                        </button>
                        {!c.anonyme && c.emailPatient && (
                          <button onClick={() => envoyerRapport(c)} disabled={envoyant} title={t('dash.sendReport')}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50">
                            <Mail size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {t('dash.resultsPage', { count: filtered.length, page, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal détail */}
      <AnimatePresence>
        {selected && <ModalDetail consultation={selected} onClose={() => setSelected(null)} onRapport={envoyerRapport} />}
      </AnimatePresence>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Scan, LayoutDashboard, Eye, Activity, CheckCircle, AlertCircle, AlertTriangle, XCircle, Zap, ChevronRight, ArrowRight, Upload, Brain, FileText, Mail, BarChart2, MessageCircle } from 'lucide-react'
import { db } from '../firebase'
import { collection, getCountFromServer } from 'firebase/firestore'
import { useStades } from '../constants'

function useCountUp(target, duration = 1500) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!target) return
    let start = null
    const step = ts => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setCount(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return count
}

const STADE_CARDS = [
  { stade: 0, icon: CheckCircle },
  { stade: 1, icon: AlertCircle },
  { stade: 2, icon: AlertTriangle },
  { stade: 3, icon: XCircle },
  { stade: 4, icon: Zap },
]

const ETAPES = [
  { icon: Upload,   key: 'step1' },
  { icon: Brain,    key: 'step2' },
  { icon: Eye,      key: 'step3' },
  { icon: Activity, key: 'step4' },
  { icon: Mail,     key: 'step5' },
]

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }

export default function Accueil() {
  const { t } = useTranslation()
  const STADES = useStades()
  const [stats, setStats] = useState({ total: 0 })

  useEffect(() => {
    getCountFromServer(collection(db, 'consultations'))
      .then(snap => setStats({ total: snap.data().count }))
      .catch(() => {})
  }, [])

  const totalCount = useCountUp(stats.total || 142)

  return (
    <div className="overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="bg-mist-50 pt-8 sm:pt-10 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Carte hero avec image de fond + overlay dégradé */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative rounded-3xl overflow-hidden shadow-2xl min-h-[460px] sm:min-h-[500px] flex"
            style={{ backgroundColor: '#072b48', backgroundImage: "url('/hero.svg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>

            {/* Photo personnalisée : déposez frontend/public/hero.jpg pour remplacer l'illustration */}
            <img src="/hero.jpg" alt="" aria-hidden="true"
              loading="eager" fetchpriority="high"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
              className="absolute inset-0 w-full h-full object-cover object-center" />

            {/* Overlays bleu profond (lisibilité du texte à gauche, image visible à droite) */}
            <div className="absolute inset-0 bg-gradient-to-r from-deepsea-900/95 from-5% via-deepsea-900/70 via-45% to-deepsea-900/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-deepsea-900/70 via-transparent to-transparent" />

            {/* Contenu */}
            <div className="relative z-10 p-8 sm:p-12 lg:p-16 max-w-2xl flex flex-col justify-center">
              <span className="inline-flex items-center gap-2 w-fit bg-white/15 backdrop-blur text-white text-sm font-semibold px-4 py-2 rounded-full mb-6 border border-white/20">
                <Eye size={15} /> {t('home.badge')}
              </span>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-5">
                {t('home.titleBefore')}<span className="text-cyan-300">{t('home.titleHighlight')}</span>{t('home.titleAfter')}
              </h1>

              <p className="text-base sm:text-lg text-blue-50/90 max-w-xl mb-9 leading-relaxed">
                {t('home.subtitle')}
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/diagnostic"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-7 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all text-base">
                  <Scan size={20} /> {t('home.ctaLaunch')} <ArrowRight size={18} />
                </Link>
                <Link to="/assistant"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/30 text-white font-bold px-7 py-3.5 rounded-2xl transition-all text-base">
                  <MessageCircle size={20} /> {t('home.ctaAssistant')}
                </Link>
              </div>
            </div>
          </motion.div>

          {/* 3 cartes de fonctionnalités (chevauchent le bas de la carte hero) */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 -mt-10 relative z-20 px-2 sm:px-6">
            {[
              { icon: Brain,    titre: t('home.featEfficient'),              sub: t('home.featEfficientSub') },
              { icon: Activity, titre: t('home.featModules'),                sub: t('home.featModulesSub') },
              { icon: Eye,      titre: t('home.featConsult', { count: totalCount }), sub: t('home.featConsultSub') },
            ].map(({ icon: Icon, titre, sub }, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 flex items-center gap-4">
                <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 leading-tight">{titre}</p>
                  <p className="text-sm text-slate-500">{sub}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── STADES ── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">{t('home.detectTitle')}</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">{t('home.detectSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {STADE_CARDS.map(({ stade, icon: Icon }, idx) => {
              const s = STADES[stade]
              return (
                <motion.div key={stade} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: idx * 0.07 }}
                  className={`${s.bg} border ${s.border} rounded-2xl p-5 hover:shadow-md transition-all group`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.couleur + '20' }}>
                      <Icon size={22} style={{ color: s.couleur }} />
                    </div>
                    {stade === 4 && (
                      <span className="text-xs bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-full">{t('home.urgency')}</span>
                    )}
                  </div>
                  <div className={`text-xs font-semibold uppercase tracking-wider ${s.text} mb-1`}>{s.shortLabel}</div>
                  <h3 className="font-bold text-slate-800 mb-2">{s.label}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{s.description}</p>
                </motion.div>
              )
            })}
            {/* Module systémique */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.35 }}
              className="bg-blue-50 border border-blue-200 rounded-2xl p-5 hover:shadow-md transition-all">
              <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                <Activity size={22} className="text-blue-700" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">{t('home.systemicBadge')}</div>
              <h3 className="font-bold text-slate-800 mb-2">{t('home.systemicTitle')}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{t('home.systemicDesc')}</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ── */}
      <section className="py-20 bg-mist-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">{t('home.howTitle')}</h2>
            <p className="text-slate-500 text-lg">{t('home.howSubtitle')}</p>
          </div>
          <div className="relative">
            {/* Line */}
            <div className="hidden lg:block absolute top-8 left-12 right-12 h-0.5 bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-200" />
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
              {ETAPES.map(({ icon: Icon, key }, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center text-center">
                  <div className="relative w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg mb-4 z-10">
                    <Icon size={24} className="text-white" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-white border-2 border-blue-600 text-blue-700 text-xs font-extrabold rounded-full flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 mb-1">{t(`home.${key}`)}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{t(`home.${key}d`)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── NOS MODULES ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">{t('home.modulesTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Eye,      titre: t('home.modRetino'), desc: t('home.modRetinoD'), color: 'from-blue-600 to-blue-400', to: '/diagnostic' },
              { icon: Activity, titre: t('home.modDiab'),   desc: t('home.modDiabD'),   color: 'from-emerald-600 to-cyan-500', to: '/diagnostic' },
              { icon: BarChart2,titre: t('home.modHta'),    desc: t('home.modHtaD'),    color: 'from-orange-500 to-amber-400', to: '/diagnostic' },
            ].map(({ icon: Icon, titre, desc, color, to }, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="group bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all hover:-translate-y-1">
                <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition`}>
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-2">{titre}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">{desc}</p>
                <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:gap-2 transition-all">
                  {t('home.access')} <ChevronRight size={15} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative py-20 bg-gradient-to-br from-deepsea-800 to-deepsea-900 overflow-hidden">
        {/* liseré d'accent en haut pour rappeler la navbar */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400" />
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">{t('home.ctaTitle')}</h2>
            <p className="text-blue-100/80 text-lg mb-8">{t('home.ctaSubtitle')}</p>
            <Link to="/diagnostic"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-2xl transition shadow-xl text-base">
              <Scan size={20} /> {t('home.ctaButton')}
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

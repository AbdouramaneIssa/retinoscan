import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, Menu, X, Scan, Users, LayoutDashboard, MessageCircle, Home } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../firebase'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import LanguageSwitcher from './LanguageSwitcher'

const LINKS = [
  { to: '/',            key: 'home',      icon: Home },
  { to: '/diagnostic',  key: 'diagnostic', icon: Scan },
  { to: '/assistant',   key: 'assistant', icon: MessageCircle },
  { to: '/dashboard',   key: 'dashboard', icon: LayoutDashboard },
  { to: '/communaute',  key: 'community', icon: Users },
]

export default function Navbar() {
  const { t } = useTranslation()
  const [open, setOpen]         = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [unread, setUnread]     = useState(0)
  const location                = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setOpen(false) }, [location])

  useEffect(() => {
    const last = localStorage.getItem('lastVisitCommunaute')
    if (!last) return
    const since = new Date(last)
    const q = query(collection(db, 'messages'), where('timestamp', '>', Timestamp.fromDate(since)))
    getDocs(q).then(snap => setUnread(snap.size)).catch(() => {})
  }, [location.pathname])

  return (
    <nav className={`sticky top-0 z-50 bg-gradient-to-r from-deepsea-900 via-deepsea-700 to-deepsea-900 transition-shadow duration-300 ${scrolled ? 'shadow-xl' : 'shadow-md'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-md ring-1 ring-white/20 group-hover:scale-105 transition">
              <Eye size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              Retino<span className="text-cyan-300">Scan</span>
              <span className="text-white/70 font-extrabold"> CM</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {LINKS.map(({ to, key, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link key={to} to={to}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${active ? 'text-white bg-white/15' : 'text-blue-100/80 hover:text-white hover:bg-white/10'}`}>
                  <Icon size={15} />
                  {t(`nav.${key}`)}
                  {key === 'community' && unread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                  {active && <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-3 right-3 h-0.5 bg-cyan-300 rounded-full" />}
                </Link>
              )
            })}
          </div>

          {/* Langue + CTA + hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher variant="dark" />
            <Link to="/diagnostic" className="hidden md:flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-md ring-1 ring-white/10">
              <Scan size={15} /> {t('nav.launch')}
            </Link>
            <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Liseré d'accent */}
      <div className="h-[3px] bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400" />

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-deepsea-800 overflow-hidden">
            <div className="px-4 py-3 flex flex-col gap-1">
              {LINKS.map(({ to, key, icon: Icon }) => {
                const active = location.pathname === to
                return (
                  <Link key={to} to={to}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition
                      ${active ? 'bg-white/15 text-white' : 'text-blue-100/80 hover:bg-white/10 hover:text-white'}`}>
                    <Icon size={17} /> {t(`nav.${key}`)}
                    {key === 'community' && unread > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{unread}</span>
                    )}
                  </Link>
                )
              })}
              <Link to="/diagnostic" className="mt-2 flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-3 rounded-xl transition">
                <Scan size={16} /> {t('nav.launch')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

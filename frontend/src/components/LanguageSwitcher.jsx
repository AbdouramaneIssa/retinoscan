import { useState, useRef, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { LANGUAGES } from '../i18n'

/* Petits drapeaux en SVG (les emojis de drapeaux ne s'affichent pas sur Windows) */
function Flag({ code, size = 20 }) {
  const uid = useId().replace(/:/g, '')
  const common = { width: size, height: Math.round(size * 0.72), viewBox: '0 0 60 43', className: 'rounded-[2px] shadow-sm ring-1 ring-black/5 flex-shrink-0' }

  if (code === 'fr') return (
    <svg {...common}>
      <rect width="60" height="43" fill="#fff" />
      <rect width="20" height="43" fill="#0055A4" />
      <rect x="40" width="20" height="43" fill="#EF4135" />
    </svg>
  )

  if (code === 'en') return (
    <svg {...common} viewBox="0 0 60 43">
      <clipPath id={uid}><rect width="60" height="43" /></clipPath>
      <g clipPath={`url(#${uid})`}>
        <rect width="60" height="43" fill="#012169" />
        <path d="M0,0 60,43 M60,0 0,43" stroke="#fff" strokeWidth="8" />
        <path d="M0,0 60,43 M60,0 0,43" stroke="#C8102E" strokeWidth="5" />
        <rect x="25" width="10" height="43" fill="#fff" />
        <rect y="16.5" width="60" height="10" fill="#fff" />
        <rect x="27" width="6" height="43" fill="#C8102E" />
        <rect y="18.5" width="60" height="6" fill="#C8102E" />
      </g>
    </svg>
  )

  // Arabie saoudite
  return (
    <svg {...common}>
      <rect width="60" height="43" fill="#006C35" />
      <rect x="10" y="27" width="40" height="2.6" rx="1" fill="#fff" />
      <path d="M10 28.3 L14 25.8 L14 30.8 Z" fill="#fff" />
      <rect x="14" y="14" width="32" height="7" rx="1.5" fill="#fff" opacity="0.92" />
    </svg>
  )
}

export default function LanguageSwitcher({ variant = 'dark' }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const choose = (code) => { i18n.changeLanguage(code); setOpen(false) }

  const btnClass = variant === 'dark'
    ? 'text-blue-100/90 hover:text-white hover:bg-white/10'
    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Changer de langue"
        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition ${btnClass}`}>
        <Globe size={16} className="hidden sm:block" />
        <Flag code={current.code} size={20} />
        <span className="uppercase text-xs font-semibold">{current.code}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
            {LANGUAGES.map((l) => {
              const active = l.code === i18n.language
              return (
                <button
                  key={l.code}
                  onClick={() => choose(l.code)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition text-left
                    ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <Flag code={l.code} size={22} />
                  <span className="flex-1">{l.label}</span>
                  {active && <Check size={15} className="text-blue-600" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

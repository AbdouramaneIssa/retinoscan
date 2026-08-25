import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send, Bot, User, Mic, MicOff, RotateCcw, Minimize2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BACKEND_URL, useQuestions } from '../constants'
import ChatMarkdown from './ChatMarkdown'
import SvgRobot from './SvgRobot'

// Positions où le robot se promène sur la page (le long du bord droit)
const POSITIONS = [
  { bottom: 24,  right: 24 },
  { bottom: 150, right: 24 },
  { bottom: 300, right: 24 },
  { bottom: 110, right: 24 },
]

export default function ChatbotWidget() {
  const { t } = useTranslation()
  const QUESTIONS_SUGGEREES = useQuestions()
  const BULLES = [t('chatbot.bubble1'), t('chatbot.bubble2'), t('chatbot.bubble3'), t('chatbot.bubble4'), t('chatbot.bubble5')]
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState(() => [{ role: 'model', content: t('chatbot.welcome') }])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [listening, setListening] = useState(false)
  const [inclureContexte, setInclureContexte] = useState(false)
  const [touched, setTouched]   = useState(false)  // souris sur le robot
  const [marche, setMarche]     = useState(false)  // robot en déplacement
  const [posIdx, setPosIdx]     = useState(0)      // position courante sur la page
  const [bulleIdx, setBulleIdx]     = useState(0)
  const messagesRef             = useRef(null)
  const recognitionRef          = useRef(null)

  // Fait défiler les messages d'accroche tant que le chat est fermé
  useEffect(() => {
    if (open) return
    const id = setInterval(() => setBulleIdx(i => (i + 1) % BULLES.length), 3500)
    return () => clearInterval(id)
  }, [open])

  // Le robot se balade sur la page toutes les 11 s (marche pendant le trajet)
  useEffect(() => {
    if (open) return
    const id = setInterval(() => {
      setMarche(true)
      setPosIdx(p => (p + 1) % POSITIONS.length)
      setTimeout(() => setMarche(false), 1400)
    }, 11000)
    return () => clearInterval(id)
  }, [open])

  // Scroll uniquement dans la zone des messages du widget
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  // Ouverture déclenchée depuis un résultat de diagnostic → on active le contexte
  useEffect(() => {
    const handler = () => { setOpen(true); setInclureContexte(true) }
    window.addEventListener('openChatbot', handler)
    return () => window.removeEventListener('openChatbot', handler)
  }, [])

  const contexteSession = () => {
    try { return sessionStorage.getItem('dernierScan') } catch { return null }
  }
  const scan = contexteSession()

  const envoyer = async (texte) => {
    const msg = texte || input.trim()
    if (!msg) return
    setInput('')
    const newMessages = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const contexte = inclureContexte ? scan : null
      const historique = newMessages.slice(1, -1).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, contexte, historique }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'model', content: data.reponse || t('chatbot.noResponse') }])
    } catch {
      setMessages(prev => [...prev, { role: 'model', content: t('chatbot.connError') }])
    } finally {
      setLoading(false)
    }
  }

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = 'fr-FR'
    r.onresult = e => { setInput(e.results[0][0].transcript); setListening(false) }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    recognitionRef.current = r
    r.start()
    setListening(true)
  }

  const reset = () => setMessages([{ role: 'model', content: t('chatbot.welcome') }])

  return (
    <>
      {/* Robot mascotte (SVG) qui flotte, marche et se balade sur la page */}
      <div
        className="robot-widget fixed z-50 flex flex-col items-end gap-1"
        style={open ? { bottom: 24, right: 24 } : POSITIONS[posIdx]}>

        {/* Bulle d'accroche (messages qui changent) */}
        <AnimatePresence mode="wait">
          {!open && (
            <motion.div
              key={bulleIdx}
              initial={{ opacity: 0, y: 8, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.85 }}
              transition={{ duration: 0.35 }}
              className="relative mr-2 max-w-[190px] bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg border border-slate-100">
              {BULLES[bulleIdx]}
              {/* petite queue de la bulle */}
              <span className="absolute -bottom-1.5 right-7 w-3 h-3 bg-white border-r border-b border-slate-100 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Le robot lui-même = bouton (transparent, sans cercle) */}
        <button
          onClick={() => setOpen(!open)}
          onMouseEnter={() => setTouched(true)}
          onMouseLeave={() => setTouched(false)}
          aria-label={open ? 'Fermer le chat' : 'Ouvrir l\'assistant IA'}
          className="bg-transparent border-0 p-0 cursor-pointer focus:outline-none">
          {open
            ? <span className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-700 text-white shadow-lg"><X size={24} /></span>
            : <SvgRobot marche={marche} touched={touched} width={88} />
          }
        </button>
      </div>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{t('chatbot.title')}</p>
                  <p className="text-blue-200 text-xs">{t('chatbot.poweredBy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={reset} className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/80 hover:text-white" title={t('assistant.reset')}>
                  <RotateCcw size={15} />
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/80 hover:text-white">
                  <Minimize2 size={15} />
                </button>
              </div>
            </div>

            {/* Questions suggérées */}
            <div className="px-3 py-2 border-b border-slate-100 flex gap-2 overflow-x-auto scrollbar-hide">
              {QUESTIONS_SUGGEREES.slice(0, 4).map((q, i) => (
                <button key={i} onClick={() => envoyer(q)}
                  className="flex-shrink-0 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-100 transition font-medium">
                  {q.slice(0, 28)}…
                </button>
              ))}
            </div>

            {/* Toggle contexte du dernier scan */}
            {scan && (
              <button onClick={() => setInclureContexte(v => !v)}
                className={`mx-3 mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition ${inclureContexte ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                <span className="truncate">{inclureContexte ? t('chatbot.ctxOn') : t('chatbot.ctxOff')}</span>
                <span className={`relative w-8 h-4 rounded-full flex-shrink-0 transition ${inclureContexte ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${inclureContexte ? 'translate-x-4' : ''}`} />
                </span>
              </button>
            )}

            {/* Messages */}
            <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center
                    ${m.role === 'user' ? 'bg-blue-700' : 'bg-slate-200'}`}>
                    {m.role === 'user' ? <User size={13} className="text-white" /> : <Bot size={13} className="text-slate-600" />}
                  </div>
                  <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
                    ${m.role === 'user'
                      ? 'bg-blue-700 text-white rounded-tr-sm whitespace-pre-wrap'
                      : 'bg-slate-100 text-slate-700 rounded-tl-sm'}`}>
                    {m.role === 'user' ? m.content : <ChatMarkdown>{m.content}</ChatMarkdown>}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center">
                    <Bot size={13} className="text-slate-600" />
                  </div>
                  <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                        animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input zone */}
            <div className="p-3 border-t border-slate-100 bg-white">
              <div className="flex items-end gap-2 bg-slate-50 rounded-xl p-2 border border-slate-200 focus-within:border-blue-400 transition">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer() } }}
                  placeholder={t('chatbot.placeholder')}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-slate-700 resize-none outline-none placeholder-slate-400 leading-5 max-h-24"
                  style={{ minHeight: '20px' }}
                />
                <div className="flex gap-1">
                  <button onClick={listening ? () => { recognitionRef.current?.stop(); setListening(false) } : startVoice}
                    className={`p-1.5 rounded-lg transition ${listening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}>
                    {listening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  <button onClick={() => envoyer()} disabled={!input.trim() || loading}
                    className="p-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

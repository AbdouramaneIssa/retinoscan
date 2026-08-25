import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, User, Send, Mic, MicOff, RotateCcw, MessageCircle, Sparkles } from 'lucide-react'
import { BACKEND_URL, useQuestions } from '../constants'
import ChatMarkdown from '../components/ChatMarkdown'

export default function Assistant() {
  const { t } = useTranslation()
  const QUESTIONS_SUGGEREES = useQuestions()
  const [messages, setMessages]   = useState(() => [{ role: 'model', content: t('assistant.welcome') }])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [listening, setListening] = useState(false)
  const [inclureContexte, setInclureContexte] = useState(false)
  const messagesRef               = useRef(null)
  const textareaRef               = useRef(null)
  const recognitionRef            = useRef(null)

  // Scroll uniquement à l'intérieur de la zone des messages (pas la page entière)
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const contexteSession = () => {
    try { return sessionStorage.getItem('dernierScan') } catch { return null }
  }
  const scan = contexteSession()

  const envoyer = async (texte) => {
    const msg = (texte || input).trim()
    if (!msg) return
    setInput('')
    const newMessages = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const contexte   = inclureContexte ? scan : null
      const historique = newMessages.slice(1, -1).map(m => ({ role: m.role, content: m.content }))
      const res  = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, contexte, historique }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'model', content: data.reponse || t('assistant.noResponse') }])
    } catch {
      setMessages(prev => [...prev, { role: 'model', content: t('assistant.connError') }])
    } finally {
      setLoading(false)
    }
  }

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = 'fr-FR'
    r.continuous = false
    r.interimResults = false
    r.onresult = e => { setInput(e.results[0][0].transcript); setListening(false) }
    r.onerror  = () => setListening(false)
    r.onend    = () => setListening(false)
    recognitionRef.current = r
    r.start()
    setListening(true)
  }

  const stopVoice = () => { recognitionRef.current?.stop(); setListening(false) }
  const reset = () => setMessages([{ role: 'model', content: t('assistant.welcome') }])

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer() }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{t('assistant.title')}</h1>
          <p className="text-slate-500">{t('assistant.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Colonne gauche : questions suggérées ── */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Sparkles size={16} className="text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-700">{t('assistant.faq')}</h3>
              </div>
              <div className="space-y-2">
                {QUESTIONS_SUGGEREES.map((q, i) => (
                  <button key={i} onClick={() => envoyer(q)}
                    className="w-full text-left text-sm text-slate-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2.5 rounded-xl transition border border-transparent hover:border-blue-100 leading-snug">
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Contexte de session — activable à la demande */}
            {scan && (
              <div className={`rounded-2xl p-4 border transition ${inclureContexte ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t('assistant.contextTitle')}</p>
                  <button
                    onClick={() => setInclureContexte(v => !v)}
                    role="switch" aria-checked={inclureContexte}
                    className={`relative w-10 h-5 rounded-full transition flex-shrink-0 ${inclureContexte ? 'bg-blue-600' : 'bg-slate-300'}`}
                    title={inclureContexte ? 'Désactiver le contexte' : 'Activer le contexte'}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${inclureContexte ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{scan}</p>
                <p className={`text-xs mt-2 ${inclureContexte ? 'text-blue-500' : 'text-slate-400'}`}>
                  {inclureContexte
                    ? t('assistant.contextActive')
                    : t('assistant.contextInactive')}
                </p>
              </div>
            )}
          </div>

          {/* ── Colonne droite : interface chat ── */}
          <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" style={{ height: '70vh', minHeight: '500px' }}>

            {/* Chat header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold">{t('assistant.title')}</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <p className="text-blue-200 text-xs">{t('assistant.poweredBy')}</p>
                  </div>
                </div>
              </div>
              <button onClick={reset} title="Réinitialiser la conversation"
                className="flex items-center gap-1.5 text-white/80 hover:text-white hover:bg-white/10 px-3 py-2 rounded-xl transition text-sm">
                <RotateCcw size={15} /> {t('assistant.reset')}
              </button>
            </div>

            {/* Messages */}
            <div ref={messagesRef} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm
                    ${m.role === 'user' ? 'bg-blue-700' : 'bg-gradient-to-br from-blue-100 to-cyan-100'}`}>
                    {m.role === 'user'
                      ? <User size={16} className="text-white" />
                      : <Bot size={16} className="text-blue-600" />
                    }
                  </div>
                  {/* Bulle */}
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                    ${m.role === 'user'
                      ? 'bg-blue-700 text-white rounded-tr-sm whitespace-pre-wrap'
                      : 'bg-slate-50 border border-slate-200 text-slate-700 rounded-tl-sm'
                    }`}>
                    {m.role === 'user'
                      ? m.content
                      : <ChatMarkdown>{m.content}</ChatMarkdown>}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center">
                    <Bot size={16} className="text-blue-600" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-5 py-4 rounded-2xl rounded-tl-sm flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-2 h-2 bg-blue-400 rounded-full"
                        animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18 }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input zone */}
            <div className="flex-shrink-0 p-4 border-t border-slate-100 bg-white">
              <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3 focus-within:border-blue-400 transition">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('assistant.placeholder')}
                  rows={2}
                  className="flex-1 bg-transparent text-sm text-slate-700 resize-none outline-none placeholder-slate-400 leading-5"
                  style={{ maxHeight: '120px' }}
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={listening ? stopVoice : startVoice}
                    className={`p-2 rounded-xl transition ${listening
                      ? 'bg-red-100 text-red-600 animate-pulse'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}
                    title={listening ? 'Arrêter l\'écoute' : 'Parler'}>
                    {listening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button
                    onClick={() => envoyer()}
                    disabled={!input.trim() || loading}
                    className="p-2 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                    <Send size={18} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                {t('assistant.disclaimer')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

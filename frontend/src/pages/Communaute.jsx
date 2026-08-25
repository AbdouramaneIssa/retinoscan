import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, LogOut, Users, Share2, Lock, Eye, ImagePlus, X } from 'lucide-react'
import i18n from '../i18n'
import { auth, db } from '../firebase'
import { fileToCompressedDataUrl } from '../utils/image'
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, onAuthStateChanged
} from 'firebase/auth'
import {
  collection, addDoc, onSnapshot, orderBy,
  query, limit, serverTimestamp
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/LoadingSpinner'

function getInitiales(nom) {
  return (nom || 'A').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function hashCouleur(str) {
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-cyan-500', 'bg-amber-500', 'bg-pink-500']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function tempsRelatif(ts) {
  if (!ts) return ''
  const diff = (Date.now() - ts.toDate().getTime()) / 1000
  if (diff < 60)   return i18n.t('community.timeNow')
  if (diff < 3600) return i18n.t('community.timeMin', { n: Math.floor(diff / 60) })
  if (diff < 86400) return i18n.t('community.timeHour', { n: Math.floor(diff / 3600) })
  return ts.toDate().toLocaleDateString(i18n.language)
}

/* ── Formulaire de connexion ── */
function LoginCard({ onLogin }) {
  const { t } = useTranslation()
  const [form, setForm]       = useState({ nom: '', email: '', mdp: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.nom || !form.email || !form.mdp) return toast.error(t('community.tFillAll'))
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, form.email, form.mdp)
      toast.success(t('community.tWelcome', { name: cred.user.displayName || form.nom }))
      onLogin(cred.user)
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          const cred = await createUserWithEmailAndPassword(auth, form.email, form.mdp)
          await updateProfile(cred.user, { displayName: form.nom })
          toast.success(t('community.tAccountCreated', { name: form.nom }))
          onLogin(cred.user)
        } catch (err2) {
          toast.error(err2.message || t('community.tCreateError'))
        }
      } else {
        toast.error(err.message || t('community.tWrongCreds'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Users size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{t('community.loginTitle')}</h2>
          <p className="text-slate-500 text-sm">{t('community.loginSubtitle')}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('community.name')}</label>
            <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder={t('community.namePlaceholder')}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('community.email')}</label>
            <input value={form.email} onChange={e => set('email', e.target.value)} type="email" placeholder={t('community.emailPlaceholder')}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{t('community.password')}</label>
            <input value={form.mdp} onChange={e => set('mdp', e.target.value)} type="password" placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <button onClick={submit} disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl transition">
            {loading ? <LoadingSpinner size="sm" /> : <Users size={18} />}
            {loading ? t('community.connecting') : t('community.join')}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5 flex items-center justify-center gap-1">
          <Lock size={12} /> {t('community.autoCreate')}
        </p>
      </motion.div>
    </div>
  )
}

/* ── Interface chat ── */
function ChatInterface({ user, onLogout }) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [partagerScan, setPartagerScan] = useState(false)
  const [imageData, setImageData] = useState(null)
  const fileRef = useRef(null)
  const bottomRef = useRef(null)

  const choisirImage = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 10 * 1024 * 1024) return toast.error(t('community.imageTooLarge'))
    try { setImageData(await fileToCompressedDataUrl(f)) }
    catch { toast.error(t('community.tSendError')) }
  }

  const dernierScan = (() => {
    try { return sessionStorage.getItem('dernierScan') } catch { return null }
  })()

  useEffect(() => {
    localStorage.setItem('lastVisitCommunaute', new Date().toISOString())
    const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'), limit(100))
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const envoyer = async (scanData = null) => {
    const msg = input.trim()
    if (!msg && !scanData && !imageData) return
    setLoading(true)
    setInput('')
    const img = imageData
    setImageData(null)
    try {
      await addDoc(collection(db, 'messages'), {
        authorName: user.displayName || user.email,
        authorId:   user.uid,
        content:    scanData ? `${t('community.scanPrefix')}${scanData}` : msg,
        image:      img || null,
        timestamp:  serverTimestamp(),
        scan:       scanData ? { info: scanData } : null,
      })
    } catch { toast.error(t('community.tSendError')) }
    finally { setLoading(false) }
  }

  const partager = () => {
    if (!dernierScan) return toast.error(t('community.tNoScan'))
    envoyer(dernierScan)
    setPartagerScan(false)
    toast.success(t('community.tScanShared'))
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ height: '75vh' }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold">{t('community.chatTitle')}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <p className="text-blue-200 text-xs">{t('community.messagesCount', { count: messages.length })}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 ${hashCouleur(user.displayName || '')} rounded-xl flex items-center justify-center text-white text-xs font-bold`}>
                  {getInitiales(user.displayName || user.email)}
                </div>
                <span className="text-white text-sm font-medium hidden sm:block">{user.displayName || user.email}</span>
              </div>
              <button onClick={onLogout} title={t('community.logout')}
                className="p-2 hover:bg-white/10 text-white/80 hover:text-white rounded-xl transition">
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-hide">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Users size={40} className="mb-3 opacity-30" />
                <p className="font-medium">{t('community.noMessages')}</p>
                <p className="text-sm">{t('community.beFirst')}</p>
              </div>
            )}
            {messages.map((m) => {
              const isMe = m.authorId === user.uid
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-9 h-9 ${hashCouleur(m.authorName || '')} rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                    {getInitiales(m.authorName)}
                  </div>
                  <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className="flex items-center gap-2">
                      {!isMe && <span className="text-xs font-semibold text-slate-600">{m.authorName}</span>}
                      <span className="text-xs text-slate-400">{tempsRelatif(m.timestamp)}</span>
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm
                      ${isMe ? 'bg-blue-700 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-700 rounded-tl-sm'}`}>
                      {m.content && <span className="whitespace-pre-wrap">{m.content}</span>}
                      {(m.image || m.scan?.image) && (
                        <img src={m.image || m.scan.image} alt={t('community.sharedImage')}
                          className={`rounded-xl max-h-64 w-auto object-contain border ${isMe ? 'border-white/20' : 'border-slate-200'} ${m.content ? 'mt-2' : ''}`} />
                      )}
                      {m.scan && (
                        <div className={`mt-2 p-2 rounded-xl text-xs ${isMe ? 'bg-white/20' : 'bg-white border border-slate-200'}`}>
                          <span className="flex items-center gap-1"><Eye size={11} /> {t('community.scanShared')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Zone de saisie */}
          <div className="flex-shrink-0 p-4 border-t border-slate-100 bg-white">
            {dernierScan && (
              <div className="mb-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                <span className="text-sm text-blue-700">{t('community.haveScan')}</span>
                <button onClick={partager}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-3 py-1.5 rounded-lg transition">
                  <Share2 size={13} /> {t('community.share')}
                </button>
              </div>
            )}
            {/* Aperçu de l'image à envoyer */}
            {imageData && (
              <div className="mb-3 relative inline-block">
                <img src={imageData} alt="" className="h-24 rounded-xl border border-slate-200 object-cover" />
                <button onClick={() => setImageData(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition">
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-blue-400 transition">
              <input ref={fileRef} type="file" accept="image/*" onChange={choisirImage} className="hidden" />
              <button onClick={() => fileRef.current?.click()} title={t('community.attachImage')}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded-xl transition flex-shrink-0">
                <ImagePlus size={18} />
              </button>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && envoyer()}
                placeholder={t('community.inputPlaceholder')}
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder-slate-400" />
              <button onClick={() => envoyer()} disabled={(!input.trim() && !imageData) || loading}
                className="p-2 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Page principale ── */
export default function Communaute() {
  const { t } = useTranslation()
  const [user, setUser]         = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setChecking(false) })
    return unsub
  }, [])

  const logout = async () => {
    await signOut(auth)
    setUser(null)
    toast.success(t('community.tLogout'))
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" text={t('community.checking')} />
    </div>
  )

  if (!user) return <LoginCard onLogin={setUser} />
  return <ChatInterface user={user} onLogout={logout} />
}

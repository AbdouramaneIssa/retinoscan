import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, Activity, Heart, Upload, X, User, Mail, AlertCircle, Stethoscope, Sparkles, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { db, storage } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { BACKEND_URL } from '../constants'
import { fileToCompressedDataUrl } from '../utils/image'
import ResultatRetino from '../components/ResultatRetino'
import ResultatRisque from '../components/ResultatRisque'
import LoadingSpinner from '../components/LoadingSpinner'

const TABS = [
  { id: 'retino',  key: 'tabRetino', icon: Eye },
  { id: 'diabete', key: 'tabDiab',   icon: Activity },
  { id: 'hta',     key: 'tabHta',    icon: Heart },
]

function Toggle2({ value, onChange, labelOff, labelOn }) {
  const { t } = useTranslation()
  labelOff = labelOff || t('diag.anon')
  labelOn = labelOn || t('diag.withInfo')
  return (
    <div className="flex items-center gap-3 bg-slate-100 rounded-xl p-1 w-fit">
      <button onClick={() => onChange(false)}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${!value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
        🔒 {labelOff}
      </button>
      <button onClick={() => onChange(true)}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
        👤 {labelOn}
      </button>
    </div>
  )
}

function InfosPatient({ nom, email, onChange }) {
  const { t } = useTranslation()
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      <div className="relative">
        <User size={15} className="absolute left-3 top-3.5 text-slate-400" />
        <input value={nom} onChange={e => onChange('nom', e.target.value)} placeholder={t('diag.patientName')}
          className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white" />
      </div>
      <div className="relative">
        <Mail size={15} className="absolute left-3 top-3.5 text-slate-400" />
        <input value={email} onChange={e => onChange('email', e.target.value)} placeholder={t('diag.patientEmail')} type="email"
          className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white" />
      </div>
    </motion.div>
  )
}

/* ─── Champs réutilisables (définis au niveau module pour ne pas
   être recréés à chaque rendu, ce qui ferait perdre le focus aux inputs) ─── */
function NumberField({ label, value, onChange, placeholder, min, max, step = '1' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min} max={max} step={step}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white" />
    </div>
  )
}

function YesNoField({ label, value, onChange }) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="flex gap-2">
        {[{ v: 0, l: t('diag.no') }, { v: 1, l: t('diag.yes') }].map(({ v, l }) => (
          <button key={v} onClick={() => onChange(v)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition
              ${value === v ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── TAB RÉTINOPATHIE ─── */
function TabRetino() {
  const { t } = useTranslation()
  const [avecInfos, setAvecInfos] = useState(false)
  const [infos, setInfos]         = useState({ nom: '', email: '' })
  const [image, setImage]         = useState(null)
  const [preview, setPreview]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [resultat, setResultat]   = useState(null)

  const onDrop = useCallback(files => {
    const f = files[0]
    if (!f) return
    setImage(f)
    setPreview(URL.createObjectURL(f))
    setResultat(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png'] }, maxFiles: 1
  })

  const analyser = async () => {
    if (!image) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', image)
      const res  = await fetch(`${BACKEND_URL}/predict/retinopathie`, { method: 'POST', body: formData })
      const data = await res.json()
      setResultat(data)

      // Stocker en session pour le chatbot
      if (data.valide) {
        sessionStorage.setItem('dernierScan', `Le patient présente une ${data.label} (stade ${data.stade}), confiance ${data.confiance}%.`)
        toast.success(t('diag.tStadeDetected', { stade: data.stade, label: data.label }))
      } else {
        toast.error(data.message)
      }

      // Sauvegarder dans Firestore
      await addDoc(collection(db, 'consultations'), {
        type: 'retinopathie',
        anonyme: !avecInfos,
        nomPatient: avecInfos ? infos.nom || 'Patient' : 'Anonyme',
        emailPatient: avecInfos ? infos.email : null,
        date: serverTimestamp(),
        resultat: data,
      })
    } catch (e) {
      toast.error(t('diag.tConnError'))
    } finally {
      setLoading(false)
    }
  }

  const envoyerRapport = async () => {
    if (!infos.email) return toast.error(t('diag.tEmailRequired'))
    const tid = toast.loading(t('diag.tGenPdf'))
    try {
      const res = await fetch(`${BACKEND_URL}/rapport/envoyer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom_patient: infos.nom, email_patient: infos.email,
          date_analyse: new Date().toLocaleDateString('fr-FR'), resultat_retinopathie: resultat }),
      })
      await res.json()
      toast.success(t('diag.tPdfSent'), { id: tid })
    } catch { toast.error(t('diag.tSendError'), { id: tid }) }
  }

  const partagerCommunaute = async () => {
    if (!resultat?.valide) return
    try {
      // On joint l'image du fond d'œil (compressée en base64) au partage
      let img = null
      if (image) { try { img = await fileToCompressedDataUrl(image) } catch {} }
      await addDoc(collection(db, 'messages'), {
        authorName: 'Médecin', authorId: 'anon',
        content: `📊 Scan partagé : ${resultat.label} (Stade ${resultat.stade}, confiance ${resultat.confiance}%)`,
        image: img,
        timestamp: serverTimestamp(),
        scan: { stade: resultat.stade, label: resultat.label, confiance: resultat.confiance, image: img },
      })
      toast.success(t('diag.tShared'))
    } catch { toast.error(t('diag.tShareError')) }
  }

  const ouvrirChat = () => {
    window.dispatchEvent(new CustomEvent('openChatbot'))
    toast(t('diag.tChatOpened'), { icon: '💬' })
  }

  return (
    <div>
      <Toggle2 value={avecInfos} onChange={setAvecInfos} />
      <AnimatePresence>
        {avecInfos && <InfosPatient nom={infos.nom} email={infos.email} onChange={(k, v) => setInfos(p => ({ ...p, [k]: v }))} />}
      </AnimatePresence>

      {/* Dropzone */}
      <div className="mt-6">
        {!preview ? (
          <div {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/30 bg-slate-50'}`}>
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload size={28} className="text-blue-600" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">{isDragActive ? t('diag.dropActive') : t('diag.dropIdle')}</p>
            <p className="text-sm text-slate-500">{t('diag.or')}<span className="text-blue-600 font-medium">{t('diag.browse')}</span></p>
            <p className="text-xs text-slate-400 mt-2">{t('diag.dropHint')}</p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
            <img src={preview} alt="Aperçu" className="w-full max-h-64 object-contain p-2" />
            <button onClick={() => { setImage(null); setPreview(null); setResultat(null) }}
              className="absolute top-3 right-3 bg-red-500 text-white rounded-xl p-1.5 hover:bg-red-600 transition shadow">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      <button onClick={analyser} disabled={!image || loading}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition text-base">
        {loading ? <LoadingSpinner size="sm" /> : <Eye size={20} />}
        {loading ? t('diag.analyzing') : t('diag.analyze')}
      </button>

      {loading && (
        <div className="mt-6 flex flex-col items-center gap-3 py-6">
          <LoadingSpinner size="lg" text={t('diag.analyzingTitle')} />
          <p className="text-sm text-slate-400 text-center">{t('diag.analyzingSub')}</p>
        </div>
      )}

      <ResultatRetino resultat={resultat} avecInfos={avecInfos}
        onChat={ouvrirChat} onShare={partagerCommunaute} onRapport={envoyerRapport} />
    </div>
  )
}

/* ─── TAB DIABÈTE ─── */
function TabDiabete() {
  const { t } = useTranslation()
  const [avecInfos, setAvecInfos] = useState(false)
  const [infos, setInfos]         = useState({ nom: '', email: '' })
  const [form, setForm]           = useState({ gender: 'Male', age: '', hypertension: 0, heart_disease: 0, smoking_history: 'never', bmi: '', HbA1c_level: '', blood_glucose_level: '' })
  const [loading, setLoading]     = useState(false)
  const [resultat, setResultat]   = useState(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const evaluer = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${BACKEND_URL}/predict/diabete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, age: +form.age, bmi: +form.bmi, HbA1c_level: +form.HbA1c_level, blood_glucose_level: +form.blood_glucose_level }),
      })
      const data = await res.json()
      setResultat(data)
      toast.success(t('diag.tPrediction', { label: data.label }))
      await addDoc(collection(db, 'consultations'), {
        type: 'diabete', anonyme: !avecInfos,
        nomPatient: avecInfos ? infos.nom || 'Patient' : 'Anonyme',
        emailPatient: avecInfos ? infos.email : null,
        date: serverTimestamp(), resultat: data,
      })
    } catch { toast.error(t('diag.tServerError')) }
    finally { setLoading(false) }
  }

  const partager = async () => {
    if (!resultat) return
    try {
      await addDoc(collection(db, 'messages'), {
        authorName: 'Médecin', authorId: 'anon',
        content: `🩺 ${t('diag.tabDiab')} — ${resultat.label} (${resultat.probabilite}%)`,
        timestamp: serverTimestamp(),
        scan: { type: 'diabete', label: resultat.label, probabilite: resultat.probabilite },
      })
      toast.success(t('diag.tShared'))
    } catch { toast.error(t('diag.tShareError')) }
  }

  return (
    <div>
      <Toggle2 value={avecInfos} onChange={setAvecInfos} />
      <AnimatePresence>
        {avecInfos && <InfosPatient nom={infos.nom} email={infos.email} onChange={(k, v) => setInfos(p => ({ ...p, [k]: v }))} />}
      </AnimatePresence>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{t('diag.sexe')}</label>
          <select value={form.gender} onChange={e => set('gender', e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white">
            <option value="Male">{t('diag.male')}</option><option value="Female">{t('diag.female')}</option><option value="Other">{t('diag.other')}</option>
          </select>
        </div>
        <NumberField label={t('diag.age')} value={form.age} onChange={v => set('age', v)} min="0" max="120" step="1" placeholder="Ex: 45" />
        <NumberField label={t('diag.hba1c')} value={form.HbA1c_level} onChange={v => set('HbA1c_level', v)} min="3" max="15" step="0.1" placeholder="Ex: 6.5" />
        <NumberField label={t('diag.glycemia')} value={form.blood_glucose_level} onChange={v => set('blood_glucose_level', v)} min="50" max="500" step="1" placeholder="Ex: 126" />
        <NumberField label={t('diag.bmi')} value={form.bmi} onChange={v => set('bmi', v)} min="10" max="70" step="0.1" placeholder="Ex: 28.5" />
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{t('diag.smoking')}</label>
          <select value={form.smoking_history} onChange={e => set('smoking_history', e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white">
            {['never', 'former', 'current', 'ever', 'not current', 'No Info'].map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <YesNoField label={t('diag.htaKnown')} value={form.hypertension} onChange={v => set('hypertension', v)} />
        <YesNoField label={t('diag.heartDisease')} value={form.heart_disease} onChange={v => set('heart_disease', v)} />
      </div>

      <button onClick={evaluer} disabled={loading}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition">
        {loading ? <LoadingSpinner size="sm" /> : <Activity size={20} />}
        {loading ? t('diag.evaluating') : t('diag.evalDiab')}
      </button>

      {resultat && (
        <>
          <ResultatRisque type="diabete" resultat={resultat} onShare={partager} />
          {resultat.probabilite > 70 && (
            <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-100 rounded-xl p-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {t('diag.riskHigh')}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── TAB HTA / CHD ─── */
function TabHTA() {
  const { t } = useTranslation()
  const [avecInfos, setAvecInfos] = useState(false)
  const [infos, setInfos]         = useState({ nom: '', email: '' })
  const [form, setForm]           = useState({
    male: 1, age: '', education: 2, currentSmoker: 0, cigsPerDay: 0,
    BPMeds: 0, prevalentStroke: 0, diabetes: 0, totChol: '', BMI: '',
    heartRate: '', glucose: '', sysBP: '', diaBP: '',
  })
  const [loading, setLoading]   = useState(false)
  const [resultat, setResultat] = useState(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const evaluer = async () => {
    setLoading(true)
    try {
      const htaRes = await fetch(`${BACKEND_URL}/predict/hypertension`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, age: +form.age, totChol: +form.totChol, BMI: +form.BMI, heartRate: +form.heartRate, glucose: +form.glucose }),
      })
      const htaData = await htaRes.json()

      const chdRes = await fetch(`${BACKEND_URL}/predict/chd`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, age: +form.age, totChol: +form.totChol, BMI: +form.BMI, heartRate: +form.heartRate,
          glucose: +form.glucose, sysBP: +form.sysBP, diaBP: +form.diaBP, prevalentHyp: htaData.prediction }),
      })
      const chdData = await chdRes.json()

      setResultat({ hta: htaData, chd: chdData })
      toast.success(t('diag.tCardioDone'))
      await addDoc(collection(db, 'consultations'), {
        type: 'hypertension_chd', anonyme: !avecInfos,
        nomPatient: avecInfos ? infos.nom || 'Patient' : 'Anonyme',
        emailPatient: avecInfos ? infos.email : null,
        date: serverTimestamp(), resultat: { hta: htaData, chd: chdData },
      })
    } catch { toast.error(t('diag.tServerError')) }
    finally { setLoading(false) }
  }

  const partager = async () => {
    if (!resultat) return
    try {
      await addDoc(collection(db, 'messages'), {
        authorName: 'Médecin', authorId: 'anon',
        content: `❤️ ${resultat.hta.label} (${resultat.hta.probabilite}%) · ${resultat.chd.label} (${resultat.chd.probabilite}%)`,
        timestamp: serverTimestamp(),
        scan: { type: 'hypertension_chd', hta: resultat.hta, chd: resultat.chd },
      })
      toast.success(t('diag.tShared'))
    } catch { toast.error(t('diag.tShareError')) }
  }

  return (
    <div>
      <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        {t('diag.htaNote')}
      </div>

      <Toggle2 value={avecInfos} onChange={setAvecInfos} />
      <AnimatePresence>
        {avecInfos && <InfosPatient nom={infos.nom} email={infos.email} onChange={(k, v) => setInfos(p => ({ ...p, [k]: v }))} />}
      </AnimatePresence>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{t('diag.sexe')}</label>
          <div className="flex gap-2">
            {[{ v: 1, l: t('diag.male') }, { v: 0, l: t('diag.female') }].map(({ v, l }) => (
              <button key={v} onClick={() => set('male', v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition
                  ${form.male === v ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <NumberField label={t('diag.ageShort')} value={form.age} onChange={v => set('age', v)} min="0" max="120" placeholder="Ex: 55" />
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{t('diag.education')}</label>
          <select value={form.education} onChange={e => set('education', +e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white">
            <option value={1}>{t('diag.edu1')}</option><option value={2}>{t('diag.edu2')}</option>
            <option value={3}>{t('diag.edu3')}</option><option value={4}>{t('diag.edu4')}</option>
          </select>
        </div>
        <YesNoField label={t('diag.smokerNow')} value={form.currentSmoker} onChange={v => set('currentSmoker', v)} />
        {form.currentSmoker === 1 && <NumberField label={t('diag.cigsDay')} value={form.cigsPerDay} onChange={v => set('cigsPerDay', v)} min="0" max="100" placeholder="Ex: 10" />}
        <YesNoField label={t('diag.bpMeds')} value={form.BPMeds} onChange={v => set('BPMeds', v)} />
        <YesNoField label={t('diag.stroke')} value={form.prevalentStroke} onChange={v => set('prevalentStroke', v)} />
        <YesNoField label={t('diag.diabetesKnown')} value={form.diabetes} onChange={v => set('diabetes', v)} />
        <NumberField label={t('diag.totChol')} value={form.totChol} onChange={v => set('totChol', v)} min="100" max="600" placeholder="Ex: 220" />
        <NumberField label={t('diag.bmi')} value={form.BMI} onChange={v => set('BMI', v)} min="10" max="70" step="0.1" placeholder="Ex: 27.5" />
        <NumberField label={t('diag.heartRate')} value={form.heartRate} onChange={v => set('heartRate', v)} min="30" max="200" placeholder="Ex: 75" />
        <NumberField label={t('diag.glycemia')} value={form.glucose} onChange={v => set('glucose', v)} min="50" max="500" placeholder="Ex: 90" />
        <NumberField label={t('diag.sysBP')} value={form.sysBP} onChange={v => set('sysBP', v)} min="80" max="300" placeholder="Ex: 130" />
        <NumberField label={t('diag.diaBP')} value={form.diaBP} onChange={v => set('diaBP', v)} min="40" max="200" placeholder="Ex: 85" />
      </div>

      <button onClick={evaluer} disabled={loading}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl transition">
        {loading ? <LoadingSpinner size="sm" /> : <Heart size={20} />}
        {loading ? t('diag.evaluating') : t('diag.evalCardio')}
      </button>

      {resultat && (
        <div>
          <div className="mt-6 mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">{t('diag.resHta')}</div>
          <ResultatRisque type="hta" resultat={resultat.hta} />
          <div className="mt-6 mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">{t('diag.resChd')}</div>
          <ResultatRisque type="chd" resultat={resultat.chd} onShare={partager} />
        </div>
      )}
    </div>
  )
}

/* ─── PAGE PRINCIPALE ─── */
export default function Diagnostic() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('retino')

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg mb-4">
            <Stethoscope size={30} className="text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2">{t('diag.title')}</h1>
          <p className="text-slate-500 max-w-md mx-auto">{t('diag.subtitle')}</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Sparkles size={13} className="text-blue-500" /> EfficientNet · XGBoost</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} className="text-blue-500" /> {t('diag.tagSupport')}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 mb-6 shadow-sm">
          {TABS.map(({ id, key, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all
                ${tab === id ? 'bg-blue-700 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon size={16} /> <span className="hidden sm:inline">{t(`diag.${key}`)}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              {tab === 'retino'  && <TabRetino />}
              {tab === 'diabete' && <TabDiabete />}
              {tab === 'hta'     && <TabHTA />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

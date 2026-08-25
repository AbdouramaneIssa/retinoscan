import { useTranslation } from 'react-i18next'

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// Styles visuels des stades (indépendants de la langue)
export const STADE_STYLES = {
  0: { couleur: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', urgenceBadge: 'bg-emerald-100 text-emerald-700' },
  1: { couleur: '#f59e0b', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',     urgenceBadge: 'bg-amber-100 text-amber-700' },
  2: { couleur: '#f97316', bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',   urgenceBadge: 'bg-orange-100 text-orange-700' },
  3: { couleur: '#ef4444', bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',         urgenceBadge: 'bg-red-100 text-red-700' },
  4: { couleur: '#8b5cf6', bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700',   urgenceBadge: 'bg-violet-100 text-violet-700' },
}

// Hook : renvoie les stades avec le texte traduit + les styles
export function useStades() {
  const { t } = useTranslation()
  const build = (n, recoCount) => ({
    ...STADE_STYLES[n],
    label: t(`stades.s${n}label`),
    shortLabel: t(`stades.s${n}short`),
    urgence: t(`stades.s${n}urg`),
    description: t(`stades.s${n}desc`),
    recommandations: Array.from({ length: recoCount }, (_, i) => t(`stades.s${n}r${i + 1}`)),
  })
  return { 0: build(0, 4), 1: build(1, 4), 2: build(2, 4), 3: build(3, 4), 4: build(4, 5) }
}

// Hook : questions suggérées traduites
export function useQuestions() {
  const { t } = useTranslation()
  return Array.from({ length: 10 }, (_, i) => t(`questions.q${i + 1}`))
}

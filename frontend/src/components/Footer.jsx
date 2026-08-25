import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, Heart } from 'lucide-react'

export default function Footer() {
  const { t } = useTranslation()
  const links = [['/', 'home'], ['/diagnostic', 'diagnostic'], ['/assistant', 'assistant'], ['/dashboard', 'dashboard'], ['/communaute', 'community']]
  return (
    <footer className="bg-slate-900 text-slate-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                <Eye size={16} className="text-white" />
              </div>
              <span className="text-white font-bold text-lg">RetinoScan <span className="text-cyan-400">CM</span></span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {t('footer.tagline')}
            </p>
          </div>
          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('footer.navigation')}</h4>
            <div className="flex flex-col gap-2 text-sm">
              {links.map(([to, key]) => (
                <Link key={to} to={to} className="hover:text-cyan-400 transition">{t(`nav.${key}`)}</Link>
              ))}
            </div>
          </div>
          {/* Info */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('footer.disclaimerTitle')}</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              {t('footer.disclaimerText')}
            </p>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} RetinoScan CM — {t('footer.rights')}</span>
          <span className="flex items-center gap-1">{t('footer.madeWithA')} <Heart size={13} className="text-red-400 mx-1" /> {t('footer.madeWithB')}</span>
        </div>
      </div>
    </footer>
  )
}

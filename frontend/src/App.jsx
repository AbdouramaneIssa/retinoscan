import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ChatbotWidget from './components/ChatbotWidget'
import InstallPWA from './components/InstallPWA'
import Accueil from './pages/Accueil'
import Diagnostic from './pages/Diagnostic'
import Assistant from './pages/Assistant'
import Dashboard from './pages/Dashboard'
import Communaute from './pages/Communaute'

// Remet la page tout en haut à chaque changement de route
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontFamily: 'Inter, sans-serif', fontSize: '14px', borderRadius: '12px' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/"            element={<Accueil />} />
            <Route path="/diagnostic"  element={<Diagnostic />} />
            <Route path="/assistant"   element={<Assistant />} />
            <Route path="/dashboard"   element={<Dashboard />} />
            <Route path="/communaute"  element={<Communaute />} />
          </Routes>
        </main>
        <Footer />
        <ChatbotWidget />
        <InstallPWA />
      </div>
    </BrowserRouter>
  )
}

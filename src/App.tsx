import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SEOHead from './components/SEOHead';
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Gallery from './pages/Gallery';
import Marketplace from './pages/Marketplace';
import TokenShop from './pages/TokenShop';
import Faucet from './pages/Faucet';
import Leaderboard from './pages/Leaderboard';
import Rankings from './pages/Rankings';
import AdminPanel from './pages/AdminPanel';

const SUPPORTED = ['en', 'bg', 'es'] as const;
type Lang = (typeof SUPPORTED)[number];

function LangWrapper() {
  const { lang } = useParams();
  const { i18n } = useTranslation();
  const valid = SUPPORTED.includes(lang as Lang);

  useEffect(() => {
    if (valid && i18n.language !== lang) i18n.changeLanguage(lang!);
  }, [lang, valid, i18n]);

  if (!valid) return <Navigate to="/en" replace />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <SEOHead />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/en" replace />} />
      <Route path="/:lang" element={<LangWrapper />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="shop" element={<TokenShop />} />
        <Route path="faucet" element={<Faucet />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="rankings" element={<Rankings />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/en" replace />} />
    </Routes>
  );
}

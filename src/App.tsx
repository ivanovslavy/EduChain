import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from './components/Navbar';
import SafetyBanner from './components/SafetyBanner';
import NetworkBanner from './components/NetworkBanner';
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
import Certificates from './certificates/Certificates';
import Verify from './certificates/Verify';
import Partnership from './pages/Partnership';
import Teachers from './pages/Teachers';
import Curriculum from './pages/Curriculum';
import Demo from './pages/Demo';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Philosophy from './pages/Philosophy';

const SUPPORTED = ['en', 'bg', 'es'] as const;
type Lang = (typeof SUPPORTED)[number];

function PhilosophyRedirect() {
  const { lang = 'en' } = useParams();
  return <Navigate to={`/${lang}/philosophy`} replace />;
}

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
      <NetworkBanner />
      <SafetyBanner />
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
        <Route path="partnership" element={<Partnership />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="curriculum" element={<Curriculum />} />
        <Route path="demo" element={<Demo />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="shop" element={<TokenShop />} />
        <Route path="faucet" element={<Faucet />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="rankings" element={<Rankings />} />
        {/* Certificates: the exam sits behind a connected wallet (PageGate inside the page);
            /verify is deliberately PUBLIC — anybody must be able to check a certificate. */}
        <Route path="certificates" element={<Certificates />} />
        <Route path="verify" element={<Verify />} />
        <Route path="verify/:serial" element={<Verify />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="philosophy" element={<Philosophy />} />
        <Route path="ethereum-foundation" element={<PhilosophyRedirect />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/en" replace />} />
    </Routes>
  );
}

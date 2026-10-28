/** Compose only finished discovery routes and refresh identity on navigation. */
import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { getSession } from './utils/auth.js';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import LandingPage from './pages/LandingPage.jsx';

/** Give every unmatched destination a real, accessible route back to discovery. */
function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto min-h-[70dvh] max-w-6xl px-4 py-20 sm:px-6">
      <p className="font-medium text-indigo-700">404</p>
      <h1 className="mt-4 font-display text-4xl font-bold">Page not found</h1>
      <p className="mt-5 text-slate-600">This address does not have a page. Return to WriteSpace to explore.</p>
      <Link to="/" className="mt-8 inline-block rounded-full bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
        Back to WriteSpace
      </Link>
    </main>
  );
}

/** Re-read the session whenever the route changes, including after later account entry. */
export default function App() {
  const location = useLocation();
  const [session, setCurrentSession] = useState(getSession);
  useEffect(() => { setCurrentSession(getSession()); }, [location]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-slate-800">
      <PublicNavbar session={session} />
      <Routes>
        <Route path="/" element={<LandingPage key={location.key} session={session} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

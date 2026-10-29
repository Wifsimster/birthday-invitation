import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import BuildFooter from './components/BuildFooter.jsx';
import { Toaster } from '@/components/ui/sonner';
import Invitation from './views/Invitation.jsx';
import Admin from './views/Admin.jsx';
import Auth from './views/Auth.jsx';
import { ensureSession, refresh } from './session.js';

function Guard({ children }) {
  const location = useLocation();
  const [resolved, setResolved] = useState(false);
  const [redirect, setRedirect] = useState(null);

  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let user = await ensureSession();
      if (!user) user = await refresh();
      if (cancelled) return;

      const { pathname, search } = locationRef.current;
      const fullPath = `${pathname}${search}`;
      if (!user) {
        setRedirect(fullPath === '/admin' ? '/login' : `/login?redirect=${encodeURIComponent(fullPath)}`);
      } else {
        setRedirect(null);
      }
      setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (!resolved) return null;
  if (redirect) return <Navigate to={redirect} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Invitation />} />
        <Route path="/e/:slug" element={<Invitation />} />
        <Route
          path="/admin"
          element={
            <Guard>
              <Admin />
            </Guard>
          }
        />
        <Route path="/login" element={<Auth mode="signin" />} />
        <Route path="/register" element={<Auth mode="signup" />} />
        <Route path="/forgot-password" element={<Auth mode="forgot" />} />
        <Route path="/reset-password" element={<Auth mode="reset" />} />
        <Route path="/pending" element={<Navigate to="/admin" replace />} />
      </Routes>
      <BuildFooter />
      <Toaster position="bottom-center" offset={8} richColors closeButton />
    </BrowserRouter>
  );
}

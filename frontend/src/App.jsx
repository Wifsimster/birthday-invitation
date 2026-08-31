import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import BuildFooter from './components/BuildFooter.jsx';
import { Toaster } from '@/components/ui/sonner';
import Invitation from './views/Invitation.jsx';
import Admin from './views/Admin.jsx';
import Auth from './views/Auth.jsx';
import { ensureSession, refresh } from './session.js';

/**
 * Route guard. The server is the authority — every admin API call is checked
 * again there — but resolving the session up front avoids rendering a dashboard
 * that would only fill with 401s, and routes a registered-but-ungranted account
 * to the pending screen instead of a bare error.
 *
 * `requires` is 'admin' (the console) or 'auth' (the pending screen). Nothing
 * renders until the session resolves, so no view sees a half-known session.
 */
function Guard({ requires, children }) {
  const location = useLocation();
  const [resolved, setResolved] = useState(false);
  const [redirect, setRedirect] = useState(null);

  // The admin console mirrors its selected event and tab into the query string,
  // so the guard keys off the pathname only — re-running it on every tab change
  // would be pointless work. The ref keeps the redirect target current anyway.
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Google sign-in lands back on /admin as a full page load; re-read rather
      // than trust a session resolved before the redirect.
      let user = await ensureSession();
      if (!user && requires === 'admin') user = await refresh();
      if (cancelled) return;

      const { pathname, search } = locationRef.current;
      const fullPath = `${pathname}${search}`;
      if (!user) {
        setRedirect(fullPath === '/admin' ? '/login' : `/login?redirect=${encodeURIComponent(fullPath)}`);
      } else if (requires === 'admin' && user.role !== 'admin') {
        setRedirect('/pending');
      } else if (pathname === '/pending' && user.role === 'admin') {
        // An admin has no reason to sit on the pending screen.
        setRedirect('/admin');
      } else {
        setRedirect(null);
      }
      setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [requires, location.pathname]);

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
            <Guard requires="admin">
              <Admin />
            </Guard>
          }
        />
        <Route path="/login" element={<Auth mode="signin" />} />
        <Route path="/register" element={<Auth mode="signup" />} />
        <Route path="/forgot-password" element={<Auth mode="forgot" />} />
        <Route path="/reset-password" element={<Auth mode="reset" />} />
        <Route
          path="/pending"
          element={
            <Guard requires="auth">
              <Auth mode="pending" />
            </Guard>
          }
        />
      </Routes>
      <BuildFooter />
      {/* One toaster for the whole app: views raise feedback with `toast()`
          from sonner instead of owning a bespoke stack. */}
      <Toaster position="bottom-center" offset={8} richColors closeButton />
    </BrowserRouter>
  );
}

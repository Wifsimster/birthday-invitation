import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authActions } from '../api/auth-actions.js';
import { applySeo } from '../seo.js';
import { authProviders, ensureSession, refresh } from '../session.js';
import CredentialsForm from './auth/CredentialsForm.jsx';
import { CheckEmailPanel, ResetSentPanel } from './auth/MailSentPanel.jsx';
import { authMode } from './auth/modes.js';

const EMPTY_FORM = { name: '', email: '', password: '' };
const DEFAULT_PROVIDERS = { emailPassword: true, google: false };

/**
 * The sign-in card, in all of its flows.
 *
 * The view decides which flow is showing and what each one does next; what the
 * flow looks like is data (auth/modes.js), how it talks to Better Auth is
 * api/auth-actions.js, and the two "check your mail" dead ends are components
 * of their own.
 */
export default function Auth({ mode: routeMode }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Transient mode set after a submit; null means "follow the route".
  const [transientMode, setTransientMode] = useState(null);
  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  const modeId = transientMode ?? routeMode ?? 'signin';
  const mode = authMode(modeId);

  // Set once a new password is stored, so the sign-in form the visitor lands on
  // says why they are being asked to sign in again.
  const passwordWasReset = modeId === 'signin' && searchParams.get('reset') === '1';
  // Better Auth puts the reset token in the query string of the page its emailed
  // link redirects to.
  const resetToken = searchParams.get('token') ?? '';

  // Navigating between /login and /register must clear a stale error and any
  // transient "check your email" state.
  useEffect(() => {
    setTransientMode(null);
    setError(null);
    setNotice(null);
  }, [routeMode]);

  // Sign-in and registration have nothing to offer a search engine. The server
  // shell already sends noindex for these paths (server/src/seo.ts); this keeps
  // the head right across client-side navigation and gives the tab a real name.
  useEffect(() => {
    applySeo({
      title: `${mode.title} | Invitation d'anniversaire`,
      description: mode.subtitle,
      robots: 'noindex, nofollow'
    });
  }, [mode.title, mode.subtitle]);

  useEffect(() => {
    let cancelled = false;
    authProviders().then((p) => {
      if (!cancelled) setProviders(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A visitor arriving on /login who already has a session belongs elsewhere. No
  // route guard runs here, so resolve the session rather than reading a
  // `session.user` that a cold load has never filled in.
  useEffect(() => {
    if (routeMode !== 'signin') return undefined;
    let cancelled = false;
    ensureSession().then((user) => {
      if (!cancelled && user) navigate('/admin', { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [routeMode, navigate]);

  // One place for the loading flag and the error surface, for every action.
  const run = useCallback(async (action) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(err?.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearPassword = () => setForm((prev) => ({ ...prev, password: '' }));

  // Send a freshly signed-in visitor to the page they were headed for. Every
  // account reaches the dashboard — it lists the invitations that account owns —
  // so there is nothing left to sort by role here.
  async function goToDestination() {
    await refresh();
    // Only a path within this app. A leading '//' (or '/\') is a
    // protocol-relative URL, so the bare startsWith('/') test would have let
    // ?redirect=//example.com send a freshly signed-in visitor off-site.
    const target = searchParams.get('redirect');
    navigate(target && /^\/(?![/\\])/.test(target) ? target : '/admin', { replace: true });
  }

  // What each flow does once its action succeeds.
  const SUBMIT = {
    signin: async () => {
      const { verified } = await authActions.signIn(form);
      clearPassword();
      if (!verified) {
        setTransientMode('check-email');
        return;
      }
      await goToDestination();
    },
    signup: async () => {
      await authActions.signUp(form);
      clearPassword();
      setTransientMode('check-email');
    },
    forgot: async () => {
      await authActions.requestPasswordReset(form.email);
      setTransientMode('reset-sent');
    },
    reset: async () => {
      await authActions.resetPassword({ token: resetToken, password: form.password });
      clearPassword();
      navigate('/login?reset=1', { replace: true });
    }
  };

  function submit(event) {
    event.preventDefault();
    const action = SUBMIT[modeId];
    if (action) return run(action);
  }

  function resendVerification() {
    return run(async () => {
      await authActions.resendVerification(form.email);
      setNotice('Email renvoyé.');
    });
  }

  function signInWithGoogle() {
    setError(null);
    setLoading(true);
    authActions.signInWithGoogle().catch(() => {
      setLoading(false);
      setError('La connexion Google a échoué.');
    });
  }

  return (
    <div className="flex min-h-full items-center justify-center px-3 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-10">
      <Card className="w-full max-w-[26rem] shadow-xl">
        <CardHeader className="text-center">
          <span className="mx-auto mb-1 text-4xl" aria-hidden="true">
            🎉
          </span>
          <CardTitle className="text-xl">{mode.title}</CardTitle>
          <CardDescription>{mode.subtitle}</CardDescription>
        </CardHeader>

        {mode.panel === 'check-email' && (
          <CheckEmailPanel email={form.email} busy={loading} notice={notice} onResend={resendVerification} />
        )}

        {mode.panel === 'reset-sent' && <ResetSentPanel email={form.email} />}

        {!mode.panel && (
          <CredentialsForm
            mode={mode}
            form={form}
            onChange={setForm}
            error={error}
            notice={passwordWasReset ? 'Mot de passe modifié. Connectez-vous avec le nouveau.' : null}
            busy={loading}
            googleEnabled={providers.google}
            onSubmit={submit}
            onGoogle={signInWithGoogle}
          />
        )}
      </Card>
    </div>
  );
}

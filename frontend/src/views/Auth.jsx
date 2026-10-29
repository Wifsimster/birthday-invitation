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

export default function Auth({ mode: routeMode }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [transientMode, setTransientMode] = useState(null);
  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  const modeId = transientMode ?? routeMode ?? 'signin';
  const mode = authMode(modeId);

  const passwordWasReset = modeId === 'signin' && searchParams.get('reset') === '1';
  const resetToken = searchParams.get('token') ?? '';

  useEffect(() => {
    setTransientMode(null);
    setError(null);
    setNotice(null);
  }, [routeMode]);

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

  async function goToDestination() {
    await refresh();
    const target = searchParams.get('redirect');
    navigate(target && /^\/(?![/\\])/.test(target) ? target : '/admin', { replace: true });
  }

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

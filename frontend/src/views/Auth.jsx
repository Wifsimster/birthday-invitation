import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlertIcon, EyeIcon, EyeOffIcon, Loader2Icon, MailCheckIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { authClient } from '../auth-client.js';
import { refresh, ensureSession, authProviders } from '../session.js';
import { applySeo } from '../seo.js';

// `check-email` and `reset-sent` are transient states the view enters after a
// successful submit; they have no route of their own so a refresh returns the
// visitor to a form rather than a dead end. Every other mode comes in as a prop
// from the route (see App.jsx).
const COPY = {
  signin: {
    title: 'Connexion',
    subtitle: "Accédez à l'administration des invitations.",
    submit: 'Se connecter',
    busy: 'Connexion...'
  },
  signup: {
    title: 'Créer un compte',
    subtitle: 'Inscrivez-vous, puis demandez un accès à un administrateur.',
    submit: 'Créer mon compte',
    busy: 'Création...'
  },
  forgot: {
    title: 'Mot de passe oublié',
    subtitle: 'Recevez un lien pour choisir un nouveau mot de passe.',
    submit: 'Envoyer le lien',
    busy: 'Envoi...'
  },
  reset: {
    title: 'Nouveau mot de passe',
    subtitle: 'Choisissez un mot de passe pour votre compte.',
    submit: 'Enregistrer',
    busy: 'Enregistrement...'
  },
  'check-email': {
    title: 'Confirmez votre email',
    subtitle: 'Une dernière étape avant de pouvoir vous connecter.',
    submit: '',
    busy: ''
  },
  'reset-sent': {
    title: 'Lien envoyé',
    subtitle: 'Consultez votre boîte de réception.',
    submit: '',
    busy: ''
  }
};

const GOOGLE_ICON = (
  <svg className="size-[18px]" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
    />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
    />
  </svg>
);

export default function Auth({ mode: routeMode }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Transient mode set after a submit; null means "follow the route".
  const [transientMode, setTransientMode] = useState(null);
  const [providers, setProviders] = useState({ emailPassword: true, google: false });
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  const mode = transientMode ?? routeMode ?? 'signin';
  const copy = COPY[mode] ?? COPY.signin;

  // Set by handleReset once a new password is stored, so the sign-in form the
  // visitor lands on says why they are being asked to sign in again.
  const passwordWasReset = mode === 'signin' && searchParams.get('reset') === '1';
  // Better Auth puts the reset token in the query string of the page its
  // emailed link redirects to.
  const resetToken = searchParams.get('token') ?? '';

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  // Navigating between /login and /register must clear a stale error and any
  // transient "check your email" state.
  useEffect(() => {
    setTransientMode(null);
    setError(null);
    setNotice(null);
    setShowPassword(false);
  }, [routeMode]);

  // Sign-in and registration have nothing to offer a search engine. The server
  // shell already sends noindex for these paths (server/src/seo.ts); this keeps
  // the head right across client-side navigation and gives the tab a real name.
  useEffect(() => {
    applySeo({
      title: `${copy.title} | Invitation d'anniversaire`,
      description: copy.subtitle,
      robots: 'noindex, nofollow'
    });
  }, [copy.title, copy.subtitle]);

  useEffect(() => {
    let cancelled = false;
    authProviders().then((p) => {
      if (!cancelled) setProviders(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A visitor arriving on /login who already has a session belongs elsewhere.
  // No route guard runs here, so resolve the session rather than reading a
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

  // Shared submit wrapper: one place for the loading flag and error surface.
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

  function handleSignIn() {
    return run(async () => {
      const { error: signInError } = await authClient.signIn.email({
        email: form.email.trim(),
        password: form.password
      });
      if (signInError) {
        // 403 here means the account exists but its email is unconfirmed —
        // a different fix from "wrong password", so say which it is.
        if (signInError.status === 403) {
          setTransientMode('check-email');
          return;
        }
        throw new Error('Email ou mot de passe incorrect.');
      }
      setForm((prev) => ({ ...prev, password: '' }));
      await goToDestination();
    });
  }

  function handleSignUp() {
    return run(async () => {
      const { error: signUpError } = await authClient.signUp.email({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        // Where the confirmation link lands: the dashboard, like the resend
        // below, so both routes end on the same screen — a freshly confirmed
        // account can create its first invitation straight away.
        callbackURL: '/admin'
      });
      if (signUpError) {
        throw new Error(
          signUpError.status === 422
            ? 'Un compte existe déjà pour cet email.'
            : signUpError.message || 'La création du compte a échoué.'
        );
      }
      setForm((prev) => ({ ...prev, password: '' }));
      setTransientMode('check-email');
    });
  }

  function handleForgot() {
    return run(async () => {
      // The response is deliberately the same whether or not the account
      // exists, so this endpoint can't be used to probe for addresses.
      await authClient.requestPasswordReset({
        email: form.email.trim(),
        redirectTo: `${window.location.origin}/reset-password`
      });
      setTransientMode('reset-sent');
    });
  }

  function handleReset() {
    return run(async () => {
      if (!resetToken) throw new Error('Lien de réinitialisation invalide ou expiré.');
      const { error: resetError } = await authClient.resetPassword({
        newPassword: form.password,
        token: resetToken
      });
      if (resetError) throw new Error('Lien de réinitialisation invalide ou expiré.');
      setForm((prev) => ({ ...prev, password: '' }));
      navigate('/login?reset=1', { replace: true });
    });
  }

  function resendVerification() {
    return run(async () => {
      await authClient.sendVerificationEmail({ email: form.email.trim(), callbackURL: '/admin' });
      setNotice('Email renvoyé.');
    });
  }

  function signInWithGoogle() {
    setError(null);
    setLoading(true);
    // Full-page redirect to Google; the server drops the visitor back on
    // /admin, where the route guard resolves the restored session.
    authClient.signIn.social({ provider: 'google', callbackURL: '/admin' }).catch(() => {
      setLoading(false);
      setError('La connexion Google a échoué.');
    });
  }

  function submit(event) {
    event.preventDefault();
    const handlers = { signin: handleSignIn, signup: handleSignUp, forgot: handleForgot, reset: handleReset };
    return handlers[mode]?.();
  }

  return (
    <div className="flex min-h-full items-center justify-center px-3 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-10">
      <Card className="w-full max-w-[26rem] shadow-xl">
        <CardHeader className="text-center">
          <span className="mx-auto mb-1 text-4xl" aria-hidden="true">
            🎉
          </span>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.subtitle}</CardDescription>
        </CardHeader>

        {/* ---------- Verification email sent ---------- */}
        {mode === 'check-email' && (
          <CardContent className="grid gap-3">
            <Alert>
              <MailCheckIcon />
              <AlertTitle>Vérifiez votre boîte mail</AlertTitle>
              <AlertDescription>
                <p>
                  Un email de confirmation vient d'être envoyé à{' '}
                  <strong className="font-medium">{form.email}</strong>.
                </p>
                <p>
                  Ouvrez le lien qu'il contient pour activer votre compte. Pensez à regarder dans les indésirables.
                </p>
              </AlertDescription>
            </Alert>
            <Button variant="secondary" className="w-full" disabled={loading} onClick={resendVerification}>
              {loading && <Loader2Icon className="animate-spin" />}
              {loading ? 'Envoi...' : "Renvoyer l'email"}
            </Button>
            {notice && (
              <p className="text-center text-sm font-medium text-success" role="status">
                {notice}
              </p>
            )}
            <Link
              to="/login"
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← Retour à la connexion
            </Link>
          </CardContent>
        )}

        {/* ---------- Reset link sent ---------- */}
        {mode === 'reset-sent' && (
          <CardContent className="grid gap-3">
            <Alert>
              <MailCheckIcon />
              <AlertTitle>Lien envoyé</AlertTitle>
              <AlertDescription>
                <p>
                  Si un compte existe pour <strong className="font-medium">{form.email}</strong>, un lien de
                  réinitialisation vient de lui être envoyé.
                </p>
                <p>Le lien est valable une heure.</p>
              </AlertDescription>
            </Alert>
            <Link
              to="/login"
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← Retour à la connexion
            </Link>
          </CardContent>
        )}

        {/* ---------- Forms ---------- */}
        {mode !== 'check-email' && mode !== 'reset-sent' && (
          <form noValidate onSubmit={submit}>
            <CardContent className="grid gap-4">
              {mode === 'signup' && (
                <div className="grid gap-2">
                  <Label htmlFor="auth-name">Nom</Label>
                  <Input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={setField('name')}
                  />
                </div>
              )}

              {mode !== 'reset' && (
                <div className="grid gap-2">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    required
                    value={form.email}
                    onChange={setField('email')}
                  />
                </div>
              )}

              {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
                <div className="grid gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="auth-password">
                      {mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
                    </Label>
                    {mode === 'signin' && (
                      <Link
                        to="/forgot-password"
                        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Oublié ?
                      </Link>
                    )}
                  </div>
                  {/* Typing a password blind on a phone keyboard is the single
                      most common reason a sign-in fails twice, so it can be
                      revealed. */}
                  <div className="relative">
                    <Input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      className="pr-10"
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      minLength={mode === 'signin' ? undefined : 8}
                      required
                      value={form.password}
                      onChange={setField('password')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </Button>
                  </div>
                  {mode !== 'signin' && <p className="text-sm text-muted-foreground">8 caractères minimum.</p>}
                </div>
              )}

              {error && (
                <Alert variant="destructive" role="alert">
                  <CircleAlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {passwordWasReset && (
                <p className="text-sm font-medium text-success" role="status">
                  Mot de passe modifié. Connectez-vous avec le nouveau.
                </p>
              )}
            </CardContent>

            <CardFooter className="mt-6 grid gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2Icon className="animate-spin" />}
                {loading ? copy.busy : copy.submit}
              </Button>

              {/* Google is only offered when the server reports it configured. */}
              {providers.google && (mode === 'signin' || mode === 'signup') && (
                <>
                  <div className="relative text-center text-sm">
                    <Separator className="absolute inset-x-0 top-1/2" />
                    <span className="relative bg-card px-2 text-muted-foreground">ou</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={signInWithGoogle}
                  >
                    {GOOGLE_ICON}
                    Continuer avec Google
                  </Button>
                </>
              )}

              <p className="text-center text-sm text-muted-foreground">
                {mode === 'signin' && (
                  <>
                    Pas encore de compte ?{' '}
                    <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
                      Créer un compte
                    </Link>
                  </>
                )}
                {mode === 'signup' && (
                  <>
                    Déjà un compte ?{' '}
                    <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                      Se connecter
                    </Link>
                  </>
                )}
                {mode !== 'signin' && mode !== 'signup' && (
                  <Link to="/login" className="underline-offset-4 hover:text-foreground hover:underline">
                    ← Retour à la connexion
                  </Link>
                )}
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

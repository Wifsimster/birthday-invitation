import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlertIcon, EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GoogleButton from './GoogleButton.jsx';

/**
 * Typing a password blind on a phone keyboard is the single most common reason
 * a sign-in fails twice, so it can be revealed.
 */
function PasswordField({ value, onChange, settings }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="auth-password">{settings.label}</Label>
        {settings.showForgotLink && (
          <Link
            to="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Oublié ?
          </Link>
        )}
      </div>
      <div className="relative">
        <Input
          id="auth-password"
          type={visible ? 'text' : 'password'}
          className="pr-10"
          autoComplete={settings.autoComplete}
          minLength={settings.minLength}
          required
          value={value}
          onChange={onChange}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
      {settings.hint && <p className="text-sm text-muted-foreground">{settings.hint}</p>}
    </div>
  );
}

/** The link under the button, which differs per flow. */
function Footer({ kind }) {
  if (kind === 'register') {
    return (
      <>
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Créer un compte
        </Link>
      </>
    );
  }
  if (kind === 'signin') {
    return (
      <>
        Déjà un compte ?{' '}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </>
    );
  }
  return (
    <Link to="/login" className="underline-offset-4 hover:text-foreground hover:underline">
      ← Retour à la connexion
    </Link>
  );
}

/**
 * The card's form. Which fields it carries, what the button says and what sits
 * under it all come from the mode descriptor (see modes.js) rather than from a
 * conditional per flow.
 */
export default function CredentialsForm({
  mode,
  form,
  onChange,
  error,
  notice,
  busy,
  googleEnabled,
  onSubmit,
  onGoogle
}) {
  const field = (key) => (e) => onChange({ ...form, [key]: e.target.value });

  return (
    <form noValidate onSubmit={onSubmit}>
      <CardContent className="grid gap-4">
        {mode.fields.includes('name') && (
          <div className="grid gap-2">
            <Label htmlFor="auth-name">Nom</Label>
            <Input
              id="auth-name"
              type="text"
              autoComplete="name"
              required
              value={form.name}
              onChange={field('name')}
            />
          </div>
        )}

        {mode.fields.includes('email') && (
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
              onChange={field('email')}
            />
          </div>
        )}

        {mode.fields.includes('password') && (
          <PasswordField value={form.password} onChange={field('password')} settings={mode.password} />
        )}

        {error && (
          <Alert variant="destructive" role="alert">
            <CircleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <p className="text-sm font-medium text-success" role="status">
            {notice}
          </p>
        )}
      </CardContent>

      <CardFooter className="mt-6 grid gap-4">
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2Icon className="animate-spin" />}
          {busy ? mode.busy : mode.submit}
        </Button>

        {mode.google && googleEnabled && <GoogleButton disabled={busy} onClick={onGoogle} />}

        <p className="text-center text-sm text-muted-foreground">
          <Footer kind={mode.footer} />
        </p>
      </CardFooter>
    </form>
  );
}

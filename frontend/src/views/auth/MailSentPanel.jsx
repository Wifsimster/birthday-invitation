import { Link } from 'react-router-dom';
import { Loader2Icon, MailCheckIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';

/** The way back, shared by both of the card's dead-end states. */
function BackToSignIn() {
  return (
    <Link
      to="/login"
      className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      ← Retour à la connexion
    </Link>
  );
}

/** "We sent you a confirmation link", with a way to ask for another one. */
export function CheckEmailPanel({ email, busy, notice, onResend }) {
  return (
    <CardContent className="grid gap-3">
      <Alert>
        <MailCheckIcon />
        <AlertTitle>Vérifiez votre boîte mail</AlertTitle>
        <AlertDescription>
          <p>
            Un email de confirmation vient d'être envoyé à <strong className="font-medium">{email}</strong>.
          </p>
          <p>Ouvrez le lien qu'il contient pour activer votre compte. Pensez à regarder dans les indésirables.</p>
        </AlertDescription>
      </Alert>
      <Button variant="secondary" className="w-full" disabled={busy} onClick={onResend}>
        {busy && <Loader2Icon className="animate-spin" />}
        {busy ? 'Envoi...' : "Renvoyer l'email"}
      </Button>
      {notice && (
        <p className="text-center text-sm font-medium text-success" role="status">
          {notice}
        </p>
      )}
      <BackToSignIn />
    </CardContent>
  );
}

/** "If that address has an account, its reset link is on its way." */
export function ResetSentPanel({ email }) {
  return (
    <CardContent className="grid gap-3">
      <Alert>
        <MailCheckIcon />
        <AlertTitle>Lien envoyé</AlertTitle>
        <AlertDescription>
          <p>
            Si un compte existe pour <strong className="font-medium">{email}</strong>, un lien de réinitialisation
            vient de lui être envoyé.
          </p>
          <p>Le lien est valable une heure.</p>
        </AlertDescription>
      </Alert>
      <BackToSignIn />
    </CardContent>
  );
}

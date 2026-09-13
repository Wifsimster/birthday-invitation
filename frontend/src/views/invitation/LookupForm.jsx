import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormActions, FormError } from './RsvpForm.jsx';

/** Retrieving an answer already given, by the number it was given with. */
export default function LookupForm({ phone, onPhoneChange, error, busy, onSubmit, onCancel, panelRef, headingRef }) {
  return (
    <form ref={panelRef} className="t-tile mt-5 scroll-mt-4 space-y-5 p-4 sm:p-6" onSubmit={onSubmit}>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-center text-xl font-bold text-[color:var(--theme-primary,#ff6b6b)] outline-none"
      >
        Retrouver ma réponse
      </h2>
      <div className="grid gap-2">
        <Label htmlFor="lookup-phone">
          📱 Téléphone{' '}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        </Label>
        <Input
          id="lookup-phone"
          className="bg-card"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="06 12 34 56 78"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">Le numéro utilisé lors de ta première réponse.</p>
      </div>
      <FormError message={error} />
      <FormActions busy={busy} busyLabel="Recherche..." submitLabel="Rechercher" onCancel={onCancel} />
    </form>
  );
}

import { useMemo } from 'react';
import { CircleAlertIcon, Loader2Icon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const ATTENDING_OPTIONS = [
  { value: 'yes', label: 'Oui, je viens ! 🎈' },
  { value: 'no', label: 'Non, je ne peux pas venir 😔' }
];

const Required = () => (
  <span className="text-destructive" aria-hidden="true">
    *
  </span>
);

/**
 * Stacked, the primary action goes on top: it is the one the thumb reaches
 * first and the one nearly everyone wants. Side by side from `sm` up it goes
 * back to the right, as a desktop dialog expects.
 *
 * `flex-1` is held back to `sm` on purpose: in the stacked column it resolves
 * to `flex-basis: 0` on the *height*, which beat the `h-12` these buttons get
 * from `size="lg"` and squashed them to their text — a 20px tap target on the
 * one control the page exists for. Column stretch already makes them full
 * width.
 */
export function FormActions({ busy, busyLabel, submitLabel, onCancel }) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      <Button type="button" variant="outline" size="lg" className="sm:flex-1" onClick={onCancel}>
        Annuler
      </Button>
      <Button type="submit" size="lg" className="sm:flex-1" disabled={busy}>
        {busy && <Loader2Icon className="animate-spin" />}
        {busy ? busyLabel : submitLabel}
      </Button>
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** The invitation's own RSVP form. */
export default function RsvpForm({ form, onChange, error, submitting, onSubmit, onCancel, panelRef, headingRef }) {
  const field = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  const attending = form.attending === 'yes';

  // The three usual answers, plus the recorded value when a response the host
  // entered by hand carries more people than the form normally offers — the
  // select would otherwise render blank and silently drop the guest's count.
  const guestOptions = useMemo(() => {
    const options = [
      { value: 1, label: "1 personne (juste l'enfant)" },
      { value: 2, label: '2 personnes (enfant + 1 accompagnateur)' },
      { value: 3, label: '3 personnes (enfant + 2 accompagnateurs)' }
    ];
    const current = Number(form.guests);
    if (Number.isInteger(current) && current > 3) options.push({ value: current, label: `${current} personnes` });
    return options;
  }, [form.guests]);

  return (
    <form ref={panelRef} className="t-tile mt-5 scroll-mt-4 space-y-5 p-4 sm:p-6" onSubmit={onSubmit}>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-center text-xl font-bold text-[color:var(--theme-primary,#ff6b6b)] outline-none"
      >
        Réponds à l'invitation
      </h2>

      <fieldset className="space-y-3">
        <legend className="mb-3 font-medium">
          Statut <Required />
        </legend>
        <RadioGroup
          className="gap-3"
          value={form.attending}
          onValueChange={(value) => onChange({ ...form, attending: value })}
        >
          {ATTENDING_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className={`flex items-center gap-3 rounded-xl border-2 bg-card p-3 transition-colors ${
                form.attending === opt.value
                  ? 'border-[color:var(--theme-primary,#ff6b6b)] bg-accent'
                  : 'hover:border-[color:var(--theme-primary,#ff6b6b)]/50'
              }`}
            >
              <RadioGroupItem id={`attending-${opt.value}`} value={opt.value} />
              <Label htmlFor={`attending-${opt.value}`} className="flex-1 cursor-pointer font-medium">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="rsvp-name">
          👶 Nom de l'enfant <Required />
        </Label>
        <Input
          id="rsvp-name"
          className="bg-card"
          type="text"
          required
          placeholder="Prénom de l'enfant"
          value={form.name}
          onChange={field('name')}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rsvp-phone">
          📱 Téléphone <Required />
        </Label>
        <Input
          id="rsvp-phone"
          className="bg-card"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="06 12 34 56 78"
          value={form.phone}
          onChange={field('phone')}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rsvp-email">✉️ Email du parent</Label>
        <Input
          id="rsvp-email"
          className="bg-card"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="parent@example.com"
          value={form.email}
          onChange={field('email')}
        />
      </div>

      {attending && (
        <div className="grid gap-2">
          <Label htmlFor="rsvp-guests">👨‍👩‍👧‍👦 Nombre de personnes</Label>
          <Select
            value={String(form.guests)}
            onValueChange={(value) => onChange({ ...form, guests: Number(value) })}
          >
            <SelectTrigger id="rsvp-guests" className="w-full min-w-0 bg-card *:data-[slot=select-value]:min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {guestOptions.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {attending && (
        <div className="grid gap-2">
          <Label htmlFor="rsvp-diet">🥜 Allergies / régime alimentaire</Label>
          <Textarea
            id="rsvp-diet"
            className="bg-card"
            placeholder="Allergies, intolérances, régime particulier..."
            value={form.dietary_restrictions}
            onChange={field('dietary_restrictions')}
          />
        </div>
      )}

      {attending && (
        /* Consent, so: opt-in, never pre-ticked, and the label says exactly what
           leaves the row — the prénom and the party size, nothing else.
           Téléphone, email, allergies and message are never shown to another
           guest. */
        <div className="flex items-start gap-3 rounded-xl border-2 bg-card p-3">
          <Checkbox
            id="rsvp-share"
            className="mt-0.5"
            checked={form.share_response}
            onCheckedChange={(checked) => onChange({ ...form, share_response: checked === true })}
          />
          <div className="grid gap-1">
            <Label htmlFor="rsvp-share" className="cursor-pointer font-medium">
              👋 Partager ma réponse avec les autres invités
            </Label>
            <p className="text-sm text-muted-foreground">
              Seuls ton prénom et le nombre de personnes apparaîtront, et uniquement pour les invités qui ont eux aussi
              confirmé leur venue.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="rsvp-message">💌 Message (optionnel)</Label>
        <Textarea
          id="rsvp-message"
          className="bg-card"
          placeholder={
            attending ? 'Un petit mot pour nous dire votre joie de venir...' : "Un petit mot pour s'excuser..."
          }
          value={form.message}
          onChange={field('message')}
        />
      </div>

      <FormError message={error} />

      <FormActions
        busy={submitting}
        busyLabel="Envoi..."
        submitLabel="Envoyer ma réponse"
        onCancel={onCancel}
      />
    </form>
  );
}

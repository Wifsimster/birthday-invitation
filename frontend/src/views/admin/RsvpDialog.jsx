import { useRef } from 'react';
import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/** A required-field marker, so the asterisk is never read out as content. */
const Required = () => (
  <span className="text-destructive" aria-hidden="true">
    *
  </span>
);

/** Adding a reply taken by phone, or correcting one already stored. */
export default function RsvpDialog({ open, onOpenChange, mode, form, onChange, saving, onSubmit }) {
  const nameRef = useRef(null);
  const creating = mode === 'create';
  const field = (key) => (e) => onChange({ ...form, [key]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogScrollContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nameRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{creating ? 'Ajouter une réponse' : 'Modifier la réponse'}</DialogTitle>
          <DialogDescription>
            {creating
              ? 'Enregistre une réponse reçue par téléphone ou de vive voix.'
              : 'Mets à jour la réponse de cet invité.'}
          </DialogDescription>
        </DialogHeader>

        <form id="rsvp-form" className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="edit-status">
              Statut <Required />
            </Label>
            <Select value={form.attending} onValueChange={(value) => onChange({ ...form, attending: value })}>
              <SelectTrigger id="edit-status" className="w-full min-w-0 *:data-[slot=select-value]:min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Confirmé</SelectItem>
                <SelectItem value="no">Décliné</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-name">
              Nom <Required />
            </Label>
            <Input id="edit-name" ref={nameRef} required value={form.name} onChange={field('name')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-phone">
              <span aria-hidden="true">📱</span> Téléphone <Required />
            </Label>
            <Input
              id="edit-phone"
              type="tel"
              inputMode="tel"
              required
              value={form.phone}
              onChange={field('phone')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-email">
              <span aria-hidden="true">✉️</span> Email
            </Label>
            <Input
              id="edit-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={form.email}
              onChange={field('email')}
            />
          </div>
          {form.attending === 'yes' && (
            <div className="grid gap-2">
              <Label htmlFor="edit-guests">Nombre d'invités</Label>
              <Input
                id="edit-guests"
                type="number"
                min="0"
                max="10"
                inputMode="numeric"
                value={form.guests}
                onChange={(e) =>
                  onChange({ ...form, guests: e.target.value === '' ? '' : Number(e.target.value) })
                }
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="edit-diet">
              <span aria-hidden="true">🥜</span> Allergies / régime
            </Label>
            <Textarea
              id="edit-diet"
              value={form.dietary_restrictions}
              onChange={field('dietary_restrictions')}
            />
          </div>
          {form.attending === 'yes' && (
            /* The guest ticks this themselves on the invitation; it is here so a
               response taken by phone can carry the same consent, and so an
               admin can honour a "retire-moi de la liste" asked for out of
               band. */
            <div className="flex items-start gap-3">
              <Checkbox
                id="edit-share"
                className="mt-0.5"
                checked={form.share_response}
                onCheckedChange={(checked) => onChange({ ...form, share_response: checked === true })}
              />
              <div className="grid gap-1">
                <Label htmlFor="edit-share" className="cursor-pointer">
                  <span aria-hidden="true">👋</span> Réponse partagée avec les autres invités
                </Label>
                <p className="text-sm text-muted-foreground">
                  Le prénom et le nombre de personnes apparaissent dans la liste visible par les invités confirmés.
                </p>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="edit-message">
              <span aria-hidden="true">💌</span> Message
            </Label>
            <Textarea id="edit-message" value={form.message} onChange={field('message')} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="rsvp-form" disabled={saving}>
            {saving && <Loader2Icon className="animate-spin" />}
            {saving ? 'Sauvegarde...' : creating ? 'Ajouter' : 'Sauvegarder'}
          </Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>
  );
}

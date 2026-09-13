import { useRef } from 'react';
import { CircleAlertIcon, Loader2Icon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { themeList } from '../../themes.js';

/** Creating a party, or editing the details of one. */
export default function EventDialog({
  open,
  onOpenChange,
  mode,
  isDefaultEvent,
  form,
  onChange,
  saving,
  error,
  onSubmit
}) {
  const personRef = useRef(null);
  const creating = mode === 'create';
  const field = (key) => (e) => onChange({ ...form, [key]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogScrollContent
        className="sm:max-w-2xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          personRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{creating ? 'Nouvel événement' : "Modifier l'événement"}</DialogTitle>
          <DialogDescription>
            Seul le nom est obligatoire — le reste peut être complété plus tard.
          </DialogDescription>
        </DialogHeader>

        <form id="event-form" className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="event-person">
              Nom de l'enfant{' '}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input id="event-person" ref={personRef} required value={form.person} onChange={field('person')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="event-age">Âge</Label>
              <Input id="event-age" placeholder="5" value={form.age} onChange={field('age')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-date">Date</Label>
              <Input id="event-date" type="date" value={form.date} onChange={field('date')} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="event-time">Horaire</Label>
              <Input id="event-time" placeholder="15h00 - 17h00" value={form.time} onChange={field('time')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-town">Ville</Label>
              <Input id="event-town" value={form.town} onChange={field('town')} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-location">Lieu</Label>
            <Textarea id="event-location" value={form.location} onChange={field('location')} />
          </div>
          {/* A dress code is a sentence, not a word — "Tenue de rechange ou
              maillot de bain ! Il y aura des jeux d'eau" ran off the end of a
              single-line input with no way to see what was already saved. It
              gets the same full-width textarea as the address above it. */}
          <div className="grid gap-2">
            <Label htmlFor="event-dress">Dress code</Label>
            <Textarea id="event-dress" value={form.dress_code} onChange={field('dress_code')} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-deadline">Date limite de réponse</Label>
            <Input
              id="event-deadline"
              type="date"
              value={form.rsvp_deadline}
              onChange={field('rsvp_deadline')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-theme">Thème</Label>
            <Select value={form.theme} onValueChange={(value) => onChange({ ...form, theme: value })}>
              <SelectTrigger id="event-theme" className="w-full min-w-0 *:data-[slot=select-value]:min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themeList.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.icon} {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isDefaultEvent && (
            <div className="grid gap-2">
              <Label htmlFor="event-slug">Lien (slug)</Label>
              <Input
                id="event-slug"
                placeholder="laisser vide pour générer automatiquement"
                value={form.slug}
                onChange={field('slug')}
              />
              <p className="text-sm text-muted-foreground">Laisser vide pour générer automatiquement.</p>
            </div>
          )}
          {error && (
            <Alert variant="destructive" role="alert">
              <CircleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="event-form" disabled={saving}>
            {saving && <Loader2Icon className="animate-spin" />}
            {saving ? 'Sauvegarde...' : creating ? 'Créer' : 'Sauvegarder'}
          </Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>
  );
}

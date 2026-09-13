import { PencilIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from './format.js';

/** One stored response, with the two actions an admin has on it. */
export default function ResponseCard({ rsvp, onEdit, onDelete }) {
  const attending = rsvp.attending === 'yes';
  return (
    <li
      className={`rounded-xl border bg-card p-4 ${
        attending ? 'border-l-4 border-l-success' : 'border-l-4 border-l-destructive'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="flex min-w-0 items-center gap-2 font-semibold">
            <span aria-hidden="true">{attending ? '✅' : '❌'}</span>
            <span className="truncate">{rsvp.name}</span>
          </h3>
          {/* The status was a row of its own in the list below, where "Statut"
              and its value took the full width of a phone for one word. It reads
              as part of the identity, so it sits here as a badge. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={attending ? 'bg-success text-success-foreground' : 'bg-destructive text-white'}>
              {attending ? 'Confirmé' : 'Décliné'}
            </Badge>
            {attending && (
              <Badge variant="outline" className="text-muted-foreground">
                👥 {rsvp.guests}
              </Badge>
            )}
            {attending && Boolean(rsvp.share_response) && (
              <Badge variant="outline" className="text-muted-foreground">
                👋 Réponse partagée
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Modifier la réponse de ${rsvp.name}`}
            onClick={() => onEdit(rsvp)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Supprimer la réponse de ${rsvp.name}`}
            onClick={() => onDelete(rsvp)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {/* Label and value share two real grid columns rather than a flex row
          each: at 390px the flex version let "Mis à jour" break across two lines
          and squeezed the email down to an ellipsis. */}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr] sm:gap-x-6">
        {rsvp.email && (
          <>
            <dt className="font-medium whitespace-nowrap text-muted-foreground">✉️ Email</dt>
            <dd className="min-w-0">
              <a
                className="inline-flex min-h-7 items-center [overflow-wrap:anywhere] underline-offset-4 hover:underline"
                href={`mailto:${rsvp.email}`}
              >
                {rsvp.email}
              </a>
            </dd>
          </>
        )}
        <dt className="font-medium whitespace-nowrap text-muted-foreground">📱 Téléphone</dt>
        <dd className="min-w-0">
          <a className="inline-flex min-h-7 items-center underline-offset-4 hover:underline" href={`tel:${rsvp.phone}`}>
            {rsvp.phone}
          </a>
        </dd>
        {rsvp.dietary_restrictions && (
          <>
            <dt className="font-medium whitespace-nowrap text-muted-foreground sm:col-start-1">🥜 Allergies</dt>
            <dd className="min-w-0 sm:col-span-3">{rsvp.dietary_restrictions}</dd>
          </>
        )}
        <dt className="font-medium whitespace-nowrap text-muted-foreground sm:col-start-1">🕒 Mis à jour</dt>
        <dd className="min-w-0 text-muted-foreground">{formatDate(rsvp.updated_at)}</dd>
      </dl>

      {rsvp.message && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">💌 {rsvp.message}</p>}
    </li>
  );
}

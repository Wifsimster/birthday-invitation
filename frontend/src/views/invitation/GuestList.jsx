import { Loader2Icon, UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Who else is coming.
 *
 * Only ever rendered once the server has answered the guest's own phone number
 * with a list, i.e. once it has established that this reader is a confirmed
 * guest. A visitor who has not answered, or who declined, never sees this block.
 */
export default function GuestList({ state, list, onRetry }) {
  if (state === 'loading') {
    return (
      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        Chargement des invités...
      </p>
    );
  }

  if (state === 'error') {
    return (
      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">La liste des invités n'a pas pu être chargée.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (state !== 'ready' || !list) return null;

  return (
    <section className="t-tile mt-6 p-4 sm:p-5" aria-labelledby="guest-list-heading">
      <h2
        id="guest-list-heading"
        className="flex items-center gap-2 text-lg font-bold text-[color:var(--theme-primary,#ff6b6b)]"
      >
        <UsersIcon className="size-4.5" aria-hidden="true" />
        Qui vient ?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {list.confirmations} réponse(s) confirmée(s) pour {list.total_guests} personne(s).{' '}
        {list.shared_count > 0
          ? `${list.shared_count} invité(s) ont accepté de partager leur réponse.`
          : 'Personne ne partage encore sa réponse.'}
      </p>

      {list.participants.length > 0 ? (
        <ul className="mt-3 grid gap-1.5">
          {list.participants.map((participant, i) => (
            <li
              key={`${participant.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2"
            >
              <span className="min-w-0 truncate font-medium">🎈 {participant.name}</span>
              <span className="shrink-0 text-sm text-muted-foreground">{participant.guests} pers.</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border-2 border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Sois le premier à partager ta réponse ! 🎉
        </p>
      )}

      {!list.you_share && (
        <p className="mt-3 text-sm text-muted-foreground">
          Ta réponse reste privée. Coche « Partager ma réponse » en modifiant ta réponse pour apparaître dans cette
          liste.
        </p>
      )}
    </section>
  );
}

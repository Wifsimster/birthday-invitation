import {
  EllipsisVerticalIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, LoadError } from './PanelState.jsx';
import { formatEventDate, themeIcon, themeLabel } from './format.js';

/** One party in the grid. The whole card selects it; the menu acts on it. */
function EventCard({ event: ev, selected, onSelect, onEdit, onCopyLink, onDelete }) {
  return (
    <div
      className={`relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors ${
        selected ? 'border-primary ring-3 ring-ring/25' : 'hover:border-primary/40 hover:bg-accent/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl" aria-hidden="true">
          {themeIcon(ev.theme)}
        </span>
        <div className="relative z-10 flex items-center gap-1">
          {ev.is_default && <Badge className="bg-success text-success-foreground">Actif</Badge>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${ev.person || 'cet événement'}`}>
                <EllipsisVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(ev)}>
                <PencilIcon />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCopyLink(ev)}>
                <LinkIcon />
                Copier le lien
              </DropdownMenuItem>
              {!ev.is_default && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(ev)}>
                    <Trash2Icon />
                    Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="truncate font-semibold">
          {/* The title button carries a stretched hit area, so the card has
              exactly one focusable control for selecting it and the menu above
              still receives its own clicks. */}
          <button
            type="button"
            className="text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            aria-pressed={selected}
            onClick={() => onSelect(ev.id)}
          >
            {ev.person || 'Sans nom'}
          </button>
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {ev.date || ev.town ? (
            <>
              {ev.date && <span>{formatEventDate(ev.date)}</span>}
              {ev.date && ev.town && <span> · </span>}
              {ev.town && <span>{ev.town}</span>}
            </>
          ) : (
            <em className="not-italic opacity-70">Détails à compléter</em>
          )}
        </p>
        <p className="mt-1 text-xs tracking-wide uppercase text-muted-foreground">{themeLabel(ev.theme)}</p>
      </div>

      <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <div className="flex items-baseline gap-1">
          <dt className="order-2 text-muted-foreground">rép.</dt>
          <dd className="order-1 font-semibold">{ev.responses || 0}</dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="order-2 text-muted-foreground">conf.</dt>
          <dd className="order-1 font-semibold text-success">{ev.confirmations || 0}</dd>
        </div>
        <div className="flex items-baseline gap-1">
          <dt className="order-2 text-muted-foreground">inv.</dt>
          <dd className="order-1 font-semibold">{ev.total_guests || 0}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * The events overview: which parties exist and which one the console is working
 * on.
 *
 * "Accès" is account-level, so on a phone — where every row costs a slice of the
 * only screen there is — the picker gets out of its way entirely, and once a
 * fête is picked the grid folds into a one-line summary. `sm` and up has the
 * room, so it stays open.
 */
export default function EventPicker({
  events,
  loading,
  error,
  selectedEvent,
  selectedEventId,
  isAdmin,
  visible,
  open,
  onOpen,
  onSelect,
  onCreate,
  onEdit,
  onCopyLink,
  onDelete
}) {
  const folded = !open && !!selectedEvent && !loading && !error;

  return (
    <Card
      className={`${visible ? '' : 'hidden sm:flex'} ${folded ? 'gap-0 py-4 sm:gap-6 sm:py-6' : ''}`}
    >
      <CardHeader className={folded ? 'hidden sm:grid' : undefined}>
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden="true">🎈</span> Événements
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? 'Sélectionne une fête pour gérer ses réponses, son thème et son lien.'
            : 'Crée autant de fêtes que tu veux, puis sélectionnes-en une pour gérer ses réponses, son thème et son lien.'}
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={onCreate}>
            <PlusIcon />
            Nouvel événement
          </Button>
        </CardAction>
      </CardHeader>

      {/* The folded state: which fête is being worked on, and the way back to
          the list. Replaced by the grid itself from `sm` up. */}
      {folded && (
        <div className="flex items-center gap-3 px-4 sm:hidden">
          <span className="text-2xl" aria-hidden="true">
            {themeIcon(selectedEvent.theme)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{selectedEvent.person || 'Sans nom'}</p>
            {/* Just the date: the response count is already on the "Réponses"
                tab a few pixels below, and squeezing both in truncated
                whichever came second. */}
            <p className="truncate text-xs text-muted-foreground">
              {selectedEvent.date ? formatEventDate(selectedEvent.date) : 'Détails à compléter'}
              {selectedEvent.town ? ` · ${selectedEvent.town}` : ''}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Nouvel événement"
            title="Nouvel événement"
            onClick={onCreate}
          >
            <PlusIcon />
          </Button>
          <Button variant="outline" size="sm" onClick={onOpen}>
            Changer
          </Button>
        </div>
      )}

      <CardContent className={folded ? 'hidden sm:block' : undefined}>
        {loading && !events.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
            <span className="sr-only">Chargement des événements...</span>
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <LoadError message={error} />
        ) : !events.length ? (
          <EmptyState
            icon="🎂"
            title="Aucun événement pour le moment"
            action={
              <Button size="sm" onClick={onCreate}>
                <PlusIcon />
                Nouvel événement
              </Button>
            }
          >
            Crée une première fête pour ouvrir les invitations — tu peux en gérer plusieurs en parallèle.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                selected={ev.id === selectedEventId}
                onSelect={onSelect}
                onEdit={onEdit}
                onCopyLink={onCopyLink}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

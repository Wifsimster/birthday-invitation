import { useMemo, useRef } from 'react';
import {
  ArrowUpDownIcon,
  DownloadIcon,
  LinkIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { rsvpsApi } from '../../api/index.js';
import { useHotkey } from '../../hooks/useHotkey.js';
import { EmptyState, LoadError, LoadingRows } from './PanelState.jsx';
import ResponseCard from './ResponseCard.jsx';
import ResponseStats from './ResponseStats.jsx';

const STATUS_FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'yes', label: 'Confirmées' },
  { id: 'no', label: 'Déclinées' }
];

/**
 * The responses tab: the counters, the list, and the search/filter/sort controls
 * over it. Filtering is client-side over the already loaded list, so narrowing
 * it never costs a request.
 */
export default function ResponsesPanel({
  event,
  stats,
  rsvps,
  loading,
  error,
  filters,
  onFiltersChange,
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
  onClose,
  onShare,
  shortcutsEnabled
}) {
  const searchInputRef = useRef(null);
  const { query, status, sort } = filters;
  const set = (patch) => onFiltersChange({ ...filters, ...patch });

  // "/" jumps to the response search, the way every list view on the web does.
  // Ignored while a dialog is up: the focus belongs to it, not to the list
  // behind it.
  useHotkey('/', () => searchInputRef.current?.focus(), shortcutsEnabled && rsvps.length > 0);

  // Counts behind the filter buttons, so each one shows its own size.
  const statusCounts = useMemo(
    () => ({
      all: rsvps.length,
      yes: rsvps.filter((r) => r.attending === 'yes').length,
      no: rsvps.filter((r) => r.attending === 'no').length
    }),
    [rsvps]
  );

  const visibleRsvps = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = rsvps.filter((r) => {
      if (status !== 'all' && r.attending !== status) return false;
      if (!q) return true;
      return [r.name, r.email, r.phone].some((v) => (v || '').toLowerCase().includes(q));
    });
    // Sort a copy: `rsvps` is the fetched order and the auto-refresh replaces it
    // wholesale.
    if (sort === 'name') return [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    if (sort === 'guests') return [...rows].sort((a, b) => (b.guests || 0) - (a.guests || 0));
    return rows;
  }, [rsvps, query, status, sort]);

  return (
    <>
      {/* Hidden on a phone: the folded event summary directly above already
          names the fête and offers the way out of it. */}
      <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
        <h2 className="text-lg font-semibold">
          Gestion : <span className="text-primary">{event.person || 'Sans nom'}</span>
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <XIcon />
          Fermer
        </Button>
      </div>

      <ResponseStats stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>Réponses</CardTitle>
          <CardDescription>Les réponses arrivent en direct, la liste se rafraîchit toute seule.</CardDescription>
          <CardAction className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" disabled={loading} onClick={onRefresh}>
              <RefreshCwIcon className={loading ? 'animate-spin' : undefined} />
              <span className="sr-only sm:not-sr-only">Actualiser</span>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={rsvpsApi.exportUrl(event.id)}>
                <DownloadIcon />
                <span className="sr-only sm:not-sr-only">Exporter CSV</span>
              </a>
            </Button>
            <Button size="sm" onClick={onCreate}>
              <PlusIcon />
              Ajouter
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          {rsvps.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  className="pl-9"
                  type="search"
                  placeholder="Rechercher un nom, un email, un téléphone..."
                  aria-label="Rechercher une réponse"
                  value={query}
                  onChange={(e) => set({ query: e.target.value })}
                />
              </div>
              <Select value={sort} onValueChange={(value) => set({ sort: value })}>
                <SelectTrigger
                  className="w-full min-w-0 *:data-[slot=select-value]:min-w-0 sm:w-48"
                  aria-label="Trier les réponses"
                >
                  <ArrowUpDownIcon />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Plus récentes</SelectItem>
                  <SelectItem value="name">Nom (A→Z)</SelectItem>
                  <SelectItem value="guests">Nombre d'invités</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 sm:col-span-2" role="group" aria-label="Filtrer par statut">
                {STATUS_FILTERS.map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    size="sm"
                    variant={status === f.id ? 'default' : 'outline'}
                    aria-pressed={status === f.id}
                    onClick={() => set({ status: f.id })}
                  >
                    {f.label}
                    <Badge variant={status === f.id ? 'secondary' : 'outline'}>{statusCounts[f.id]}</Badge>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {loading && !rsvps.length ? (
            <LoadingRows label="Chargement des réponses..." className="h-28 w-full rounded-xl" />
          ) : error ? (
            <LoadError message={error} />
          ) : !rsvps.length ? (
            <EmptyState
              icon="📭"
              title="Aucune réponse pour le moment"
              action={
                <Button variant="outline" size="sm" onClick={onShare}>
                  <LinkIcon />
                  Partager l'invitation
                </Button>
              }
            >
              Partage le lien de l'invitation pour lancer les réponses.
            </EmptyState>
          ) : !visibleRsvps.length ? (
            <EmptyState
              icon="🔍"
              title="Aucun résultat"
              action={
                <Button variant="outline" size="sm" onClick={() => set({ query: '', status: 'all' })}>
                  Réinitialiser
                </Button>
              }
            >
              Aucune réponse ne correspond à cette recherche.
            </EmptyState>
          ) : (
            <>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {visibleRsvps.length} réponse{visibleRsvps.length > 1 ? 's' : ''} affichée
                {visibleRsvps.length > 1 ? 's' : ''}
                {visibleRsvps.length !== rsvps.length && ` sur ${rsvps.length}`}
              </p>

              <ul className="space-y-3">
                {visibleRsvps.map((rsvp) => (
                  <ResponseCard key={rsvp.id} rsvp={rsvp} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { eventsApi, rsvpsApi } from '../api/index.js';
import { useEventRsvps } from '../hooks/useEventRsvps.js';
import { useEvents } from '../hooks/useEvents.js';
import { usePoll } from '../hooks/usePoll.js';
import { useSessionRecovery } from '../hooks/useSessionRecovery.js';
import { useUsers } from '../hooks/useUsers.js';
import { applySeo } from '../seo.js';
import { useSession, signOut } from '../session.js';
import { applyTheme, DEFAULT_THEME, getTheme, preloadThemeFonts } from '../themes.js';
import AccessPanel from './admin/AccessPanel.jsx';
import AdminTopbar from './admin/AdminTopbar.jsx';
import ConfirmDialog from './admin/ConfirmDialog.jsx';
import EventDialog from './admin/EventDialog.jsx';
import EventPicker from './admin/EventPicker.jsx';
import ResponsesPanel from './admin/ResponsesPanel.jsx';
import RsvpDialog from './admin/RsvpDialog.jsx';
import SharePanel from './admin/SharePanel.jsx';
import ThemePanel from './admin/ThemePanel.jsx';
import { EmptyState } from './admin/PanelState.jsx';
import { eventUrl } from './admin/format.js';

// Section tabs. `needsEvent` marks the ones that operate on the selected event;
// "Accès" is account-level and works without one, and manages *every* account of
// the deployment — so it is the one tab reserved to admins.
const TABS = [
  { id: 'responses', label: 'Réponses', icon: '📋', needsEvent: true },
  { id: 'theme', label: 'Thème', icon: '🎨', needsEvent: true },
  { id: 'share', label: 'Partage', icon: '🔗', needsEvent: true },
  { id: 'access', label: 'Accès', icon: '👥', needsEvent: false, adminOnly: true }
];

const POLL_INTERVAL_MS = 30000;

const EMPTY_RSVP_FORM = {
  id: null,
  attending: 'yes',
  name: '',
  email: '',
  phone: '',
  guests: 1,
  dietary_restrictions: '',
  message: '',
  // The guest's own consent to appear in the list the other guests see.
  share_response: false
};

const EMPTY_EVENT_FORM = {
  id: null,
  person: '',
  age: '',
  date: '',
  time: '',
  town: '',
  location: '',
  dress_code: '',
  rsvp_deadline: '',
  theme: DEFAULT_THEME,
  slug: ''
};

const NO_FILTERS = { query: '', status: 'all', sort: 'recent' };

/**
 * The console.
 *
 * What is left here is orchestration: which event is selected, which tab is
 * open, which dialog is up, and the writes that tie the panels together. The
 * data lives in hooks (useEvents, useEventRsvps, useUsers), the requests behind
 * api/, and every screenful of markup in its own component under admin/.
 */
export default function Admin() {
  const navigate = useNavigate();
  const session = useSession();
  const [, setSearchParams] = useSearchParams();

  // The tab comes from the URL before the events land, so a reload does not
  // flash the default tab first.
  const [activeTab, setActiveTab] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    return TABS.some((t) => t.id === wanted) ? wanted : 'responses';
  });
  // The event asked for by the URL, captured at mount — the query string is
  // rewritten as soon as a selection is made, so it can't be read back later.
  const wantedEventRef = useRef(new URLSearchParams(window.location.search).get('event'));

  const [selectedEventId, setSelectedEventId] = useState(null);
  // Phones only: the event grid is roughly a screenful, and it sat above every
  // tab on every visit — including "Accès", which has nothing to do with an
  // event. Once a fête is picked the grid folds into a one-line summary and the
  // work is at the top of the page. `sm` and up has the room, so it stays open.
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);
  const [themeSaving, setThemeSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Dialog state: what is open, what it is editing, and whether its write is in
  // flight.
  const [rsvpDialog, setRsvpDialog] = useState({ open: false, mode: 'edit', form: EMPTY_RSVP_FORM, saving: false });
  const [eventDialog, setEventDialog] = useState({
    open: false, mode: 'create', isDefault: false, form: EMPTY_EVENT_FORM, saving: false, error: null
  });
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Losing the session ends the polling — a dashboard sitting on an error and
  // still polling only spends the rate limit — and hands the visitor back to the
  // sign-in form.
  const pollRef = useRef(null);
  const onSessionLost = useCallback(() => {
    pollRef.current?.stop();
    navigate('/login', { replace: true });
  }, [navigate]);
  const onAccessError = useSessionRecovery(onSessionLost);

  const events = useEvents(onAccessError);
  const responses = useEventRsvps(onAccessError);
  const accounts = useUsers(onAccessError);

  const selectedEvent = useMemo(
    () => events.events.find((e) => e.id === selectedEventId) || null,
    [events.events, selectedEventId]
  );

  // The signed-in account, so the users table can mark "vous" and disable the
  // actions the server would refuse anyway (self-demotion, self-deletion).
  const currentUserId = session.user?.id ?? null;
  // Every account manages its own invitations; only an admin also manages the
  // deployment's accounts (and sees every invitation, not just its own).
  const isAdmin = session.user?.role === 'admin';
  const visibleTabs = useMemo(() => TABS.filter((t) => !t.adminOnly || isAdmin), [isAdmin]);

  // Any open dialog pauses the poll: replacing the list under an admin who is
  // mid-edit was how a half-typed response got wiped.
  const anyDialogOpen = rsvpDialog.open || eventDialog.open || !!confirm;

  // The poll fires from a listener that outlives a render, so it reads the live
  // values through a ref rather than a stale closure.
  const live = useRef({});
  live.current = { selectedEventId, anyDialogOpen };

  // ---- Loading -------------------------------------------------------------

  // Reloading the list can retire the selected event (deleted here or in another
  // tab), which has to clear the selection rather than leave the panels pointing
  // at an id the server no longer knows.
  const loadEvents = useCallback(async () => {
    const list = await events.load();
    if (!list) return null;
    setSelectedEventId((current) => (current && !list.some((e) => e.id === current) ? null : current));
    return list;
  }, [events]);

  const loadResponses = useCallback(
    () => responses.load(live.current.selectedEventId),
    [responses]
  );

  // ---- Mount ---------------------------------------------------------------

  useEffect(() => {
    // The console is behind a login and has nothing to offer a search engine.
    applySeo({
      title: "Administration | Invitation d'anniversaire",
      description: "Console d'administration des invitations et des réponses.",
      robots: 'noindex, nofollow'
    });
  }, []);

  useEffect(() => {
    loadEvents().then((list) => {
      if (!list) return;
      const wanted = wantedEventRef.current;
      const match = wanted && list.find((e) => String(e.id) === String(wanted));
      if (match) {
        setSelectedEventId(match.id);
        return;
      }
      // Nothing asked for: open the default event straight away. Landing on a
      // dashboard that shows nothing until you press "Gérer" was a wasted step,
      // and most deployments only ever run one party at a time.
      setSelectedEventId((current) => {
        if (current !== null || !list.length) return current;
        return (list.find((e) => e.is_default) || list[0]).id;
      });
    });
    // The account list backs the admin-only "Accès" tab; asking for it as a
    // regular account would only collect a 403 the dashboard has to ignore.
    if (isAdmin) accounts.load();
    // Mount only: the loaders are stable, and re-running this would fight the
    // admin's own selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll only the data that actually moves: events and their RSVPs. The account
  // list changes rarely and has its own refresh button, and every extra polled
  // call eats into the admin rate limit.
  pollRef.current = usePoll(() => {
    if (live.current.anyDialogOpen) return;
    loadEvents();
    if (live.current.selectedEventId) loadResponses();
  }, POLL_INTERVAL_MS);

  // A tab the account cannot open (?tab=access on a non-admin, or an admin
  // demoted while the tab was open) would leave Tabs with a value no trigger
  // carries, rendering an empty panel. Fall back to the responses list.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab('responses');
  }, [visibleTabs, activeTab]);

  // Keep the selected event and tab in the URL so a reload, a share, or the back
  // button return to the same place instead of the empty dashboard.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextEvent = selectedEventId ? String(selectedEventId) : null;
    if (params.get('event') === nextEvent && params.get('tab') === activeTab) return;
    if (nextEvent) params.set('event', nextEvent);
    else params.delete('event');
    params.set('tab', activeTab);
    setSearchParams(params, { replace: true });
  }, [selectedEventId, activeTab, setSearchParams]);

  // The theme picker previews each label in that theme's own display font, so
  // the panel needs the whole catalog's typefaces — fetched when it is opened,
  // not before, and never on the guest-facing invitation.
  useEffect(() => {
    if (activeTab === 'theme') preloadThemeFonts();
  }, [activeTab]);

  // A newly picked event starts unfiltered on its responses, rather than
  // inheriting the search left over from the previous one.
  //
  // The tab is deliberately *not* touched here. This effect also runs for the
  // selection made at mount (from ?event=, or the default event), so forcing a
  // per-event tab here threw away the tab the URL asked for — reloading on
  // ?tab=access always bounced back to the responses list. Moving to an event's
  // own tab belongs to an explicit pick, so it lives in selectEvent() below.
  useEffect(() => {
    if (!selectedEventId) return;
    setFilters(NO_FILTERS);
    const ev = events.events.find((e) => e.id === selectedEventId);
    const theme = ev?.theme || DEFAULT_THEME;
    setCurrentTheme(theme);
    applyTheme(theme);
    responses.load(selectedEventId);
    // Re-running this on every `events` refresh would fight the admin's own
    // filters, so it keys off the selection alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  // ---- Actions -------------------------------------------------------------

  // Picking a party from the list means "show me this one", so an account-level
  // tab gives way to its responses. Only for a deliberate pick — the mount-time
  // selection must leave the tab the URL restored alone.
  function selectEvent(id) {
    setSelectedEventId(id);
    setActiveTab((tab) => (TABS.find((t) => t.id === tab)?.needsEvent ? tab : 'responses'));
    // On a phone the grid folds away once there is a fête to work on.
    setEventPickerOpen(false);
  }

  // Topbar refresh: reload everything the console is showing.
  async function refreshAll() {
    setRefreshing(true);
    try {
      // The account list is admin-only; asking for it as a regular account would
      // answer 403 and surface as a "chargement impossible" error on a panel
      // that account cannot even open.
      await Promise.all([
        loadEvents(),
        isAdmin ? accounts.load() : Promise.resolve(),
        selectedEventId ? responses.load(selectedEventId) : Promise.resolve()
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function logout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Clipboard is unavailable outside a secure context; the link stays on
      // screen to copy by hand, so say so rather than failing silently.
      toast.error('Copie impossible, sélectionne le lien à la main.');
      return false;
    }
  }

  async function copyInvitationLink(url) {
    if (!(await copyText(url))) return;
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function copyEventLink(ev) {
    if (await copyText(eventUrl(ev))) toast.success('Lien copié');
  }

  // ---- Theme (scoped to the selected event) --------------------------------
  async function selectTheme(id) {
    if (!selectedEventId || id === currentTheme || themeSaving) return;
    setThemeSaving(true);
    const previous = currentTheme;
    // Optimistically re-skin so the change is instant.
    setCurrentTheme(id);
    applyTheme(id);
    try {
      const saved = await eventsApi.setTheme(selectedEventId, id);
      setCurrentTheme(saved.theme);
      applyTheme(saved.theme);
      events.patch(selectedEventId, { theme: saved.theme });
      toast.success(`Thème « ${getTheme(saved.theme).label} » appliqué.`);
    } catch (err) {
      setCurrentTheme(previous);
      applyTheme(previous);
      if (await onAccessError(err)) return;
      toast.error(err.message);
    } finally {
      setThemeSaving(false);
    }
  }

  // ---- RSVP writes ---------------------------------------------------------

  function openRsvpDialog(mode, rsvp) {
    setRsvpDialog({
      open: true,
      mode,
      saving: false,
      form: rsvp
        ? {
            id: rsvp.id,
            attending: rsvp.attending || 'yes',
            name: rsvp.name,
            email: rsvp.email || '',
            phone: rsvp.phone,
            guests: rsvp.guests || 1,
            dietary_restrictions: rsvp.dietary_restrictions || '',
            message: rsvp.message || '',
            share_response: Boolean(rsvp.share_response)
          }
        : EMPTY_RSVP_FORM
    });
  }

  async function saveRsvp(e) {
    e.preventDefault();
    if (!selectedEventId) return;
    const { mode, form } = rsvpDialog;
    const creating = mode === 'create';
    setRsvpDialog((d) => ({ ...d, saving: true }));
    try {
      // Clearing the number field leaves '' behind, and the API takes a number:
      // posting the empty string failed the save with an untranslated schema
      // error. The field is optional, so omit it and let the server apply its own
      // default (and force 0 on a decline).
      const guests = Number(form.guests);
      const payload = {
        attending: form.attending,
        name: form.name,
        email: form.email,
        phone: form.phone,
        guests: Number.isInteger(guests) ? guests : undefined,
        dietary_restrictions: form.dietary_restrictions,
        message: form.message,
        share_response: form.share_response
      };
      if (creating) await rsvpsApi.add(selectedEventId, payload);
      else await rsvpsApi.edit(selectedEventId, form.id, payload);

      await responses.load(selectedEventId);
      await loadEvents();
      setRsvpDialog((d) => ({ ...d, open: false, saving: false }));
      toast.success(creating ? 'Réponse ajoutée.' : 'Réponse mise à jour.');
    } catch (err) {
      setRsvpDialog((d) => ({ ...d, saving: false }));
      if (await onAccessError(err)) return;
      toast.error(err.message);
    }
  }

  // ---- Event writes --------------------------------------------------------

  function openEventDialog(mode, ev) {
    setEventDialog({
      open: true,
      mode,
      isDefault: !!ev?.is_default,
      saving: false,
      error: null,
      form: ev
        ? {
            id: ev.id,
            person: ev.person || '',
            age: ev.age || '',
            date: ev.date || '',
            time: ev.time || '',
            town: ev.town || '',
            location: ev.location || '',
            dress_code: ev.dress_code || '',
            rsvp_deadline: ev.rsvp_deadline || '',
            theme: ev.theme || DEFAULT_THEME,
            slug: ev.slug || ''
          }
        : EMPTY_EVENT_FORM
    });
  }

  async function saveEvent(e) {
    e.preventDefault();
    const { mode, form, isDefault } = eventDialog;
    if (!form.person || !form.person.trim()) {
      setEventDialog((d) => ({ ...d, error: 'Le nom est requis' }));
      return;
    }
    const creating = mode === 'create';
    setEventDialog((d) => ({ ...d, saving: true, error: null }));
    try {
      const payload = {
        person: form.person.trim(),
        age: form.age,
        date: form.date,
        time: form.time,
        town: form.town,
        location: form.location,
        dress_code: form.dress_code,
        rsvp_deadline: form.rsvp_deadline,
        theme: form.theme
      };
      // Slug is only sent for non-default events when provided.
      if (!isDefault && form.slug && form.slug.trim()) payload.slug = form.slug.trim();

      const saved = creating
        ? await eventsApi.create(payload)
        : await eventsApi.update(form.id, payload);

      await loadEvents();
      // Keep the selected event's theme preview in sync when editing it.
      if (!creating && saved && saved.id === selectedEventId) {
        const nextTheme = saved.theme || currentTheme;
        setCurrentTheme(nextTheme);
        applyTheme(nextTheme);
      }
      setEventDialog((d) => ({ ...d, open: false, saving: false }));
      toast.success(creating ? `Événement « ${saved.person} » créé.` : 'Événement mis à jour.');
      // A brand new event is almost always the one you want to work on next.
      if (creating && saved?.id) selectEvent(saved.id);
    } catch (err) {
      setEventDialog((d) => ({ ...d, saving: false }));
      if (await onAccessError(err)) return;
      setEventDialog((d) => ({ ...d, error: err.message }));
    }
  }

  // ---- Destructive confirmations -------------------------------------------
  //
  // One dialog for the three of them: what it says, and what it runs on
  // confirmation, is all that differs.

  const askDeleteRsvp = (rsvp) =>
    setConfirm({
      title: 'Supprimer la réponse',
      description: (
        <>
          La réponse de <strong className="font-medium text-foreground">{rsvp.name}</strong> sera définitivement
          supprimée. Cette action est irréversible.
        </>
      ),
      async run() {
        await rsvpsApi.remove(selectedEventId, rsvp.id);
        await responses.load(selectedEventId);
        await loadEvents();
        toast.success('Réponse supprimée.');
      }
    });

  const askDeleteEvent = (ev) =>
    setConfirm({
      title: "Supprimer l'événement",
      description: (
        <>
          L'événement de <strong className="font-medium text-foreground">{ev.person}</strong> et toutes ses réponses
          seront perdus. Cette action est irréversible.
        </>
      ),
      async run() {
        await eventsApi.remove(ev.id);
        if (selectedEventId === ev.id) setSelectedEventId(null);
        await loadEvents();
        toast.success('Événement supprimé.');
      }
    });

  const askDeleteUser = (user) =>
    setConfirm({
      title: 'Supprimer le compte',
      description: (
        <>
          <strong className="font-medium text-foreground">{user.email}</strong> perdra immédiatement son accès, et ses
          invitations seront supprimées avec leurs réponses. Cette action est irréversible.
        </>
      ),
      // The accounts hook owns its own reload and toast.
      run: () => accounts.remove(user)
    });

  async function runConfirmed() {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.run();
      setConfirm(null);
    } catch (err) {
      if (await onAccessError(err)) return;
      toast.error(err.message);
    } finally {
      setConfirmBusy(false);
    }
  }

  // ---- Render --------------------------------------------------------------

  const activeTabNeedsEvent = TABS.find((t) => t.id === activeTab)?.needsEvent;
  // Where the topbar's "Voir l'invitation" shortcut goes. It used to be a fixed
  // '/', which is the deployment's default party — the wrong page for anyone
  // running invitations of their own. Follow the selected event instead, and
  // only fall back to '/' when nothing is selected yet.
  const invitationPath = selectedEvent && !selectedEvent.is_default ? `/e/${selectedEvent.slug}` : '/';

  return (
    <div className="flex min-h-full flex-col bg-background">
      <AdminTopbar
        isAdmin={isAdmin}
        email={session.user?.email}
        refreshing={refreshing}
        onRefresh={refreshAll}
        invitationPath={invitationPath}
        onLogout={logout}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-3 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:space-y-5 sm:px-4 sm:py-5">
        <EventPicker
          events={events.events}
          loading={events.loading}
          error={events.error}
          selectedEvent={selectedEvent}
          selectedEventId={selectedEventId}
          isAdmin={isAdmin}
          visible={activeTabNeedsEvent}
          open={eventPickerOpen}
          onOpen={() => setEventPickerOpen(true)}
          onSelect={selectEvent}
          onCreate={() => openEventDialog('create', null)}
          onEdit={(ev) => openEventDialog('edit', ev)}
          onCopyLink={copyEventLink}
          onDelete={askDeleteEvent}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
          {/* Pinned under the topbar on a phone: the sections are the console's
              main navigation and scrolling back up to reach them turned every
              switch into a round trip. The wrapper is what sticks, so the strip
              is opaque edge to edge instead of letting the list scroll past the
              pill's rounded corners. */}
          <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-3 bg-background px-3 py-2 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
              {/* Four labels plus their emoji overflow a 390px strip and the last
                  one gets clipped mid-word; the emoji are decoration, so they are
                  the part that goes. */}
              {visibleTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
                  <span className="hidden sm:inline" aria-hidden="true">
                    {tab.icon}
                  </span>
                  {tab.label}
                  {tab.id === 'responses' && selectedEvent && (
                    <Badge variant="secondary">{responses.stats.total_responses}</Badge>
                  )}
                  {tab.id === 'access' && <Badge variant="secondary">{accounts.users.length}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Shared "no event picked yet" state for the per-event tabs. */}
          {activeTabNeedsEvent && !selectedEvent && (
            <TabsContent value={activeTab}>
              <EmptyState icon="👆" title="Choisis un événement">
                Sélectionne une fête ci-dessus pour voir cette section.
              </EmptyState>
            </TabsContent>
          )}

          {selectedEvent && (
            <TabsContent value="responses" className="space-y-4">
              <ResponsesPanel
                event={selectedEvent}
                stats={responses.stats}
                rsvps={responses.rsvps}
                loading={responses.loading}
                error={responses.error}
                filters={filters}
                onFiltersChange={setFilters}
                onRefresh={() => responses.load(selectedEventId)}
                onCreate={() => openRsvpDialog('create', null)}
                onEdit={(rsvp) => openRsvpDialog('edit', rsvp)}
                onDelete={askDeleteRsvp}
                onClose={() => setSelectedEventId(null)}
                onShare={() => setActiveTab('share')}
                shortcutsEnabled={!anyDialogOpen}
              />
            </TabsContent>
          )}

          {selectedEvent && (
            <TabsContent value="theme">
              <ThemePanel currentTheme={currentTheme} saving={themeSaving} onSelect={selectTheme} />
            </TabsContent>
          )}

          {selectedEvent && (
            <TabsContent value="share">
              <SharePanel event={selectedEvent} onCopyLink={copyInvitationLink} linkCopied={linkCopied} />
            </TabsContent>
          )}

          <TabsContent value="access">
            <AccessPanel
              users={accounts.users}
              loading={accounts.loading}
              error={accounts.error}
              busyId={accounts.busyId}
              currentUserId={currentUserId}
              onRefresh={accounts.load}
              onSetRole={accounts.setRole}
              onDelete={askDeleteUser}
            />
          </TabsContent>
        </Tabs>
      </main>

      <RsvpDialog
        open={rsvpDialog.open}
        onOpenChange={(open) => setRsvpDialog((d) => ({ ...d, open }))}
        mode={rsvpDialog.mode}
        form={rsvpDialog.form}
        onChange={(form) => setRsvpDialog((d) => ({ ...d, form }))}
        saving={rsvpDialog.saving}
        onSubmit={saveRsvp}
      />

      <EventDialog
        open={eventDialog.open}
        onOpenChange={(open) =>
          // Closing by any route (button, overlay, Escape) has to clear the error
          // it may be showing.
          setEventDialog((d) => ({ ...d, open, error: open ? d.error : null }))
        }
        mode={eventDialog.mode}
        isDefaultEvent={eventDialog.isDefault}
        form={eventDialog.form}
        onChange={(form) => setEventDialog((d) => ({ ...d, form }))}
        saving={eventDialog.saving}
        error={eventDialog.error}
        onSubmit={saveEvent}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.title}
        description={confirm?.description}
        busy={confirmBusy}
        onConfirm={runConfirmed}
      />
    </div>
  );
}

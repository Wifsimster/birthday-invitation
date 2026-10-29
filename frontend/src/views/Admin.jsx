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

export default function Admin() {
  const navigate = useNavigate();
  const session = useSession();
  const [, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    return TABS.some((t) => t.id === wanted) ? wanted : 'responses';
  });
  const wantedEventRef = useRef(new URLSearchParams(window.location.search).get('event'));

  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);
  const [themeSaving, setThemeSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [rsvpDialog, setRsvpDialog] = useState({ open: false, mode: 'edit', form: EMPTY_RSVP_FORM, saving: false });
  const [eventDialog, setEventDialog] = useState({
    open: false, mode: 'create', isDefault: false, form: EMPTY_EVENT_FORM, saving: false, error: null
  });
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

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

  const currentUserId = session.user?.id ?? null;
  const isAdmin = session.user?.role === 'admin';
  const visibleTabs = useMemo(() => TABS.filter((t) => !t.adminOnly || isAdmin), [isAdmin]);

  const anyDialogOpen = rsvpDialog.open || eventDialog.open || !!confirm;

  const live = useRef({});
  live.current = { selectedEventId, anyDialogOpen };

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

  useEffect(() => {
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
      setSelectedEventId((current) => {
        if (current !== null || !list.length) return current;
        return (list.find((e) => e.is_default) || list[0]).id;
      });
    });
    if (isAdmin) accounts.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  pollRef.current = usePoll(() => {
    if (live.current.anyDialogOpen) return;
    loadEvents();
    if (live.current.selectedEventId) loadResponses();
  }, POLL_INTERVAL_MS);

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab('responses');
  }, [visibleTabs, activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextEvent = selectedEventId ? String(selectedEventId) : null;
    if (params.get('event') === nextEvent && params.get('tab') === activeTab) return;
    if (nextEvent) params.set('event', nextEvent);
    else params.delete('event');
    params.set('tab', activeTab);
    setSearchParams(params, { replace: true });
  }, [selectedEventId, activeTab, setSearchParams]);

  useEffect(() => {
    if (activeTab === 'theme') preloadThemeFonts();
  }, [activeTab]);

  useEffect(() => {
    if (!selectedEventId) return;
    setFilters(NO_FILTERS);
    const ev = events.events.find((e) => e.id === selectedEventId);
    const theme = ev?.theme || DEFAULT_THEME;
    setCurrentTheme(theme);
    applyTheme(theme);
    responses.load(selectedEventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  function selectEvent(id) {
    setSelectedEventId(id);
    setActiveTab((tab) => (TABS.find((t) => t.id === tab)?.needsEvent ? tab : 'responses'));
    setEventPickerOpen(false);
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
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

  async function selectTheme(id) {
    if (!selectedEventId || id === currentTheme || themeSaving) return;
    setThemeSaving(true);
    const previous = currentTheme;
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
      if (!isDefault && form.slug && form.slug.trim()) payload.slug = form.slug.trim();

      const saved = creating
        ? await eventsApi.create(payload)
        : await eventsApi.update(form.id, payload);

      await loadEvents();
      if (!creating && saved && saved.id === selectedEventId) {
        const nextTheme = saved.theme || currentTheme;
        setCurrentTheme(nextTheme);
        applyTheme(nextTheme);
      }
      setEventDialog((d) => ({ ...d, open: false, saving: false }));
      toast.success(creating ? `Événement « ${saved.person} » créé.` : 'Événement mis à jour.');
      if (creating && saved?.id) selectEvent(saved.id);
    } catch (err) {
      setEventDialog((d) => ({ ...d, saving: false }));
      if (await onAccessError(err)) return;
      setEventDialog((d) => ({ ...d, error: err.message }));
    }
  }

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

  const activeTabNeedsEvent = TABS.find((t) => t.id === activeTab)?.needsEvent;
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
          <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-3 bg-background px-3 py-2 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
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

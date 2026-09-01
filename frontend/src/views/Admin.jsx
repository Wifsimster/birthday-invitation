import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import {
  ArrowUpDownIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleUserIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  LinkIcon,
  Loader2Icon,
  LogOutIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  XIcon
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiBaseUrl } from '../env.js';
import { useSession, refresh, signOut } from '../session.js';
import { themeList, applyTheme, getTheme, DEFAULT_THEME } from '../themes.js';
import { applySeo } from '../seo.js';

// Section tabs. `needsEvent` marks the ones that operate on the selected event;
// "Accès" is account-level and works without one.
const TABS = [
  { id: 'responses', label: 'Réponses', icon: '📋', needsEvent: true },
  { id: 'theme', label: 'Thème', icon: '🎨', needsEvent: true },
  { id: 'share', label: 'Partage', icon: '🔗', needsEvent: true },
  { id: 'access', label: 'Accès', icon: '👥', needsEvent: false }
];

const STATUS_FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'yes', label: 'Confirmées' },
  { id: 'no', label: 'Déclinées' }
];

const EMPTY_RSVP_FORM = {
  id: null,
  attending: 'yes',
  name: '',
  email: '',
  phone: '',
  guests: 1,
  dietary_restrictions: '',
  message: ''
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

const themeIcon = (id) => getTheme(id).icon;
const themeLabel = (id) => getTheme(id).label;

function eventUrl(ev) {
  if (!ev) return `${window.location.origin}/`;
  return ev.is_default ? `${window.location.origin}/` : `${window.location.origin}/e/${ev.slug}`;
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatEventDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

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

  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);
  const [themeSaving, setThemeSaving] = useState(false);

  // Response list controls (client-side over the loaded list).
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const [refreshing, setRefreshing] = useState(false);

  // Accounts / access management
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [userBusyId, setUserBusyId] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);

  // Events overview
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);

  // Selected-event RSVP data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total_responses: 0, confirmations: 0, declined: 0, total_guests: 0 });
  const [rsvps, setRsvps] = useState([]);

  // RSVP edit/create dialog
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMode, setEditMode] = useState('edit');
  const [editForm, setEditForm] = useState(EMPTY_RSVP_FORM);
  const [editLoading, setEditLoading] = useState(false);

  // RSVP delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [rsvpToDelete, setRsvpToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Event create/edit dialog
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventMode, setEventMode] = useState('create');
  const [eventIsDefault, setEventIsDefault] = useState(false);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventError, setEventError] = useState(null);

  // Event delete confirmation
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [deleteEventLoading, setDeleteEventLoading] = useState(false);

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const searchInputRef = useRef(null);
  const editNameRef = useRef(null);
  const eventPersonRef = useRef(null);
  const pollRef = useRef(null);

  const selectedEvent = useMemo(() => events.find((e) => e.id === selectedEventId) || null, [events, selectedEventId]);

  // The signed-in admin, so the users table can mark "vous" and disable the
  // actions the server would refuse anyway (self-demotion, self-deletion).
  const currentUserId = session.user?.id ?? null;

  // Any open dialog pauses the 30s poll: replacing the list under an admin who
  // is mid-edit was how a half-typed response got wiped.
  const anyDialogOpen =
    showEditModal || showEventModal || showDeleteModal || showDeleteEventModal || !!userToDelete;

  // The poll and the "/" shortcut fire from listeners that outlive a render, so
  // they read the live values through a ref rather than a stale closure.
  const live = useRef({});
  live.current = { selectedEventId, anyDialogOpen, activeTab, rsvpsLength: rsvps.length, events };

  const setEditField = (key) => (e) => setEditForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setEventField = (key) => (e) => setEventForm((prev) => ({ ...prev, [key]: e.target.value }));

  // ---- Session / access ----
  //
  // The route guard has already established that this visitor is an admin (see
  // App.jsx), so the view no longer owns a sign-in form. It only has to react to
  // *losing* that access mid-session — an admin revoked while the tab is open —
  // which surfaces as a 401/403 on any admin call.
  //
  // Both failure modes end up here: 401 is a session that ended, 403 the
  // `not_admin` guard on an account demoted while the tab was open. Either way
  // the 30s poll has to stop — otherwise the dashboard sits on an error and
  // keeps spending the admin rate limit — and the cached session has to be
  // re-read, or the route guard would wave the stale user straight back into
  // /admin. Where to send them follows that re-read rather than the status: a
  // session that survived means "no access yet", not "signed out".
  const handleAuthFailure = useCallback(
    async (res) => {
      if (res.status !== 401 && res.status !== 403) return false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      const user = await refresh();
      navigate(user ? '/pending' : '/login', { replace: true });
      return true;
    },
    [navigate]
  );

  // ---- Accounts / access ----
  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const res = await fetch(`${apiBaseUrl}/users`, { credentials: 'include' });
      if (await handleAuthFailure(res)) return;
      if (!res.ok) throw new Error('Chargement des comptes impossible');
      setUsers((await res.json()).users);
    } catch (err) {
      setUsersError(err.message || 'Chargement des comptes impossible');
    } finally {
      setUsersLoading(false);
    }
  }, [handleAuthFailure]);

  // ---- Events overview ----
  const loadEvents = useCallback(async () => {
    try {
      setEventsLoading(true);
      setEventsError(null);
      const res = await fetch(`${apiBaseUrl}/events`, { credentials: 'include' });
      if (!res.ok) {
        if (await handleAuthFailure(res)) return [];
        throw new Error('Erreur lors de la récupération des événements');
      }
      const data = await res.json();
      const list = data.events || [];
      setEvents(list);
      // Clear selection if the selected event no longer exists.
      setSelectedEventId((current) => (current && !list.some((e) => e.id === current) ? null : current));
      return list;
    } catch (err) {
      setEventsError(err.message);
      return [];
    } finally {
      setEventsLoading(false);
    }
  }, [handleAuthFailure]);

  // ---- Selected-event data ----
  const loadEventData = useCallback(async () => {
    const id = live.current.selectedEventId;
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [countRes, listRes] = await Promise.all([
        fetch(`${apiBaseUrl}/events/${id}/rsvps/count`, { credentials: 'include' }),
        fetch(`${apiBaseUrl}/events/${id}/rsvps`, { credentials: 'include' })
      ]);
      if (!countRes.ok || !listRes.ok) {
        if ((await handleAuthFailure(countRes)) || (await handleAuthFailure(listRes))) return;
        throw new Error('Erreur lors de la récupération des données');
      }
      const count = await countRes.json();
      const list = await listRes.json();
      // A slow response for an event the admin has since navigated away from
      // must not overwrite the one now on screen.
      if (live.current.selectedEventId !== id) return;
      setStats({
        total_responses: count.total_responses || 0,
        confirmations: count.confirmations || 0,
        declined: count.declined || 0,
        total_guests: count.total_guests || 0
      });
      setRsvps(list.rsvps || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure]);

  const generateQr = useCallback(async (ev) => {
    try {
      setQrDataUrl(await QRCode.toDataURL(eventUrl(ev), { width: 512, margin: 1 }));
    } catch {
      setQrDataUrl('');
    }
  }, []);

  // ---- Mount: SEO, first load, poll, "/" shortcut ----
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
    loadUsers();
  }, [loadEvents, loadUsers]);

  useEffect(() => {
    // Poll only the data that actually moves: events and their RSVPs. The
    // account list changes rarely and has its own refresh button, and every
    // extra polled call eats into the admin rate limit.
    pollRef.current = setInterval(() => {
      if (live.current.anyDialogOpen) return;
      loadEvents();
      if (live.current.selectedEventId) loadEventData();
    }, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [loadEvents, loadEventData]);

  useEffect(() => {
    // "/" jumps to the response search, the way every list view on the web
    // does. Ignored while typing, and Escape is the dialogs' own business.
    function handleKeydown(e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      const { anyDialogOpen: dialogOpen, activeTab: tab, rsvpsLength } = live.current;
      if (dialogOpen || tab !== 'responses' || !rsvpsLength) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  // Keep the selected event and tab in the URL so a reload, a share, or the
  // back button return to the same place instead of the empty dashboard.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextEvent = selectedEventId ? String(selectedEventId) : null;
    if (params.get('event') === nextEvent && params.get('tab') === activeTab) return;
    if (nextEvent) params.set('event', nextEvent);
    else params.delete('event');
    params.set('tab', activeTab);
    setSearchParams(params, { replace: true });
  }, [selectedEventId, activeTab, setSearchParams]);

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
    const ev = live.current.events.find((e) => e.id === selectedEventId);
    if (!ev) return;
    setSearchQuery('');
    setStatusFilter('all');
    setCurrentTheme(ev.theme || DEFAULT_THEME);
    applyTheme(ev.theme || DEFAULT_THEME);
    generateQr(ev);
    loadEventData();
    // Re-running this on every `events` refresh would fight the admin's own
    // filters, so it keys off the selection alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, generateQr, loadEventData]);

  // ---- Derived ----

  // Share of answers that are a yes. 0 when nobody has replied, rather than NaN
  // from dividing by zero.
  const acceptanceRate = stats.total_responses
    ? Math.round((stats.confirmations / stats.total_responses) * 100)
    : 0;

  // Counts behind the filter buttons, so each one shows its own size.
  const statusCounts = useMemo(
    () => ({
      all: rsvps.length,
      yes: rsvps.filter((r) => r.attending === 'yes').length,
      no: rsvps.filter((r) => r.attending === 'no').length
    }),
    [rsvps]
  );

  const filteredRsvps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = rsvps.filter((r) => {
      if (statusFilter !== 'all' && r.attending !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.email, r.phone].some((v) => (v || '').toLowerCase().includes(q));
    });
    // Sort a copy: `rsvps` is the fetched order and the auto-refresh replaces it
    // wholesale.
    if (sortBy === 'name') return [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    if (sortBy === 'guests') return [...rows].sort((a, b) => (b.guests || 0) - (a.guests || 0));
    return rows;
  }, [rsvps, searchQuery, statusFilter, sortBy]);

  const invitationUrl = eventUrl(selectedEvent);

  const whatsAppShareUrl = useMemo(() => {
    const person = selectedEvent?.person || '';
    const text = person
      ? `Tu es invité(e) à l'anniversaire de ${person} ! 🎉 ${invitationUrl}`
      : `Tu es invité(e) ! 🎉 ${invitationUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [selectedEvent, invitationUrl]);

  const qrFileName = useMemo(() => {
    const person = (selectedEvent?.person || 'invitation')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `qr-${person || 'invitation'}.png`;
  }, [selectedEvent]);

  const csvUrl = selectedEventId ? `${apiBaseUrl}/events/${selectedEventId}/rsvps/export.csv` : '#';

  // ---- Actions ----

  function resetFilters() {
    setSearchQuery('');
    setStatusFilter('all');
  }

  // Picking a party from the list means "show me this one", so an account-level
  // tab gives way to its responses. Only for a deliberate pick — the mount-time
  // selection must leave the tab the URL restored alone.
  function selectEvent(id) {
    setSelectedEventId(id);
    setActiveTab((tab) => (TABS.find((t) => t.id === tab)?.needsEvent ? tab : 'responses'));
  }

  // Topbar refresh: reload everything the console is showing.
  async function refreshAll() {
    setRefreshing(true);
    try {
      await Promise.all([loadEvents(), loadUsers(), selectedEventId ? loadEventData() : Promise.resolve()]);
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

  async function copyLink() {
    if (!(await copyText(invitationUrl))) return;
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function copyEventLink(ev) {
    if (await copyText(eventUrl(ev))) toast.success('Lien copié');
  }

  async function setUserRole(user, role) {
    setUserBusyId(user.id);
    setUsersError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role })
      });
      if (await handleAuthFailure(res)) return;
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Modification impossible');
      await loadUsers();
      toast.success(
        role === 'admin'
          ? `${user.email} a maintenant accès à l'administration.`
          : `L'accès de ${user.email} a été retiré.`
      );
    } catch (err) {
      const message = err.message || 'Modification impossible';
      setUsersError(message);
      toast.error(message);
    } finally {
      setUserBusyId(null);
    }
  }

  async function deleteUser() {
    const target = userToDelete;
    if (!target) return;
    setUserBusyId(target.id);
    setUsersError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/users/${target.id}`, { method: 'DELETE', credentials: 'include' });
      if (await handleAuthFailure(res)) return;
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Suppression impossible');
      setUserToDelete(null);
      await loadUsers();
      toast.success('Compte supprimé.');
    } catch (err) {
      const message = err.message || 'Suppression impossible';
      setUsersError(message);
      toast.error(message);
    } finally {
      setUserBusyId(null);
    }
  }

  // ---- Theme picker (scoped to selected event) ----
  async function selectTheme(id) {
    if (!selectedEventId || id === currentTheme || themeSaving) return;
    setThemeSaving(true);
    const previous = currentTheme;
    // Optimistically re-skin so the change is instant.
    setCurrentTheme(id);
    applyTheme(id);
    try {
      const res = await fetch(`${apiBaseUrl}/events/${selectedEventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: id })
      });
      if (!res.ok) {
        if (await handleAuthFailure(res)) return;
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors du changement de thème');
      }
      const data = await res.json();
      setCurrentTheme(data.theme);
      applyTheme(data.theme);
      // Reflect the new theme in the local list.
      setEvents((list) => list.map((e) => (e.id === selectedEventId ? { ...e, theme: data.theme } : e)));
      toast.success(`Thème « ${getTheme(data.theme).label} » appliqué.`);
    } catch (err) {
      setCurrentTheme(previous);
      applyTheme(previous);
      toast.error(err.message);
    } finally {
      setThemeSaving(false);
    }
  }

  // ---- RSVP edit/create ----
  function openEditModal(rsvp) {
    setEditMode('edit');
    setEditForm({
      id: rsvp.id,
      attending: rsvp.attending || 'yes',
      name: rsvp.name,
      email: rsvp.email || '',
      phone: rsvp.phone,
      guests: rsvp.guests || 1,
      dietary_restrictions: rsvp.dietary_restrictions || '',
      message: rsvp.message || ''
    });
    setShowEditModal(true);
  }

  function openCreateModal() {
    setEditMode('create');
    setEditForm(EMPTY_RSVP_FORM);
    setShowEditModal(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!selectedEventId) return;
    const id = selectedEventId;
    setEditLoading(true);
    try {
      // Clearing the number field leaves '' behind, and the API takes a number:
      // posting the empty string failed the save with an untranslated schema
      // error. The field is optional, so omit it and let the server apply its
      // own default (and force 0 on a decline).
      const guests = Number(editForm.guests);
      const body = JSON.stringify({
        attending: editForm.attending,
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        guests: Number.isInteger(guests) ? guests : undefined,
        dietary_restrictions: editForm.dietary_restrictions,
        message: editForm.message
      });
      const wasCreate = editMode === 'create';
      const res = wasCreate
        ? await fetch(`${apiBaseUrl}/events/${id}/rsvps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body
          })
        : await fetch(`${apiBaseUrl}/events/${id}/rsvp/${editForm.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body
          });
      if (!res.ok) {
        if (await handleAuthFailure(res)) return;
        const err = await res.json();
        throw new Error(err.error || (wasCreate ? "Erreur lors de l'ajout" : 'Erreur lors de la modification'));
      }
      await loadEventData();
      await loadEvents();
      setShowEditModal(false);
      toast.success(wasCreate ? 'Réponse ajoutée.' : 'Réponse mise à jour.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditLoading(false);
    }
  }

  function openDeleteModal(rsvp) {
    setRsvpToDelete(rsvp);
    setShowDeleteModal(true);
  }

  async function deleteRsvp() {
    if (!selectedEventId || !rsvpToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/events/${selectedEventId}/rsvp/${rsvpToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        if (await handleAuthFailure(res)) return;
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la suppression');
      }
      await loadEventData();
      await loadEvents();
      setShowDeleteModal(false);
      setRsvpToDelete(null);
      toast.success('Réponse supprimée.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  // ---- Event create/edit ----
  function openCreateEventModal() {
    setEventMode('create');
    setEventIsDefault(false);
    setEventError(null);
    setEventForm(EMPTY_EVENT_FORM);
    setShowEventModal(true);
  }

  function openEditEventModal(ev) {
    setEventMode('edit');
    setEventIsDefault(!!ev.is_default);
    setEventError(null);
    setEventForm({
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
    });
    setShowEventModal(true);
  }

  async function saveEvent(e) {
    e.preventDefault();
    setEventError(null);
    if (!eventForm.person || !eventForm.person.trim()) {
      setEventError('Le nom est requis');
      return;
    }
    setEventSaving(true);
    try {
      const payload = {
        person: eventForm.person.trim(),
        age: eventForm.age,
        date: eventForm.date,
        time: eventForm.time,
        town: eventForm.town,
        location: eventForm.location,
        dress_code: eventForm.dress_code,
        rsvp_deadline: eventForm.rsvp_deadline,
        theme: eventForm.theme
      };
      // Slug is only sent for non-default events when provided.
      if (!eventIsDefault && eventForm.slug && eventForm.slug.trim()) payload.slug = eventForm.slug.trim();
      const wasCreate = eventMode === 'create';
      const res = wasCreate
        ? await fetch(`${apiBaseUrl}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          })
        : await fetch(`${apiBaseUrl}/events/${eventForm.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });
      if (!res.ok) {
        if (await handleAuthFailure(res)) return;
        const err = await res.json();
        throw new Error(err.error || (wasCreate ? 'Erreur lors de la création' : 'Erreur lors de la modification'));
      }
      const saved = await res.json();
      await loadEvents();
      // Keep the selected event's theme preview in sync when editing it.
      if (!wasCreate && saved && saved.id === selectedEventId) {
        const nextTheme = saved.theme || currentTheme;
        setCurrentTheme(nextTheme);
        applyTheme(nextTheme);
        generateQr(saved);
      }
      setShowEventModal(false);
      toast.success(wasCreate ? `Événement « ${saved.person} » créé.` : 'Événement mis à jour.');
      // A brand new event is almost always the one you want to work on next.
      if (wasCreate && saved?.id) selectEvent(saved.id);
    } catch (err) {
      setEventError(err.message);
    } finally {
      setEventSaving(false);
    }
  }

  function openDeleteEventModal(ev) {
    setEventToDelete(ev);
    setShowDeleteEventModal(true);
  }

  async function deleteEvent() {
    if (!eventToDelete) return;
    const id = eventToDelete.id;
    setDeleteEventLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/events/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        if (await handleAuthFailure(res)) return;
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la suppression');
      }
      if (selectedEventId === id) setSelectedEventId(null);
      await loadEvents();
      setShowDeleteEventModal(false);
      setEventToDelete(null);
      toast.success('Événement supprimé.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteEventLoading(false);
    }
  }

  const activeTabNeedsEvent = TABS.find((t) => t.id === activeTab)?.needsEvent;

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* ===================== TOPBAR =====================
        The actions used to sit side by side and simply ran out of room on a
        phone, squeezing the brand down to a bare emoji. The invitation link and
        sign-out now collapse into a menu below `sm`, so the bar keeps its title
        and every control keeps a 44px touch target. */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
          <span className="text-xl" aria-hidden="true">
            🎉
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-semibold">Administration</p>
            <p className="truncate text-xs leading-tight text-muted-foreground">Événements et confirmations</p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            disabled={refreshing}
            title="Tout actualiser"
            aria-label="Tout actualiser"
            onClick={refreshAll}
          >
            <RefreshCwIcon className={refreshing ? 'animate-spin' : undefined} />
          </Button>

          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/">
              <ExternalLinkIcon />
              Voir l'invitation
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu du compte">
                <CircleUserIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                {session.user?.email || 'Compte'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="sm:hidden">
                <Link to="/">
                  <ExternalLinkIcon />
                  Voir l'invitation
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={logout}>
                <LogOutIcon />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
        {/* ===================== EVENTS OVERVIEW ===================== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span aria-hidden="true">🎈</span> Événements
            </CardTitle>
            <CardDescription>
              Sélectionne une fête pour gérer ses réponses, son thème et son lien.
            </CardDescription>
            <CardAction>
              <Button size="sm" onClick={openCreateEventModal}>
                <PlusIcon />
                Nouvel événement
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent>
            {eventsLoading && !events.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
                <span className="sr-only">Chargement des événements...</span>
                {[0, 1, 2].map((n) => (
                  <Skeleton key={n} className="h-44 w-full rounded-xl" />
                ))}
              </div>
            ) : eventsError ? (
              <Alert variant="destructive" role="alert">
                <CircleAlertIcon />
                <AlertTitle>Chargement impossible</AlertTitle>
                <AlertDescription>{eventsError}</AlertDescription>
              </Alert>
            ) : !events.length ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
                <span className="text-3xl" aria-hidden="true">
                  🎂
                </span>
                <div>
                  <p className="font-medium">Aucun événement pour le moment</p>
                  <p className="text-sm text-muted-foreground">Crée une première fête pour ouvrir les invitations.</p>
                </div>
                <Button size="sm" onClick={openCreateEventModal}>
                  <PlusIcon />
                  Nouvel événement
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* The whole card selects the event: the title button carries a
                    stretched hit area so there is still exactly one focusable
                    control for it, and the menu sits above that layer. */}
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className={`relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors ${
                      ev.id === selectedEventId
                        ? 'border-primary ring-3 ring-ring/25'
                        : 'hover:border-primary/40 hover:bg-accent/40'
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
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions pour ${ev.person || 'cet événement'}`}
                            >
                              <EllipsisVerticalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEditEventModal(ev)}>
                              <PencilIcon />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => copyEventLink(ev)}>
                              <LinkIcon />
                              Copier le lien
                            </DropdownMenuItem>
                            {!ev.is_default && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => openDeleteEventModal(ev)}>
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
                        <button
                          type="button"
                          className="text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                          aria-pressed={ev.id === selectedEventId}
                          onClick={() => selectEvent(ev.id)}
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
                      <p className="mt-1 text-xs tracking-wide uppercase text-muted-foreground">
                        {themeLabel(ev.theme)}
                      </p>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===================== SECTION TABS ===================== */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
          {/* Full width on a phone so the four tabs share the strip; back to
              shadcn's content width once there is room to spare. */}
          <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
            {/* Four labels plus their emoji overflow a 390px strip and the last
                one gets clipped mid-word; the emoji are decoration, so they are
                the part that goes. */}
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
                <span className="hidden sm:inline" aria-hidden="true">
                  {tab.icon}
                </span>
                {tab.label}
                {tab.id === 'responses' && selectedEvent && <Badge variant="secondary">{stats.total_responses}</Badge>}
                {tab.id === 'access' && <Badge variant="secondary">{users.length}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Shared "no event picked yet" state for the per-event tabs. */}
          {activeTabNeedsEvent && !selectedEvent && (
            <TabsContent value={activeTab}>
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
                <span className="text-3xl" aria-hidden="true">
                  👆
                </span>
                <p className="font-medium">Choisis un événement</p>
                <p className="text-sm text-muted-foreground">
                  Sélectionne une fête ci-dessus pour voir cette section.
                </p>
              </div>
            </TabsContent>
          )}

          {/* ---------- Responses ---------- */}
          {selectedEvent && (
            <TabsContent value="responses" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  Gestion : <span className="text-primary">{selectedEvent.person || 'Sans nom'}</span>
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEventId(null)}>
                  <XIcon />
                  Fermer
                </Button>
              </div>

              {/* Two columns on a phone instead of one: the cards were stacking
                  full-width, so the five figures took a whole screen to read. */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-lg" aria-hidden="true">
                    📨
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{stats.total_responses}</div>
                  <div className="text-xs tracking-wide uppercase text-muted-foreground">Total réponses</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-lg" aria-hidden="true">
                    ✅
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-success">{stats.confirmations}</div>
                  <div className="text-xs tracking-wide uppercase text-muted-foreground">Confirmations</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-lg" aria-hidden="true">
                    ❌
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-destructive">{stats.declined}</div>
                  <div className="text-xs tracking-wide uppercase text-muted-foreground">Déclins</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-lg" aria-hidden="true">
                    👥
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{stats.total_guests}</div>
                  <div className="text-xs tracking-wide uppercase text-muted-foreground">Total invités</div>
                </div>
                <div className="col-span-2 rounded-xl border bg-card p-4 lg:col-span-1">
                  <div className="text-lg" aria-hidden="true">
                    📊
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{acceptanceRate}%</div>
                  <Progress
                    value={acceptanceRate}
                    className="my-2"
                    aria-label={`Taux d'acceptation ${acceptanceRate} %`}
                  />
                  <div className="text-xs tracking-wide uppercase text-muted-foreground">Taux d'acceptation</div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Réponses</CardTitle>
                  <CardDescription>
                    Les réponses arrivent en direct, la liste se rafraîchit toute seule.
                  </CardDescription>
                  <CardAction className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" disabled={loading} onClick={loadEventData}>
                      <RefreshCwIcon className={loading ? 'animate-spin' : undefined} />
                      <span className="sr-only sm:not-sr-only">Actualiser</span>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={csvUrl}>
                        <DownloadIcon />
                        <span className="sr-only sm:not-sr-only">Exporter CSV</span>
                      </a>
                    </Button>
                    <Button size="sm" onClick={openCreateModal}>
                      <PlusIcon />
                      Ajouter
                    </Button>
                  </CardAction>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Search, status filter and sort. All client-side over the
                      already loaded list, so filtering never costs a request. */}
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
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <Select value={sortBy} onValueChange={setSortBy}>
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
                            variant={statusFilter === f.id ? 'default' : 'outline'}
                            aria-pressed={statusFilter === f.id}
                            onClick={() => setStatusFilter(f.id)}
                          >
                            {f.label}
                            <Badge variant={statusFilter === f.id ? 'secondary' : 'outline'}>
                              {statusCounts[f.id]}
                            </Badge>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {loading && !rsvps.length ? (
                    <div className="space-y-3" aria-live="polite">
                      <span className="sr-only">Chargement des réponses...</span>
                      {[0, 1, 2].map((n) => (
                        <Skeleton key={n} className="h-28 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : error ? (
                    <Alert variant="destructive" role="alert">
                      <CircleAlertIcon />
                      <AlertTitle>Chargement impossible</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : !rsvps.length ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
                      <span className="text-3xl" aria-hidden="true">
                        📭
                      </span>
                      <p className="font-medium">Aucune réponse pour le moment</p>
                      <p className="text-sm text-muted-foreground">
                        Partage le lien de l'invitation pour lancer les réponses.
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setActiveTab('share')}>
                        <LinkIcon />
                        Partager l'invitation
                      </Button>
                    </div>
                  ) : !filteredRsvps.length ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
                      <span className="text-3xl" aria-hidden="true">
                        🔍
                      </span>
                      <p className="font-medium">Aucun résultat</p>
                      <p className="text-sm text-muted-foreground">Aucune réponse ne correspond à cette recherche.</p>
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        Réinitialiser
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground" aria-live="polite">
                        {filteredRsvps.length} réponse{filteredRsvps.length > 1 ? 's' : ''} affichée
                        {filteredRsvps.length > 1 ? 's' : ''}
                        {filteredRsvps.length !== rsvps.length && ` sur ${rsvps.length}`}
                      </p>

                      <ul className="space-y-3">
                        {filteredRsvps.map((rsvp) => (
                          <li
                            key={rsvp.id}
                            className={`rounded-xl border bg-card p-4 ${
                              rsvp.attending === 'yes'
                                ? 'border-l-4 border-l-success'
                                : 'border-l-4 border-l-destructive'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="flex min-w-0 items-center gap-2 font-semibold">
                                <span aria-hidden="true">{rsvp.attending === 'yes' ? '✅' : '❌'}</span>
                                <span className="truncate">{rsvp.name}</span>
                              </h3>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Modifier la réponse de ${rsvp.name}`}
                                  onClick={() => openEditModal(rsvp)}
                                >
                                  <PencilIcon />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={`Supprimer la réponse de ${rsvp.name}`}
                                  onClick={() => openDeleteModal(rsvp)}
                                >
                                  <Trash2Icon />
                                </Button>
                              </div>
                            </div>

                            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">Statut</dt>
                                <dd
                                  className={
                                    rsvp.attending === 'yes'
                                      ? 'font-semibold text-success'
                                      : 'font-semibold text-destructive'
                                  }
                                >
                                  {rsvp.attending === 'yes' ? 'Confirmé' : 'Décliné'}
                                </dd>
                              </div>
                              {rsvp.email && (
                                <div className="flex min-w-0 gap-2">
                                  <dt className="font-medium text-muted-foreground">✉️ Email</dt>
                                  <dd className="truncate">
                                    <a className="underline-offset-4 hover:underline" href={`mailto:${rsvp.email}`}>
                                      {rsvp.email}
                                    </a>
                                  </dd>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <dt className="font-medium text-muted-foreground">📱 Téléphone</dt>
                                <dd>
                                  <a className="underline-offset-4 hover:underline" href={`tel:${rsvp.phone}`}>
                                    {rsvp.phone}
                                  </a>
                                </dd>
                              </div>
                              {rsvp.attending === 'yes' && (
                                <div className="flex gap-2">
                                  <dt className="font-medium text-muted-foreground">👥 Invités</dt>
                                  <dd>{rsvp.guests}</dd>
                                </div>
                              )}
                              {rsvp.dietary_restrictions && (
                                <div className="flex gap-2 sm:col-span-2">
                                  <dt className="font-medium text-muted-foreground">🥜 Allergies</dt>
                                  <dd>{rsvp.dietary_restrictions}</dd>
                                </div>
                              )}
                              <div className="flex gap-2 sm:col-span-2">
                                <dt className="font-medium text-muted-foreground">🕒 Mis à jour</dt>
                                <dd className="text-muted-foreground">{formatDate(rsvp.updated_at)}</dd>
                              </div>
                            </dl>

                            {rsvp.message && (
                              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">💌 {rsvp.message}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ---------- Theme ---------- */}
          {selectedEvent && (
            <TabsContent value="theme">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span aria-hidden="true">🎨</span> Thème de l'invitation
                  </CardTitle>
                  <CardDescription>
                    Choisis l'ambiance affichée aux invités. Le changement est immédiat.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {themeList.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 ${
                          t.id === currentTheme
                            ? 'border-primary ring-3 ring-ring/25'
                            : 'hover:border-primary/40 hover:bg-accent/40'
                        }`}
                        disabled={themeSaving}
                        aria-pressed={t.id === currentTheme}
                        onClick={() => selectTheme(t.id)}
                      >
                        <span className="text-2xl" aria-hidden="true">
                          {t.icon}
                        </span>
                        <span className="text-sm font-medium">{t.label}</span>
                        <span className="flex gap-1" aria-hidden="true">
                          <span
                            className="size-3 rounded-full ring-1 ring-black/10"
                            style={{ background: t.palette.primary }}
                          />
                          <span
                            className="size-3 rounded-full ring-1 ring-black/10"
                            style={{ background: t.palette.secondary }}
                          />
                          <span
                            className="size-3 rounded-full ring-1 ring-black/10"
                            style={{ background: t.palette.accent }}
                          />
                        </span>
                        {t.id === currentTheme && (
                          <Badge className="bg-success text-success-foreground">
                            <CheckIcon />
                            Actif
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ---------- Share ---------- */}
          {selectedEvent && (
            <TabsContent value="share">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span aria-hidden="true">🔗</span> Partager l'invitation
                  </CardTitle>
                  <CardDescription>Diffuse ce lien ou ce QR code pour inviter tes convives.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={invitationUrl}
                      readOnly
                      aria-label="Lien de l'invitation"
                      onFocus={(e) => e.target.select()}
                    />
                    <Button className="shrink-0" onClick={copyLink}>
                      {linkCopied ? <CheckIcon /> : <CopyIcon />}
                      {linkCopied ? 'Copié' : 'Copier le lien'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={whatsAppShareUrl} target="_blank" rel="noopener">
                        <SendIcon />
                        Envoyer sur WhatsApp
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={invitationUrl} target="_blank" rel="noopener">
                        <ExternalLinkIcon />
                        Ouvrir l'invitation
                      </a>
                    </Button>
                    {qrDataUrl && (
                      <Button asChild variant="outline" size="sm">
                        <a href={qrDataUrl} download={qrFileName}>
                          <DownloadIcon />
                          Télécharger le QR
                        </a>
                      </Button>
                    )}
                  </div>
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR code de l'invitation"
                      className="mx-auto size-48 rounded-xl border bg-white p-2 sm:mx-0"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ---------- Access / users ---------- */}
          <TabsContent value="access">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span aria-hidden="true">👥</span> Accès
                </CardTitle>
                <CardDescription>
                  Toute personne peut créer un compte, mais seuls les comptes{' '}
                  <strong className="font-medium">administrateur</strong> accèdent à cette page.
                </CardDescription>
                <CardAction>
                  <Button variant="outline" size="sm" disabled={usersLoading} onClick={loadUsers}>
                    <RefreshCwIcon className={usersLoading ? 'animate-spin' : undefined} />
                    <span className="sr-only sm:not-sr-only">Actualiser</span>
                  </Button>
                </CardAction>
              </CardHeader>

              <CardContent>
                {usersLoading && !users.length ? (
                  <div className="space-y-2" aria-live="polite">
                    <span className="sr-only">Chargement des comptes...</span>
                    {[0, 1, 2].map((n) => (
                      <Skeleton key={n} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : usersError ? (
                  <Alert variant="destructive" role="alert">
                    <CircleAlertIcon />
                    <AlertTitle>Chargement impossible</AlertTitle>
                    <AlertDescription>{usersError}</AlertDescription>
                  </Alert>
                ) : (
                  /* A table below `sm` turned into stacked cells with no
                     headers, so small screens get purpose-built rows instead. */
                  <>
                    <ul className="divide-y sm:hidden">
                      {users.map((u) => (
                        <li key={u.id} className="flex flex-col gap-2 py-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium">
                              <span className="truncate">{u.name || '—'}</span>
                              {u.id === currentUserId && <Badge variant="secondary">vous</Badge>}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>
                                {u.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                              </Badge>
                              {!u.emailVerified && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  non confirmé
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {u.role !== 'admin' ? (
                              <Button size="sm" disabled={userBusyId === u.id} onClick={() => setUserRole(u, 'admin')}>
                                Donner l'accès
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={userBusyId === u.id || u.id === currentUserId}
                                onClick={() => setUserRole(u, 'user')}
                              >
                                Retirer l'accès
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={userBusyId === u.id || u.id === currentUserId}
                              onClick={() => setUserToDelete(u)}
                            >
                              Supprimer
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Compte</TableHead>
                            <TableHead>Rôle</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell>
                                <div className="flex items-center gap-2 font-medium">
                                  {u.name || '—'}
                                  {u.id === currentUserId && <Badge variant="secondary">vous</Badge>}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  {u.email}
                                  {!u.emailVerified && (
                                    <Badge variant="outline" title="Email non confirmé">
                                      non confirmé
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>
                                  {u.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {u.role !== 'admin' ? (
                                  <Button
                                    size="sm"
                                    disabled={userBusyId === u.id}
                                    onClick={() => setUserRole(u, 'admin')}
                                  >
                                    Donner l'accès
                                  </Button>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={userBusyId === u.id || u.id === currentUserId}
                                    onClick={() => setUserRole(u, 'user')}
                                  >
                                    Retirer l'accès
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="ml-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={userBusyId === u.id || u.id === currentUserId}
                                  onClick={() => setUserToDelete(u)}
                                >
                                  Supprimer
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ===================== RSVP CREATE/EDIT ===================== */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogScrollContent
          className="sm:max-w-lg"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            editNameRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{editMode === 'create' ? 'Ajouter une réponse' : 'Modifier la réponse'}</DialogTitle>
            <DialogDescription>
              {editMode === 'create'
                ? 'Enregistre une réponse reçue par téléphone ou de vive voix.'
                : 'Mets à jour la réponse de cet invité.'}
            </DialogDescription>
          </DialogHeader>

          <form id="rsvp-form" className="grid gap-4" onSubmit={saveEdit}>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">
                Statut{' '}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <Select
                value={editForm.attending}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, attending: value }))}
              >
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
                Nom{' '}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input id="edit-name" ref={editNameRef} required value={editForm.name} onChange={setEditField('name')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">
                <span aria-hidden="true">📱</span> Téléphone{' '}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="edit-phone"
                type="tel"
                inputMode="tel"
                required
                value={editForm.phone}
                onChange={setEditField('phone')}
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
                value={editForm.email}
                onChange={setEditField('email')}
              />
            </div>
            {editForm.attending === 'yes' && (
              <div className="grid gap-2">
                <Label htmlFor="edit-guests">Nombre d'invités</Label>
                <Input
                  id="edit-guests"
                  type="number"
                  min="0"
                  max="10"
                  inputMode="numeric"
                  value={editForm.guests}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      guests: e.target.value === '' ? '' : Number(e.target.value)
                    }))
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
                value={editForm.dietary_restrictions}
                onChange={setEditField('dietary_restrictions')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-message">
                <span aria-hidden="true">💌</span> Message
              </Label>
              <Textarea id="edit-message" value={editForm.message} onChange={setEditField('message')} />
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
              Annuler
            </Button>
            <Button type="submit" form="rsvp-form" disabled={editLoading}>
              {editLoading && <Loader2Icon className="animate-spin" />}
              {editLoading ? 'Sauvegarde...' : editMode === 'create' ? 'Ajouter' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>

      {/* ===================== EVENT CREATE/EDIT ===================== */}
      <Dialog
        open={showEventModal}
        onOpenChange={(open) => {
          setShowEventModal(open);
          // Closing by any route (button, overlay, Escape) has to clear the
          // error it may be showing.
          if (!open) setEventError(null);
        }}
      >
        <DialogScrollContent
          className="sm:max-w-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            eventPersonRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{eventMode === 'create' ? 'Nouvel événement' : "Modifier l'événement"}</DialogTitle>
            <DialogDescription>
              Seul le nom est obligatoire — le reste peut être complété plus tard.
            </DialogDescription>
          </DialogHeader>

          <form id="event-form" className="grid gap-4" onSubmit={saveEvent}>
            <div className="grid gap-2">
              <Label htmlFor="event-person">
                Nom de l'enfant{' '}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="event-person"
                ref={eventPersonRef}
                required
                value={eventForm.person}
                onChange={setEventField('person')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="event-age">Âge</Label>
                <Input id="event-age" placeholder="5" value={eventForm.age} onChange={setEventField('age')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-date">Date</Label>
                <Input id="event-date" type="date" value={eventForm.date} onChange={setEventField('date')} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="event-time">Horaire</Label>
                <Input
                  id="event-time"
                  placeholder="15h00 - 17h00"
                  value={eventForm.time}
                  onChange={setEventField('time')}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-town">Ville</Label>
                <Input id="event-town" value={eventForm.town} onChange={setEventField('town')} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-location">Lieu</Label>
              <Textarea id="event-location" value={eventForm.location} onChange={setEventField('location')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="event-dress">Dress code</Label>
                <Input id="event-dress" value={eventForm.dress_code} onChange={setEventField('dress_code')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-deadline">Date limite de réponse</Label>
                <Input
                  id="event-deadline"
                  type="date"
                  value={eventForm.rsvp_deadline}
                  onChange={setEventField('rsvp_deadline')}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-theme">Thème</Label>
              <Select
                value={eventForm.theme}
                onValueChange={(value) => setEventForm((prev) => ({ ...prev, theme: value }))}
              >
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
            {!eventIsDefault && (
              <div className="grid gap-2">
                <Label htmlFor="event-slug">Lien (slug)</Label>
                <Input
                  id="event-slug"
                  placeholder="laisser vide pour générer automatiquement"
                  value={eventForm.slug}
                  onChange={setEventField('slug')}
                />
                <p className="text-sm text-muted-foreground">Laisser vide pour générer automatiquement.</p>
              </div>
            )}
            {eventError && (
              <Alert variant="destructive" role="alert">
                <CircleAlertIcon />
                <AlertDescription>{eventError}</AlertDescription>
              </Alert>
            )}
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowEventModal(false)}>
              Annuler
            </Button>
            <Button type="submit" form="event-form" disabled={eventSaving}>
              {eventSaving && <Loader2Icon className="animate-spin" />}
              {eventSaving ? 'Sauvegarde...' : eventMode === 'create' ? 'Créer' : 'Sauvegarder'}
            </Button>
          </DialogFooter>
        </DialogScrollContent>
      </Dialog>

      {/* ===================== DESTRUCTIVE CONFIRMATIONS ===================== */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la réponse</AlertDialogTitle>
            <AlertDialogDescription>
              La réponse de <strong className="font-medium text-foreground">{rsvpToDelete?.name}</strong> sera
              définitivement supprimée. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={deleteLoading}
              onClick={(e) => {
                e.preventDefault();
                deleteRsvp();
              }}
            >
              {deleteLoading && <Loader2Icon className="animate-spin" />}
              {deleteLoading ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteEventModal} onOpenChange={setShowDeleteEventModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'événement</AlertDialogTitle>
            <AlertDialogDescription>
              L'événement de <strong className="font-medium text-foreground">{eventToDelete?.person}</strong> et
              toutes ses réponses seront perdus. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={deleteEventLoading}
              onClick={(e) => {
                e.preventDefault();
                deleteEvent();
              }}
            >
              {deleteEventLoading && <Loader2Icon className="animate-spin" />}
              {deleteEventLoading ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!userToDelete}
        onOpenChange={(open) => {
          if (!open) setUserToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le compte</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="font-medium text-foreground">{userToDelete?.email}</strong> perdra immédiatement son
              accès. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={!!userBusyId}
              onClick={(e) => {
                e.preventDefault();
                deleteUser();
              }}
            >
              {userBusyId && <Loader2Icon className="animate-spin" />}
              {userBusyId ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

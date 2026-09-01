import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Building2Icon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  CircleAlertIcon,
  DownloadIcon,
  Loader2Icon,
  MapPinIcon,
  Share2Icon,
  ShirtIcon
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { eventConfig, apiBaseUrl } from '../env.js';
import { applyTheme, getTheme, DEFAULT_THEME } from '../themes.js';
import { applySeo, eventSeo, ogImageUrl } from '../seo.js';

// Where the floating emoji sit. Indexed by position in the theme's list, so a
// theme with more or fewer decorations still scatters evenly.
const DECORATION_POSITIONS = [
  'top-[10%] left-[15%]',
  'top-[20%] right-[20%]',
  'top-[60%] left-[10%]',
  'top-[70%] right-[15%]',
  'bottom-[20%] left-[20%]',
  'bottom-[10%] right-[25%]'
];

const ATTENDING_OPTIONS = [
  { value: 'yes', label: 'Oui, je viens ! 🎈' },
  { value: 'no', label: 'Non, je ne peux pas venir 😔' }
];

const EMPTY_FORM = {
  attending: 'yes',
  name: '',
  phone: '',
  email: '',
  guests: 1,
  dietary_restrictions: '',
  message: ''
};

/**
 * Parse a stored 'YYYY-MM-DD' event date into a Date anchored at *local* noon.
 *
 * `new Date('2025-09-06')` is midnight UTC, and every reader below formats in
 * the viewer's own zone — so anyone west of UTC saw the party advertised a day
 * early, and the countdown's "c'est aujourd'hui" flipped on the wrong date.
 * Noon local keeps the day that was typed intact in every timezone, which is
 * what the server already does when it renders the same date into the shell
 * (see server/src/seo.ts).
 */
function parseEventDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12)
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(date) {
  const d = parseEventDate(date);
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function Invitation() {
  const { slug = '' } = useParams();
  const effectiveSlug = slug || 'default';
  // Only seed from the env.js fallback on the default route, to avoid a blank
  // flash; the API response is the source of truth and overrides this.
  const isDefault = !slug;

  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [now, setNow] = useState(() => Date.now());
  const [notFound, setNotFound] = useState(false);
  const [rsvpClosed, setRsvpClosed] = useState(false);

  const [event, setEvent] = useState(() => ({
    birthdayPerson: isDefault ? eventConfig.birthdayPerson : '',
    age: isDefault ? eventConfig.age : '',
    eventDate: isDefault ? parseEventDate(eventConfig.eventDate) : null,
    eventTime: isDefault ? eventConfig.eventTime : '',
    eventTown: isDefault ? eventConfig.eventTown : '',
    eventLocation: isDefault ? eventConfig.eventLocation : '',
    dresscode: isDefault ? eventConfig.dresscode : '',
    rsvpDeadline: isDefault ? eventConfig.rsvpDeadline : ''
  }));

  const [showRsvpForm, setShowRsvpForm] = useState(false);
  const [showLookupForm, setShowLookupForm] = useState(false);
  // True while the card's own RSVP buttons are on screen. The sticky bar at the
  // bottom of a phone screen is a stand-in for them, so it steps aside rather
  // than offering the same action twice.
  const [ctaOnScreen, setCtaOnScreen] = useState(true);
  const [confirmed, setConfirmed] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupPhoneNumber, setLookupPhoneNumber] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);

  const ctaRef = useRef(null);
  const formPanelRef = useRef(null);
  const formHeadingRef = useRef(null);

  const themeDef = getTheme(theme);
  const setField = (key) => (event_) => setFormData((prev) => ({ ...prev, [key]: event_.target.value }));

  const formattedDate = formatDate(event.eventDate);

  // Keep the tab title, the share sheet and the canonical URL in step with the
  // event actually on screen. The first paint's tags come from the server.
  const updateSeo = useCallback(
    (data, missing) => {
      if (missing) {
        applySeo({
          title: 'Événement introuvable',
          description: "Cette invitation n'existe pas ou n'est plus disponible.",
          robots: 'noindex, follow'
        });
        return;
      }
      const { title, description } = eventSeo({
        person: data.birthdayPerson,
        age: data.age,
        formattedDate: formatDate(data.eventDate),
        time: data.eventTime,
        town: data.eventTown,
        location: data.eventLocation,
        rsvpClosed: data.rsvpClosed
      });
      applySeo({ title, description, image: ogImageUrl(apiBaseUrl, slug) });
    },
    [slug]
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Paint the (fallback) theme immediately, then upgrade to the event's theme
  // once the public event endpoint responds.
  //
  // No updateSeo() on mount: the server already injected this event's tags into
  // the shell. Overwriting them with the seed values before the fetch lands
  // would only downgrade them (and lose them entirely if the fetch fails).
  useEffect(() => {
    let cancelled = false;
    applyTheme(DEFAULT_THEME);
    setNotFound(false);

    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/events/${encodeURIComponent(effectiveSlug)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          updateSeo(null, true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const next = {
          birthdayPerson: data.person || '',
          // Free-form on the server ("5", "18 mois"): keep the string so the
          // badge and the title match the share card instead of blanking on a
          // non-number.
          age: String(data.age ?? '').trim(),
          eventDate: parseEventDate(data.date),
          eventTime: data.time || '',
          eventTown: data.town || '',
          eventLocation: data.location || '',
          dresscode: data.dress_code || '',
          rsvpDeadline: data.rsvp_deadline || ''
        };
        setEvent(next);
        setRsvpClosed(!!data.rsvp_closed);
        if (data.theme) {
          setTheme(data.theme);
          applyTheme(data.theme);
        }
        updateSeo({ ...next, rsvpClosed: !!data.rsvp_closed }, false);
      } catch {
        // Keep whatever we have (fallback paint) when the event can't be fetched.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, updateSeo]);

  const eventStart = useMemo(() => parseEventDate(event.eventDate), [event.eventDate]);

  const countdown = useMemo(() => {
    if (!eventStart) return null;
    const diff = eventStart.getTime() - now;
    const dayMs = 86400000;
    if (eventStart.toDateString() === new Date(now).toDateString()) return { isToday: true };
    if (diff <= 0) return { isPast: true };
    return {
      days: Math.floor(diff / dayMs),
      hours: Math.floor((diff % dayMs) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000)
    };
  }, [eventStart, now]);

  // The countdown as three labelled figures, so the markup stays flat.
  const countdownUnits =
    !countdown || countdown.isToday || countdown.isPast
      ? []
      : [
          { value: countdown.days, label: 'jours' },
          { value: countdown.hours, label: 'heures' },
          { value: countdown.minutes, label: 'min' }
        ];

  const countdownAria = !countdown
    ? ''
    : countdown.isToday
      ? "C'est aujourd'hui"
      : countdown.isPast
        ? 'La fête est passée'
        : `Encore ${countdown.days} jours`;

  const mapUrl = useMemo(() => {
    const q = [event.eventLocation, event.eventTown].filter(Boolean).join(', ');
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
  }, [event.eventLocation, event.eventTown]);

  // The filled-in facts, in display order. Building the list here keeps the
  // "hide what we do not know" rule in one place instead of a conditional per
  // tile.
  const eventDetails = useMemo(() => {
    const rows = [];
    // Date and time are not repeated here: the hero above the call to action
    // already carries them.
    if (event.eventTown) rows.push({ label: 'Ville', value: event.eventTown, icon: Building2Icon });
    if (event.eventLocation) {
      rows.push({ label: 'Lieu', value: event.eventLocation, icon: MapPinIcon, href: mapUrl || undefined });
    }
    if (event.dresscode) rows.push({ label: 'Tenue', value: event.dresscode, icon: ShirtIcon });
    return rows;
  }, [event.eventTown, event.eventLocation, event.dresscode, mapUrl]);

  // The three usual answers, plus the recorded value when a response the host
  // entered by hand carries more people than the form normally offers — the
  // select would otherwise render blank and silently drop the guest's count.
  const guestOptions = useMemo(() => {
    const options = [
      { value: 1, label: "1 personne (juste l'enfant)" },
      { value: 2, label: '2 personnes (enfant + 1 accompagnateur)' },
      { value: 3, label: '3 personnes (enfant + 2 accompagnateurs)' }
    ];
    const current = Number(formData.guests);
    if (Number.isInteger(current) && current > 3) options.push({ value: current, label: `${current} personnes` });
    return options;
  }, [formData.guests]);

  const formatDeadline = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.rsvpDeadline)) return '';
    return new Date(`${event.rsvpDeadline}T12:00:00`).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }, [event.rsvpDeadline]);

  const icsUrl = `${apiBaseUrl}/events/${encodeURIComponent(effectiveSlug)}/event.ics`;

  const rsvpOpen = !notFound && !confirmed && !rsvpClosed;
  // The bar only earns its space while there is an answer to give. The page
  // reserves room for it as soon as it *could* appear, not only while it is
  // showing: growing and shrinking the document under a scrolling finger is
  // what makes a page feel like it is fighting back.
  const stickyCtaPossible = rsvpOpen && !showRsvpForm && !showLookupForm;
  const showStickyCta = stickyCtaPossible && !ctaOnScreen;

  const googleCalUrl = useMemo(() => {
    if (!eventStart) return '';
    const d = eventStart;
    const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    // All-day event spanning the party date (end is exclusive next day).
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const dayNext = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
    const title = `Anniversaire de ${event.birthdayPerson}${event.age ? ` (${event.age} ans)` : ''}`;
    const details = [event.eventTime, event.dresscode].filter(Boolean).join(' — ');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${day}/${dayNext}`,
      details,
      location: [event.eventLocation, event.eventTown].filter(Boolean).join(', ')
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, [eventStart, event]);

  const messagePlaceholder =
    formData.attending === 'yes'
      ? 'Un petit mot pour nous dire votre joie de venir...'
      : "Un petit mot pour s'excuser...";

  // Track the card's RSVP buttons so the sticky bar can stand in for them.
  useEffect(() => {
    const node = ctaRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setCtaOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setCtaOnScreen(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [rsvpOpen, showRsvpForm, showLookupForm]);

  // Opening a form from the sticky bar (or from buttons the page has scrolled
  // past) has to bring the form into view, or the tap looks like it did
  // nothing. Focus goes to the heading rather than the first field: moving it
  // into an input would throw up the on-screen keyboard over the form the
  // visitor has not read yet.
  useEffect(() => {
    if (!showRsvpForm && !showLookupForm) return;
    formPanelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    formHeadingRef.current?.focus({ preventScroll: true });
  }, [showRsvpForm, showLookupForm]);

  function openRsvpForm() {
    setErrorMessage('');
    setShowRsvpForm(true);
  }

  function openLookupForm() {
    setErrorMessage('');
    setShowLookupForm(true);
  }

  function cancelForm() {
    setShowRsvpForm(false);
    setShowLookupForm(false);
    setErrorMessage('');
  }

  function resetForm() {
    setConfirmed(null);
    setShowRsvpForm(false);
    setShowLookupForm(false);
    setErrorMessage('');
    setLookupPhoneNumber('');
    setFormData(EMPTY_FORM);
  }

  async function share() {
    const url = window.location.href;
    const title = `Anniversaire de ${event.birthdayPerson}`;
    const text = `${title} — tu es invité(e) ! 🎉`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (err) {
      // User dismissed the native sheet — done. Any other failure falls
      // through to the clipboard path below.
      if (err && err.name === 'AbortError') return;
    }
    // No native share sheet (most desktops): copy the link and *offer*
    // WhatsApp rather than opening a tab the visitor never asked for.
    const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié', {
        action: { label: 'WhatsApp', onClick: () => window.open(whatsapp, '_blank', 'noopener') }
      });
    } catch {
      window.open(whatsapp, '_blank', 'noopener');
    }
  }

  async function submitRSVP(submitEvent) {
    submitEvent.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${apiBaseUrl}/events/${encodeURIComponent(effectiveSlug)}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attending: formData.attending,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          guests: formData.guests,
          dietary_restrictions: formData.dietary_restrictions,
          message: formData.message
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de l'envoi");
      }
      setConfirmed({
        isAttending: formData.attending === 'yes',
        name: formData.name,
        guests: formData.guests,
        message: formData.message
      });
      setShowRsvpForm(false);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function lookupRSVP(submitEvent) {
    submitEvent.preventDefault();
    setIsLookingUp(true);
    setErrorMessage('');
    try {
      if (!lookupPhoneNumber || lookupPhoneNumber.trim().length === 0) {
        throw new Error('Le numéro de téléphone est requis');
      }
      const res = await fetch(
        `${apiBaseUrl}/events/${encodeURIComponent(effectiveSlug)}/rsvp/lookup/${encodeURIComponent(lookupPhoneNumber.trim())}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) {
        if (res.status === 404) throw new Error('Aucune réponse trouvée pour ce numéro de téléphone');
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la recherche');
      }
      const data = await res.json();
      setFormData({
        attending: data.attending || 'yes',
        name: data.name,
        email: data.email || '',
        phone: data.phone,
        guests: data.guests || 1,
        dietary_restrictions: data.dietary_restrictions || '',
        message: data.message || ''
      });
      setShowLookupForm(false);
      setShowRsvpForm(true);
      setLookupPhoneNumber('');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    /*
      `theme-surface` re-points the shadcn tokens at the event's palette (see
      src/assets/index.css), so every Button, Input and Card below is dressed by
      the selected theme rather than by the neutral admin palette.
    */
    <div
      className={`theme-surface t-page relative flex min-h-full flex-col items-center justify-center overflow-hidden px-3 py-4 sm:px-4 sm:py-6 ${
        stickyCtaPossible ? 'pb-24 sm:pb-6' : ''
      }`}
    >
      {themeDef.decorations.map((emoji, i) => (
        <div
          key={`${theme}-${i}`}
          className={`t-decoration pointer-events-none absolute animate-float text-3xl select-none ${DECORATION_POSITIONS[i % DECORATION_POSITIONS.length]}`}
          style={{ animationDelay: `${i}s` }}
          aria-hidden="true"
        >
          {emoji}
        </div>
      ))}

      <main className="t-panel relative w-full max-w-[500px] animate-card-in overflow-hidden bg-card text-card-foreground">
        <header
          className="t-header relative overflow-hidden px-5 py-6 text-center text-[color:var(--theme-header-text,#fff)] sm:px-8 sm:py-8"
          style={{ background: 'var(--theme-header-gradient, linear-gradient(135deg,#ff6b6b,#ff8e8e))' }}
        >
          <div className="relative z-2 flex justify-center gap-3.5" aria-hidden="true">
            {themeDef.heroEmojis.map((e, i) => (
              <span
                key={i}
                className="animate-hero-float text-[2.4rem] drop-shadow-[0_3px_6px_rgba(0,0,0,0.25)]"
                style={{ animationDelay: `${i}s` }}
              >
                {e}
              </span>
            ))}
          </div>
          <h1 className="t-display relative z-2 mt-2.5 text-balance font-display text-2xl leading-tight sm:text-[2rem]">
            {themeDef.copy.title}
          </h1>
          <p className="relative z-2 mt-2 text-pretty text-base opacity-90 sm:mt-2.5 sm:text-lg">
            {themeDef.copy.subtitle}
          </p>
        </header>

        {notFound ? (
          <div className="p-5 sm:p-8">
            <div className="rounded-2xl border-2 border-dashed bg-muted px-5 py-8 text-center">
              <h2 className="text-lg font-bold text-[color:var(--theme-primary-dark,#c9184a)]">
                🔍 Événement introuvable
              </h2>
              <p className="mt-2 text-muted-foreground">Cette invitation n'existe pas ou n'est plus disponible.</p>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-8">
            <div className="text-center">
              <p className="t-display font-display text-[1.7rem] text-[color:var(--theme-primary,#ff6b6b)]">
                {event.birthdayPerson}
              </p>
              {event.age && (
                <p
                  className="t-badge mt-3 inline-block px-5 py-2.5 text-lg font-bold text-[color:var(--theme-badge-text,#fff)]"
                  style={{ background: 'var(--theme-badge-gradient, linear-gradient(135deg,#ffd93d,#ff6b6b))' }}
                >
                  {event.age} ans
                </p>
              )}
            </div>

            {/* The hero answers "who" and "when" before it asks for anything:
                name, age, then the date on one line. The full grid of practical
                details moves below the call to action, where it is reference
                material rather than a hurdle in front of the button. */}
            {(formattedDate || event.eventTime) && (
              <p className="mt-4 flex flex-col items-center justify-center gap-x-2 text-center text-base font-semibold opacity-80 sm:flex-row">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDaysIcon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
                  {formattedDate}
                </span>
                {event.eventTime && (
                  <span className="inline-flex items-center gap-2">
                    {/* The separator only makes sense while the two sit on one
                        line; stacked on a phone it would dangle. */}
                    {formattedDate && (
                      <span className="hidden opacity-40 sm:inline" aria-hidden="true">
                        •
                      </span>
                    )}
                    {event.eventTime}
                  </span>
                )}
              </p>
            )}

            {countdown && (
              <div
                className={`my-5 sm:my-6 ${
                  countdown.isToday || countdown.isPast
                    ? 'flex justify-center'
                    : 'mx-auto grid max-w-[19rem] grid-cols-3 gap-2.5 sm:gap-3'
                }`}
                role="status"
                aria-label={countdownAria}
              >
                {countdown.isToday || countdown.isPast ? (
                  <span
                    className="t-badge t-display inline-block px-6 py-3 font-display text-[color:var(--theme-button-text,#fff)]"
                    style={{ background: 'var(--theme-button-gradient, linear-gradient(135deg,#4ecdc4,#44a08d))' }}
                  >
                    {countdown.isToday ? "🎉 C'est aujourd'hui !" : '🎂 Joyeux anniversaire !'}
                  </span>
                ) : (
                  countdownUnits.map((unit) => (
                    <div
                      key={unit.label}
                      className="t-tile t-tile-countdown flex flex-col items-center justify-center px-2 py-3"
                    >
                      <span className="t-display font-display text-2xl leading-none text-[color:var(--theme-primary,#ff6b6b)] tabular-nums sm:text-[1.9rem]">
                        {unit.value}
                      </span>
                      <span className="t-kicker mt-1.5 text-[0.68rem] opacity-70">{unit.label}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="mt-7">
              {/* ---------- Already answered ---------- */}
              {confirmed ? (
                <div
                  /* Deliberately outside the theme palette: "je viens" and
                     "je ne viens pas" have to read as an answer at a glance, in
                     any theme. The stops are dark enough to carry white text at
                     WCAG AA — the pastel pair they replaced sat at 2:1. */
                  className={`rounded-2xl p-6 text-center text-white ${
                    confirmed.isAttending
                      ? 'bg-linear-to-br from-[#0E7D5D] to-[#0A6047]'
                      : 'bg-linear-to-br from-[#C2415A] to-[#9E2740]'
                  }`}
                  role="status"
                >
                  {confirmed.isAttending ? (
                    <>
                      <h2 className="text-xl font-bold">🎉 Merci {confirmed.name} !</h2>
                      <p className="mt-2">Ta réponse est bien enregistrée. À très bientôt ! 🎈</p>
                      <div className="mt-4 space-y-1 opacity-90">
                        <p>👨‍👩‍👧‍👦 {confirmed.guests} personne(s)</p>
                        {confirmed.message && <p>💌 {confirmed.message}</p>}
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold">Merci {confirmed.name}</h2>
                      <p className="mt-2">Dommage que tu ne puisses pas venir. 😔</p>
                      {confirmed.message && <p className="mt-4 opacity-90">💌 {confirmed.message}</p>}
                    </>
                  )}
                  <Button
                    variant="outline"
                    className="mt-5 rounded-full border-white/30 bg-white/20 text-white hover:bg-white/30 hover:text-white"
                    onClick={resetForm}
                  >
                    Modifier ma réponse
                  </Button>
                </div>
              ) : rsvpClosed ? (
                /* ---------- Closed ---------- */
                <div className="rounded-2xl border-2 border-dashed bg-muted px-6 py-6 text-center" role="status">
                  <h2 className="text-lg font-bold text-[color:var(--theme-primary-dark,#c9184a)]">
                    🙏 Réponses closes
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    La date limite de réponse ({formatDeadline}) est passée.
                  </p>
                </div>
              ) : (
                <>
                  {formatDeadline && (
                    <p className="mb-4 text-center font-semibold text-[color:var(--theme-primary-dark,#c9184a)]">
                      ⏳ Merci de répondre avant le {formatDeadline}
                    </p>
                  )}

                  {/* Two equally loud gradient buttons made the visitor choose
                      before reading; answering is what almost everyone is here
                      for, so it keeps the weight and "already answered" drops
                      to a quiet second line. */}
                  {!showRsvpForm && !showLookupForm && (
                    <div ref={ctaRef} className="flex flex-col items-stretch gap-2">
                      <Button
                        size="lg"
                        className="t-cta t-display h-auto w-full animate-rsvp-pulse py-5 font-display text-xl text-[color:var(--theme-button-text,#fff)] hover:animate-none"
                        style={{ background: 'var(--theme-button-gradient, linear-gradient(135deg,#4ecdc4,#44a08d))' }}
                        onClick={openRsvpForm}
                      >
                        🎈 Je réponds
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-full font-medium text-[color:var(--theme-primary-dark,#c9184a)]"
                        onClick={openLookupForm}
                      >
                        ✏️ Déjà répondu ? Modifier
                      </Button>
                    </div>
                  )}

                  {/* ---------- RSVP form ---------- */}
                  {showRsvpForm && (
                    <form
                      ref={formPanelRef}
                      className="t-tile mt-5 scroll-mt-4 space-y-5 p-4 sm:p-6"
                      onSubmit={submitRSVP}
                    >
                      <h2
                        ref={formHeadingRef}
                        tabIndex={-1}
                        className="text-center text-xl font-bold text-[color:var(--theme-primary,#ff6b6b)] outline-none"
                      >
                        Réponds à l'invitation
                      </h2>

                      <fieldset className="space-y-3">
                        <legend className="mb-3 font-medium">
                          Statut{' '}
                          <span className="text-destructive" aria-hidden="true">
                            *
                          </span>
                        </legend>
                        <RadioGroup
                          className="gap-3"
                          value={formData.attending}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, attending: value }))}
                        >
                          {ATTENDING_OPTIONS.map((opt) => (
                            <div
                              key={opt.value}
                              className={`flex items-center gap-3 rounded-xl border-2 bg-card p-3 transition-colors ${
                                formData.attending === opt.value
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
                          👶 Nom de l'enfant{' '}
                          <span className="text-destructive" aria-hidden="true">
                            *
                          </span>
                        </Label>
                        <Input
                          id="rsvp-name"
                          className="bg-card"
                          type="text"
                          required
                          placeholder="Prénom de l'enfant"
                          value={formData.name}
                          onChange={setField('name')}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="rsvp-phone">
                          📱 Téléphone{' '}
                          <span className="text-destructive" aria-hidden="true">
                            *
                          </span>
                        </Label>
                        <Input
                          id="rsvp-phone"
                          className="bg-card"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          required
                          placeholder="06 12 34 56 78"
                          value={formData.phone}
                          onChange={setField('phone')}
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
                          value={formData.email}
                          onChange={setField('email')}
                        />
                      </div>

                      {formData.attending === 'yes' && (
                        <div className="grid gap-2">
                          <Label htmlFor="rsvp-guests">👨‍👩‍👧‍👦 Nombre de personnes</Label>
                          <Select
                            value={String(formData.guests)}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, guests: Number(value) }))}
                          >
                            <SelectTrigger
                              id="rsvp-guests"
                              className="w-full min-w-0 bg-card *:data-[slot=select-value]:min-w-0"
                            >
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

                      {formData.attending === 'yes' && (
                        <div className="grid gap-2">
                          <Label htmlFor="rsvp-diet">🥜 Allergies / régime alimentaire</Label>
                          <Textarea
                            id="rsvp-diet"
                            className="bg-card"
                            placeholder="Allergies, intolérances, régime particulier..."
                            value={formData.dietary_restrictions}
                            onChange={setField('dietary_restrictions')}
                          />
                        </div>
                      )}

                      <div className="grid gap-2">
                        <Label htmlFor="rsvp-message">💌 Message (optionnel)</Label>
                        <Textarea
                          id="rsvp-message"
                          className="bg-card"
                          placeholder={messagePlaceholder}
                          value={formData.message}
                          onChange={setField('message')}
                        />
                      </div>

                      {errorMessage && (
                        <Alert variant="destructive" role="alert">
                          <CircleAlertIcon />
                          <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                      )}

                      {/* Stacked, the primary action goes on top: it is the one
                          the thumb reaches first and the one nearly everyone
                          wants. Side by side from `sm` up it goes back to the
                          right, as a desktop dialog expects.

                          `flex-1` is held back to `sm` on purpose: in the
                          stacked column it resolves to `flex-basis: 0` on the
                          *height*, which beat the `h-12` these buttons get from
                          `size="lg"` and squashed them to their text — a 20px
                          tap target on the one control the page exists for.
                          Column stretch already makes them full width. */}
                      <div className="flex flex-col-reverse gap-3 sm:flex-row">
                        <Button type="button" variant="outline" size="lg" className="sm:flex-1" onClick={cancelForm}>
                          Annuler
                        </Button>
                        <Button type="submit" size="lg" className="sm:flex-1" disabled={isSubmitting}>
                          {isSubmitting && <Loader2Icon className="animate-spin" />}
                          {isSubmitting ? 'Envoi...' : 'Envoyer ma réponse'}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* ---------- Lookup form ---------- */}
                  {showLookupForm && (
                    <form
                      ref={formPanelRef}
                      className="t-tile mt-5 scroll-mt-4 space-y-5 p-4 sm:p-6"
                      onSubmit={lookupRSVP}
                    >
                      <h2
                        ref={formHeadingRef}
                        tabIndex={-1}
                        className="text-center text-xl font-bold text-[color:var(--theme-primary,#ff6b6b)] outline-none"
                      >
                        Retrouver ma réponse
                      </h2>
                      <div className="grid gap-2">
                        <Label htmlFor="lookup-phone">
                          📱 Téléphone{' '}
                          <span className="text-destructive" aria-hidden="true">
                            *
                          </span>
                        </Label>
                        <Input
                          id="lookup-phone"
                          className="bg-card"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          required
                          placeholder="06 12 34 56 78"
                          value={lookupPhoneNumber}
                          onChange={(e) => setLookupPhoneNumber(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">Le numéro utilisé lors de ta première réponse.</p>
                      </div>
                      {errorMessage && (
                        <Alert variant="destructive" role="alert">
                          <CircleAlertIcon />
                          <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                      )}
                      <div className="flex flex-col-reverse gap-3 sm:flex-row">
                        <Button type="button" variant="outline" size="lg" className="sm:flex-1" onClick={cancelForm}>
                          Annuler
                        </Button>
                        <Button type="submit" size="lg" className="sm:flex-1" disabled={isLookingUp}>
                          {isLookingUp && <Loader2Icon className="animate-spin" />}
                          {isLookingUp ? 'Recherche...' : 'Rechercher'}
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>

            {/* The practical details sit below the call to action now, under a
                rule that marks them as reference rather than something to read
                before answering. */}
            {eventDetails.length > 0 && (
              <div className="mt-8 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[0.68rem] tracking-[0.18em] uppercase opacity-50">Infos pratiques</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}

            {/* One grouped list rather than five floating tiles. Five separate
                cards each with their own padding and shadow ran to roughly
                450px on a 390px-wide phone and pushed the RSVP button off the
                bottom of a second screenful; the divided list says the same
                thing in a little over half the height, and reads as the
                grouped detail lists both mobile platforms use.

                The fill and the rules are theme tokens, not black at a low
                alpha: on the dark-surface themes a black wash is invisible,
                and `--muted` / `--border` are derived from the card's own
                colours so the list separates itself on either. */}
            {eventDetails.length > 0 && (
              <dl className="t-tile my-5 overflow-hidden sm:my-6">
                {eventDetails.map((detail) => {
                  const Icon = detail.icon;
                  return (
                    <div
                      key={detail.label}
                      className="flex items-start gap-3 border-t border-border px-3.5 py-2.5 first:border-t-0"
                    >
                      <span
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[color:var(--theme-button-text,#fff)]"
                        style={{ background: 'var(--theme-badge-gradient, var(--theme-primary,#ff6b6b))' }}
                      >
                        <Icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <dt className="text-[0.68rem] leading-tight tracking-wide uppercase opacity-60">
                          {detail.label}
                        </dt>
                        <dd className="text-pretty text-[0.95rem] leading-snug font-semibold">
                          {detail.href ? (
                            <a
                              href={detail.href}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex min-h-8 items-center text-[color:var(--theme-primary,#ff6b6b)] underline underline-offset-2"
                            >
                              {detail.value}
                            </a>
                          ) : (
                            detail.value
                          )}
                        </dd>
                      </div>
                    </div>
                  );
                })}
              </dl>
            )}

            {/* An even row rather than a wrapped one: three pills of different
                widths broke 2 + 1 across two lines on a phone and read as two
                unrelated groups. Stacking the icon over the label below `sm`
                buys each label the full width of its third, so "Calendrier"
                still fits on a 360px screen.

                The row carries its own top margin rather than leaning on the
                details list above it: that list is dropped whenever the event
                has no town, venue or dress code, and the row was then left
                touching the RSVP panel with nothing between them. It collapses
                against the list's `my-5` when the list is there, so the gap is
                the same either way. */}
            <div className={`mt-5 grid gap-2 sm:mt-6 ${googleCalUrl ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <Button asChild variant="outline" size="sm" className="h-auto flex-col gap-0.5 rounded-2xl px-1.5 py-2 text-[0.72rem] sm:h-8 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-0 sm:text-sm">
                <a href={icsUrl}>
                  <DownloadIcon />
                  <span className="truncate">Calendrier</span>
                </a>
              </Button>
              {googleCalUrl && (
                <Button asChild variant="outline" size="sm" className="h-auto flex-col gap-0.5 rounded-2xl px-1.5 py-2 text-[0.72rem] sm:h-8 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-0 sm:text-sm">
                  <a href={googleCalUrl} target="_blank" rel="noopener">
                    <CalendarPlusIcon />
                    <span className="truncate">Agenda</span>
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-auto flex-col gap-0.5 rounded-2xl px-1.5 py-2 text-[0.72rem] sm:h-8 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-0 sm:text-sm"
                onClick={share}
              >
                <Share2Icon />
                <span className="truncate">Partager</span>
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* The admin entry used to be pinned to the viewport corner, where it sat
          on top of the build stamp on a phone. It is a host affordance, not a
          guest one, so it goes quietly at the end of the page. */}
      <div className="relative mt-6">
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="rounded-full bg-white/90 text-slate-600 shadow-md hover:bg-white"
        >
          <Link to="/admin">🔐 Admin</Link>
        </Button>
      </div>

      {/* ---------- Sticky RSVP bar (phones) ----------
        The invitation is a single tall card, so on a phone the one action it
        exists for sits two screenfuls below the fold. The bar keeps it in the
        thumb zone the whole way down and retires as soon as the real button
        scrolls into view. Larger screens show the card's buttons without
        scrolling, so it never appears there. */}
      {showStickyCta && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(0,0,0,0.15)] backdrop-blur-md sm:hidden">
          <Button
            size="lg"
            className="t-cta t-display h-12 w-full font-display text-base text-[color:var(--theme-button-text,#fff)]"
            style={{ background: 'var(--theme-button-gradient, linear-gradient(135deg,#4ecdc4,#44a08d))' }}
            onClick={openRsvpForm}
          >
            🎈 Je réponds
          </Button>
        </div>
      )}
    </div>
  );
}

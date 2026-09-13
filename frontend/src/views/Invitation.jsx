import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2Icon, MapPinIcon, ShirtIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { rsvpsApi } from '../api/index.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useGuestList } from '../hooks/useGuestList.js';
import { useInvitationEvent } from '../hooks/useInvitationEvent.js';
import { useRsvpFlow } from '../hooks/useRsvpFlow.js';
import { getTheme } from '../themes.js';
import ConfirmationCard from './invitation/ConfirmationCard.jsx';
import Countdown from './invitation/Countdown.jsx';
import EventDetails from './invitation/EventDetails.jsx';
import GuestList from './invitation/GuestList.jsx';
import LookupForm from './invitation/LookupForm.jsx';
import RsvpForm from './invitation/RsvpForm.jsx';
import {
  Decorations,
  EventHero,
  InvitationHeader,
  NoticeCard,
  ShareActions
} from './invitation/InvitationCard.jsx';
import { formatDate, formatDeadline, parseEventDate } from './invitation/date.js';

/**
 * The invitation a guest opens.
 *
 * The view owns the page's layout and the handful of derived values the layout
 * needs. Everything else has a home of its own: the event and its theme come
 * from useInvitationEvent, the answer flow from useRsvpFlow, the other guests
 * from useGuestList, and each region of the card is its own component.
 */
export default function Invitation() {
  const { slug = '' } = useParams();
  const { slug: effectiveSlug, event, theme, notFound, rsvpClosed } = useInvitationEvent(slug);
  const themeDef = getTheme(theme);

  const guests = useGuestList(effectiveSlug);
  // Both are stable, so the answer flow below doesn't rebuild every render.
  const { load: loadGuests, clear: clearGuests } = guests;
  // The phone number of the guest reading the page, once they have proved who
  // they are by answering (or by retrieving their answer). It is what the guest
  // list route authenticates against — nothing is fetched before that.
  const [viewerPhone, setViewerPhone] = useState('');

  const onAnswered = useCallback(
    (phone, isAttending) => {
      setViewerPhone(phone);
      // Reload rather than patch the list locally: the answer just changed the
      // guest's own line in it, and other guests may have answered since.
      if (isAttending) loadGuests(phone);
      else clearGuests();
    },
    [loadGuests, clearGuests]
  );

  const rsvp = useRsvpFlow(effectiveSlug, onAnswered);

  // True while the card's own RSVP buttons are on screen. The sticky bar at the
  // bottom of a phone screen is a stand-in for them, so it steps aside rather
  // than offering the same action twice.
  const [ctaOnScreen, setCtaOnScreen] = useState(true);
  const ctaRef = useRef(null);
  const formPanelRef = useRef(null);
  const formHeadingRef = useRef(null);

  const formattedDate = formatDate(event.eventDate);
  const deadlineLabel = useMemo(() => formatDeadline(event.rsvpDeadline), [event.rsvpDeadline]);
  const eventStart = useMemo(() => parseEventDate(event.eventDate), [event.eventDate]);
  const countdown = useCountdown(eventStart);

  const mapUrl = useMemo(() => {
    const q = [event.eventLocation, event.eventTown].filter(Boolean).join(', ');
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : '';
  }, [event.eventLocation, event.eventTown]);

  // The filled-in facts, in display order. Building the list here keeps the
  // "hide what we do not know" rule in one place instead of a conditional per
  // tile. Date and time are not repeated: the hero above the call to action
  // already carries them.
  const eventDetails = useMemo(() => {
    const rows = [];
    if (event.eventTown) rows.push({ label: 'Ville', value: event.eventTown, icon: Building2Icon });
    if (event.eventLocation) {
      rows.push({ label: 'Lieu', value: event.eventLocation, icon: MapPinIcon, href: mapUrl || undefined });
    }
    if (event.dresscode) rows.push({ label: 'Tenue', value: event.dresscode, icon: ShirtIcon });
    return rows;
  }, [event.eventTown, event.eventLocation, event.dresscode, mapUrl]);

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

  const rsvpOpen = !notFound && !rsvp.confirmed && !rsvpClosed;
  // The bar only earns its space while there is an answer to give. The page
  // reserves room for it as soon as it *could* appear, not only while it is
  // showing: growing and shrinking the document under a scrolling finger is what
  // makes a page feel like it is fighting back.
  const stickyCtaPossible = rsvpOpen && !rsvp.panel;
  const showStickyCta = stickyCtaPossible && !ctaOnScreen;

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
  }, [rsvpOpen, rsvp.panel]);

  // Opening a form from the sticky bar (or from buttons the page has scrolled
  // past) has to bring the form into view, or the tap looks like it did nothing.
  // Focus goes to the heading rather than the first field: moving it into an
  // input would throw up the on-screen keyboard over the form the visitor has
  // not read yet.
  useEffect(() => {
    if (!rsvp.panel) return;
    formPanelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    formHeadingRef.current?.focus({ preventScroll: true });
  }, [rsvp.panel]);

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
      // User dismissed the native sheet — done. Any other failure falls through
      // to the clipboard path below.
      if (err && err.name === 'AbortError') return;
    }
    // No native share sheet (most desktops): copy the link and *offer* WhatsApp
    // rather than opening a tab the visitor never asked for.
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
      <Decorations theme={themeDef} themeId={theme} />

      <main className="t-panel relative w-full max-w-[500px] animate-card-in overflow-hidden bg-card text-card-foreground">
        <InvitationHeader theme={themeDef} />

        {notFound ? (
          <div className="p-5 sm:p-8">
            <NoticeCard title="🔍 Événement introuvable">
              Cette invitation n'existe pas ou n'est plus disponible.
            </NoticeCard>
          </div>
        ) : (
          <div className="p-5 sm:p-8">
            <EventHero
              person={event.birthdayPerson}
              age={event.age}
              formattedDate={formattedDate}
              time={event.eventTime}
            />

            <Countdown countdown={countdown} />

            <div className="mt-7">
              {rsvp.confirmed ? (
                <ConfirmationCard confirmed={rsvp.confirmed} onEdit={rsvp.reset} />
              ) : rsvpClosed ? (
                <NoticeCard title="🙏 Réponses closes">
                  La date limite de réponse ({deadlineLabel}) est passée.
                </NoticeCard>
              ) : (
                <>
                  {deadlineLabel && (
                    <p className="mb-4 text-center font-semibold text-[color:var(--theme-primary-dark,#c9184a)]">
                      ⏳ Merci de répondre avant le {deadlineLabel}
                    </p>
                  )}

                  {/* Two equally loud gradient buttons made the visitor choose
                      before reading; answering is what almost everyone is here
                      for, so it keeps the weight and "already answered" drops to
                      a quiet second line. */}
                  {!rsvp.panel && (
                    <div ref={ctaRef} className="flex flex-col items-stretch gap-2">
                      <Button
                        size="lg"
                        className="t-cta t-display h-auto w-full animate-rsvp-pulse py-5 font-display text-xl text-[color:var(--theme-button-text,#fff)] hover:animate-none"
                        style={{ background: 'var(--theme-button-gradient, linear-gradient(135deg,#4ecdc4,#44a08d))' }}
                        onClick={() => rsvp.open('rsvp')}
                      >
                        🎈 Je réponds
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-full font-medium text-[color:var(--theme-primary-dark,#c9184a)]"
                        onClick={() => rsvp.open('lookup')}
                      >
                        ✏️ Déjà répondu ? Modifier
                      </Button>
                    </div>
                  )}

                  {rsvp.panel === 'rsvp' && (
                    <RsvpForm
                      form={rsvp.form}
                      onChange={rsvp.setForm}
                      error={rsvp.errorMessage}
                      submitting={rsvp.submitting}
                      onSubmit={rsvp.submit}
                      onCancel={rsvp.cancel}
                      panelRef={formPanelRef}
                      headingRef={formHeadingRef}
                    />
                  )}

                  {rsvp.panel === 'lookup' && (
                    <LookupForm
                      phone={rsvp.lookupPhone}
                      onPhoneChange={rsvp.setLookupPhone}
                      error={rsvp.errorMessage}
                      busy={rsvp.lookingUp}
                      onSubmit={rsvp.lookup}
                      onCancel={rsvp.cancel}
                      panelRef={formPanelRef}
                      headingRef={formHeadingRef}
                    />
                  )}
                </>
              )}
            </div>

            <GuestList state={guests.state} list={guests.list} onRetry={() => guests.load(viewerPhone)} />

            <EventDetails details={eventDetails} />

            <ShareActions
              icsUrl={rsvpsApi.icsUrl(effectiveSlug)}
              googleCalUrl={googleCalUrl}
              onShare={share}
            />
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
            onClick={() => rsvp.open('rsvp')}
          >
            🎈 Je réponds
          </Button>
        </div>
      )}
    </div>
  );
}

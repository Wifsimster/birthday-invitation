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

export default function Invitation() {
  const { slug = '' } = useParams();
  const { slug: effectiveSlug, event, theme, notFound, rsvpClosed } = useInvitationEvent(slug);
  const themeDef = getTheme(theme);

  const guests = useGuestList(effectiveSlug);
  const { load: loadGuests, clear: clearGuests } = guests;
  const [viewerPhone, setViewerPhone] = useState('');

  const onAnswered = useCallback(
    (phone, isAttending) => {
      setViewerPhone(phone);
      if (isAttending) loadGuests(phone);
      else clearGuests();
    },
    [loadGuests, clearGuests]
  );

  const rsvp = useRsvpFlow(effectiveSlug, onAnswered);

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
  const stickyCtaPossible = rsvpOpen && !rsvp.panel;
  const showStickyCta = stickyCtaPossible && !ctaOnScreen;

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
      if (err && err.name === 'AbortError') return;
    }
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
                    <p className="mb-4 text-center font-semibold text-[color:var(--theme-primary-dark,#a82019)]">
                      ⏳ Merci de répondre avant le {deadlineLabel}
                    </p>
                  )}

                  {!rsvp.panel && (
                    <div ref={ctaRef} className="flex flex-col items-stretch gap-2">
                      <Button
                        size="lg"
                        className="t-cta t-display h-auto w-full animate-rsvp-pulse py-5 font-display text-xl text-[color:var(--theme-button-text,#fff)] hover:animate-none"
                        style={{ background: 'var(--theme-button-gradient, linear-gradient(135deg,#d93a32,#a82019))' }}
                        onClick={() => rsvp.open('rsvp')}
                      >
                        🎈 Je réponds
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-full font-medium text-[color:var(--theme-primary-dark,#a82019)]"
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

      {showStickyCta && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(0,0,0,0.15)] backdrop-blur-md sm:hidden">
          <Button
            size="lg"
            className="t-cta t-display h-12 w-full font-display text-base text-[color:var(--theme-button-text,#fff)]"
            style={{ background: 'var(--theme-button-gradient, linear-gradient(135deg,#d93a32,#a82019))' }}
            onClick={() => rsvp.open('rsvp')}
          >
            🎈 Je réponds
          </Button>
        </div>
      )}
    </div>
  );
}

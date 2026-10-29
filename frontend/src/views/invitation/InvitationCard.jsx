import { CalendarDaysIcon, CalendarPlusIcon, DownloadIcon, Share2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InvitationHeader({ theme }) {
  return (
    <header
      className="t-header relative overflow-hidden px-5 py-6 text-center text-[color:var(--theme-header-text,#fff)] sm:px-8 sm:py-8"
      style={{ background: 'var(--theme-header-gradient, linear-gradient(135deg,#d93a32,#a82019))' }}
    >
      <div className="relative z-2 flex justify-center gap-3.5" aria-hidden="true">
        {theme.heroEmojis.map((e, i) => (
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
        {theme.copy.title}
      </h1>
      <p className="relative z-2 mt-2 text-pretty text-base opacity-90 sm:mt-2.5 sm:text-lg">{theme.copy.subtitle}</p>
    </header>
  );
}

const DECORATION_POSITIONS = [
  'top-[10%] left-[15%]',
  'top-[20%] right-[20%]',
  'top-[60%] left-[10%]',
  'top-[70%] right-[15%]',
  'bottom-[20%] left-[20%]',
  'bottom-[10%] right-[25%]'
];

export function Decorations({ theme, themeId }) {
  return theme.decorations.map((emoji, i) => (
    <div
      key={`${themeId}-${i}`}
      className={`t-decoration pointer-events-none absolute animate-float text-3xl select-none ${
        DECORATION_POSITIONS[i % DECORATION_POSITIONS.length]
      }`}
      style={{ animationDelay: `${i}s` }}
      aria-hidden="true"
    >
      {emoji}
    </div>
  ));
}

export function EventHero({ person, age, formattedDate, time }) {
  return (
    <>
      <div className="text-center">
        <p className="t-display font-display text-[1.7rem] text-[color:var(--theme-primary,#e8443c)]">{person}</p>
        {age && (
          <p
            className="t-badge mt-3 inline-block px-5 py-2.5 text-lg font-bold text-[color:var(--theme-badge-text,#21243d)]"
            style={{ background: 'var(--theme-badge-gradient, linear-gradient(135deg,#ffd75e,#ff9f1c))' }}
          >
            {age} ans
          </p>
        )}
      </div>

      {(formattedDate || time) && (
        <p className="mt-4 flex flex-col items-center justify-center gap-x-2 text-center text-base font-semibold opacity-80 sm:flex-row">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDaysIcon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
            {formattedDate}
          </span>
          {time && (
            <span className="inline-flex items-center gap-2">
              {formattedDate && (
                <span className="hidden opacity-40 sm:inline" aria-hidden="true">
                  •
                </span>
              )}
              {time}
            </span>
          )}
        </p>
      )}
    </>
  );
}

const PILL =
  'h-auto flex-col gap-0.5 rounded-2xl px-1.5 py-2 text-[0.72rem] sm:h-8 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-0 sm:text-sm';

export function ShareActions({ icsUrl, googleCalUrl, onShare }) {
  return (
    <div className={`mt-5 grid gap-2 sm:mt-6 ${googleCalUrl ? 'grid-cols-3' : 'grid-cols-2'}`}>
      <Button asChild variant="outline" size="sm" className={PILL}>
        <a href={icsUrl}>
          <DownloadIcon />
          <span className="truncate">Calendrier</span>
        </a>
      </Button>
      {googleCalUrl && (
        <Button asChild variant="outline" size="sm" className={PILL}>
          <a href={googleCalUrl} target="_blank" rel="noopener">
            <CalendarPlusIcon />
            <span className="truncate">Agenda</span>
          </a>
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" className={PILL} onClick={onShare}>
        <Share2Icon />
        <span className="truncate">Partager</span>
      </Button>
    </div>
  );
}

export function NoticeCard({ title, children }) {
  return (
    <div className="rounded-2xl border-2 border-dashed bg-muted px-5 py-8 text-center" role="status">
      <h2 className="text-lg font-bold text-[color:var(--theme-primary-dark,#a82019)]">{title}</h2>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </div>
  );
}

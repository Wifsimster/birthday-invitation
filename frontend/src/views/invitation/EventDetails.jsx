/**
 * The practical details, below the call to action.
 *
 * One grouped list rather than five floating tiles. Five separate cards each
 * with their own padding and shadow ran to roughly 450px on a 390px-wide phone
 * and pushed the RSVP button off the bottom of a second screenful; the divided
 * list says the same thing in a little over half the height, and reads as the
 * grouped detail lists both mobile platforms use.
 *
 * The fill and the rules are theme tokens, not black at a low alpha: on the
 * dark-surface themes a black wash is invisible, and `--muted` / `--border` are
 * derived from the card's own colours so the list separates itself on either.
 */
export default function EventDetails({ details }) {
  if (!details.length) return null;

  return (
    <>
      {/* A rule that marks what follows as reference rather than something to
          read before answering. */}
      <div className="mt-8 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[0.68rem] tracking-[0.18em] uppercase opacity-50">Infos pratiques</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <dl className="t-tile my-5 overflow-hidden sm:my-6">
        {details.map((detail) => {
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
                <dt className="text-[0.68rem] leading-tight tracking-wide uppercase opacity-60">{detail.label}</dt>
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
    </>
  );
}

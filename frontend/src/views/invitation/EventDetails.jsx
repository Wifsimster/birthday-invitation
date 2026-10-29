export default function EventDetails({ details }) {
  if (!details.length) return null;

  return (
    <>
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
                style={{ background: 'var(--theme-badge-gradient, var(--theme-primary,#e8443c))' }}
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
                      className="inline-flex min-h-8 items-center text-[color:var(--theme-primary,#e8443c)] underline underline-offset-2"
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

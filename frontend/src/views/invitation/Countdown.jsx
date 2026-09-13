/** How long until the party, as three figures — or as one line once it is here. */
export default function Countdown({ countdown }) {
  if (!countdown) return null;
  const single = countdown.isToday || countdown.isPast;

  return (
    <div
      className={`my-5 sm:my-6 ${
        single ? 'flex justify-center' : 'mx-auto grid max-w-[19rem] grid-cols-3 gap-2.5 sm:gap-3'
      }`}
      role="status"
      aria-label={countdown.aria}
    >
      {single ? (
        <span
          className="t-badge t-display inline-block px-6 py-3 font-display text-[color:var(--theme-button-text,#fff)]"
          style={{ background: 'var(--theme-button-gradient, linear-gradient(135deg,#4ecdc4,#44a08d))' }}
        >
          {countdown.isToday ? "🎉 C'est aujourd'hui !" : '🎂 Joyeux anniversaire !'}
        </span>
      ) : (
        countdown.units.map((unit) => (
          <div key={unit.label} className="t-tile t-tile-countdown flex flex-col items-center justify-center px-2 py-3">
            <span className="t-display font-display text-2xl leading-none text-[color:var(--theme-primary,#ff6b6b)] tabular-nums sm:text-[1.9rem]">
              {unit.value}
            </span>
            <span className="t-kicker mt-1.5 text-[0.68rem] opacity-70">{unit.label}</span>
          </div>
        ))
      )}
    </div>
  );
}

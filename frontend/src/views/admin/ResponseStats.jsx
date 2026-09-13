import { Progress } from '@/components/ui/progress';

/**
 * The five figures at the top of the responses tab.
 *
 * Four boxed figures at two across, each with its own emoji row, filled a phone
 * screen before the first response was visible. Below `sm` they become one strip
 * of plain figures — the emoji were decoration and the border was repeated four
 * times — so the whole summary reads at a glance and the list starts above the
 * fold. The cards come back from `sm` up.
 */
function Figure({ emoji, value, label, shortLabel, tone = '' }) {
  return (
    <div className="px-1 py-3 text-center sm:rounded-xl sm:border sm:bg-card sm:p-4 sm:text-left">
      <div className="hidden text-lg sm:block" aria-hidden="true">
        {emoji}
      </div>
      <div className={`text-xl font-bold tabular-nums sm:mt-1 sm:text-2xl ${tone}`}>{value}</div>
      <div className="text-[0.6rem] leading-tight tracking-wide uppercase text-muted-foreground sm:text-xs">
        {shortLabel ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </div>
    </div>
  );
}

export default function ResponseStats({ stats }) {
  // Share of answers that are a yes. 0 when nobody has replied, rather than NaN
  // from dividing by zero.
  const acceptanceRate = stats.total_responses
    ? Math.round((stats.confirmations / stats.total_responses) * 100)
    : 0;

  return (
    <div className="grid grid-cols-4 divide-x rounded-xl border bg-card sm:grid-cols-2 sm:gap-3 sm:divide-x-0 sm:rounded-none sm:border-0 sm:bg-transparent lg:grid-cols-5">
      <Figure emoji="📨" value={stats.total_responses} label="Total réponses" shortLabel="Réponses" />
      <Figure
        emoji="✅"
        value={stats.confirmations}
        label="Confirmations"
        shortLabel="Confirm."
        tone="text-success"
      />
      <Figure emoji="❌" value={stats.declined} label="Déclins" tone="text-destructive" />
      <Figure emoji="👥" value={stats.total_guests} label="Total invités" shortLabel="Invités" />

      <div className="col-span-4 flex items-center gap-2.5 border-t px-3 py-2.5 sm:col-span-2 sm:block sm:gap-0 sm:rounded-xl sm:border sm:bg-card sm:p-4 lg:col-span-1">
        <div className="hidden text-lg sm:block" aria-hidden="true">
          📊
        </div>
        <div className="text-sm font-bold tabular-nums sm:mt-1 sm:text-2xl">{acceptanceRate}%</div>
        <Progress
          value={acceptanceRate}
          className="order-last flex-1 sm:order-none sm:my-2 sm:w-auto sm:flex-none"
          aria-label={`Taux d'acceptation ${acceptanceRate} %`}
        />
        <div className="text-[0.6rem] tracking-wide uppercase text-muted-foreground sm:text-xs">
          <span className="sm:hidden">acceptation</span>
          <span className="hidden sm:inline">Taux d'acceptation</span>
        </div>
      </div>
    </div>
  );
}

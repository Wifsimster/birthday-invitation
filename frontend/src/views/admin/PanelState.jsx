import { CircleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

/** The placeholder rows every panel shows while its first load is in flight. */
export function LoadingRows({ label, count = 3, className = 'h-14 w-full rounded-lg' }) {
  return (
    <div className="space-y-2" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, n) => (
        <Skeleton key={n} className={className} />
      ))}
    </div>
  );
}

/** The banner every panel shows when its load failed. */
export function LoadError({ message, title = 'Chargement impossible' }) {
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** The "nothing here yet" block, with an optional way out of it. */
export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
      <span className="text-3xl" aria-hidden="true">
        {icon}
      </span>
      <p className="font-medium">{title}</p>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

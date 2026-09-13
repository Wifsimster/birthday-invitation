import { Loader2Icon } from 'lucide-react';
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
import { buttonVariants } from '@/components/ui/button';

/**
 * The console's one destructive confirmation.
 *
 * Deleting a response, an event and an account asked the same question three
 * times in three copies of the same markup, which is how two of them ended up
 * with a spinner and the third without one. Only the wording differs, so only
 * the wording is a prop.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  busy = false,
  confirmLabel = 'Supprimer',
  busyLabel = 'Suppression...',
  onConfirm
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            disabled={busy}
            onClick={(e) => {
              // The dialog closes itself on click; the request decides when the
              // row is actually gone, so keep it open until it answers.
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy && <Loader2Icon className="animate-spin" />}
            {busy ? busyLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

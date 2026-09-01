import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function Dialog({ ...props }) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80',
        className
      )}
      {...props}
    />
  );
}

function DialogContent({ className, children, showCloseButton = true, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/**
 * A dialog that scrolls the *overlay* rather than clipping its own body.
 *
 * The centred DialogContent above is capped to the viewport, so on a phone the
 * on-screen keyboard shrinks the visual viewport and buries the lower half of a
 * long form. Here the overlay owns the scrolling and the panel keeps its natural
 * height, so every field stays reachable. Used by the admin's event and RSVP
 * forms.
 *
 * Below `sm` the panel is a full-screen page rather than a floating card — the
 * pattern every mobile OS uses for a form — so the fields get the whole width
 * and DialogFooter can pin the actions to the bottom of the screen. From `sm`
 * up it goes back to a centred, rounded panel.
 */
function DialogScrollContent({ className, children, ...props }) {
  return (
    <DialogPortal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        /* `place-items-center` in a scroll container puts the top of an
           over-tall panel above scroll position 0, where it can never be
           reached. Centring with an auto margin on a flex item does not: the
           panel simply starts at the top once it outgrows the viewport. */
        className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/80 sm:py-8 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      >
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            'relative z-50 flex min-h-dvh w-full flex-col gap-4 border-border bg-background p-4 pb-0 shadow-lg duration-200',
            'sm:my-auto sm:h-fit sm:min-h-0 sm:max-w-lg sm:rounded-lg sm:border sm:p-6',
            className
          )}
          onPointerDownOutside={(event) => {
            // The overlay is the scroll container, so a click on its scrollbar
            // registers as "outside" and would close the dialog mid-edit.
            const originalEvent = event.detail.originalEvent;
            const target = originalEvent.target;
            if (
              originalEvent.offsetX > target.clientWidth ||
              originalEvent.offsetY > target.clientHeight
            ) {
              event.preventDefault();
            }
          }}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-2.5 right-3 flex size-10 items-center justify-center rounded-md transition-colors hover:bg-secondary sm:top-4 sm:right-4 sm:size-8"
          >
            <XIcon className="size-5 sm:size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }) {
  return (
    <div data-slot="dialog-header" className={cn('flex flex-col gap-1.5 pr-10 text-left sm:gap-2', className)} {...props} />
  );
}

/**
 * Actions stick to the bottom of the phone screen. A long form (the admin's
 * event editor runs to ten fields) otherwise pushes "Enregistrer" past the
 * fold, and the visitor has to scroll back down to submit. From `sm` up the
 * panel is short enough that the footer can go back to sitting in the flow.
 */
function DialogFooter({ className, ...props }) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'sticky bottom-0 z-10 -mx-4 mt-auto flex flex-col-reverse gap-2 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        'sm:static sm:mx-0 sm:mt-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0',
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title data-slot="dialog-title" className={cn('text-lg leading-none font-semibold', className)} {...props} />
  );
}

function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogScrollContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger
};

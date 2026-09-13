import { Link } from 'react-router-dom';
import { CircleUserIcon, ExternalLinkIcon, LogOutIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

/**
 * The console's top bar.
 *
 * The actions used to sit side by side and simply ran out of room on a phone,
 * squeezing the brand down to a bare emoji. The invitation link and sign-out now
 * collapse into a menu below `sm`, so the bar keeps its title and every control
 * keeps a 44px touch target.
 */
export default function AdminTopbar({ isAdmin, email, refreshing, onRefresh, invitationPath, onLogout }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-1 px-3 sm:gap-2 sm:px-4">
        <span className="text-xl" aria-hidden="true">
          🎉
        </span>
        <div className="min-w-0 flex-1">
          {/* An admin oversees the whole deployment; everyone else is looking at
              the invitations they created themselves. */}
          <p className="truncate text-sm leading-tight font-semibold">
            {isAdmin ? 'Administration' : 'Mes invitations'}
          </p>
          <p className="truncate text-xs leading-tight text-muted-foreground">Événements et confirmations</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          disabled={refreshing}
          title="Tout actualiser"
          aria-label="Tout actualiser"
          onClick={onRefresh}
        >
          <RefreshCwIcon className={refreshing ? 'animate-spin' : undefined} />
        </Button>

        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link to={invitationPath}>
            <ExternalLinkIcon />
            Voir l'invitation
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu du compte">
              <CircleUserIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {email || 'Compte'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="sm:hidden">
              <Link to={invitationPath}>
                <ExternalLinkIcon />
                Voir l'invitation
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onLogout}>
              <LogOutIcon />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

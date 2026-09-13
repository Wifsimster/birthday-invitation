import { RefreshCwIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadError, LoadingRows } from './PanelState.jsx';

/** The role badge, and the "email not confirmed" marker beside it. */
function RoleBadge({ role }) {
  return (
    <Badge variant={role === 'admin' ? 'default' : 'outline'}>
      {role === 'admin' ? 'Administrateur' : 'Utilisateur'}
    </Badge>
  );
}

/**
 * The grant/revoke pair, plus deletion. The server refuses self-demotion and
 * self-deletion anyway; disabling them here keeps the UI from offering an action
 * that can only fail.
 */
function UserActions({ user, isSelf, busy, onSetRole, onDelete, className = '' }) {
  return (
    <>
      {user.role !== 'admin' ? (
        <Button size="sm" disabled={busy} onClick={() => onSetRole(user, 'admin')}>
          Donner l'accès
        </Button>
      ) : (
        <Button variant="secondary" size="sm" disabled={busy || isSelf} onClick={() => onSetRole(user, 'user')}>
          Retirer l'accès
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className={`text-destructive hover:bg-destructive/10 hover:text-destructive ${className}`}
        disabled={busy || isSelf}
        onClick={() => onDelete(user)}
      >
        Supprimer
      </Button>
    </>
  );
}

/**
 * Account administration.
 *
 * A table below `sm` turned into stacked cells with no headers, so small screens
 * get purpose-built rows instead and the table starts at `sm`.
 */
export default function AccessPanel({ users, loading, error, busyId, currentUserId, onRefresh, onSetRole, onDelete }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden="true">👥</span> Accès
        </CardTitle>
        <CardDescription>
          Toute personne peut créer un compte, mais seuls les comptes{' '}
          <strong className="font-medium">administrateur</strong> accèdent à cette page.
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" disabled={loading} onClick={onRefresh}>
            <RefreshCwIcon className={loading ? 'animate-spin' : undefined} />
            <span className="sr-only sm:not-sr-only">Actualiser</span>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {loading && !users.length ? (
          <LoadingRows label="Chargement des comptes..." />
        ) : error ? (
          <LoadError message={error} />
        ) : (
          <>
            <ul className="divide-y sm:hidden">
              {users.map((u) => (
                <li key={u.id} className="flex flex-col gap-2 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="truncate">{u.name || '—'}</span>
                      {u.id === currentUserId && <Badge variant="secondary">vous</Badge>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <RoleBadge role={u.role} />
                      {!u.emailVerified && (
                        <Badge variant="outline" className="text-muted-foreground">
                          non confirmé
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <UserActions
                      user={u}
                      isSelf={u.id === currentUserId}
                      busy={busyId === u.id}
                      onSetRole={onSetRole}
                      onDelete={onDelete}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compte</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          {u.name || '—'}
                          {u.id === currentUserId && <Badge variant="secondary">vous</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {u.email}
                          {!u.emailVerified && (
                            <Badge variant="outline" title="Email non confirmé">
                              non confirmé
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <UserActions
                          user={u}
                          isSelf={u.id === currentUserId}
                          busy={busyId === u.id}
                          onSetRole={onSetRole}
                          onDelete={onDelete}
                          className="ml-2"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

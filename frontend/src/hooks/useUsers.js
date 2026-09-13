// The deployment's accounts, and the two writes an admin may make to them.

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { usersApi } from '../api/index.js';

export function useUsers(onAccessError) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // The account a write is in flight for, so only its own row goes disabled.
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await usersApi.list());
    } catch (err) {
      if (await onAccessError(err)) return;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onAccessError]);

  // Both writes follow the same shape: mark the row busy, call, reload the list
  // (the server may have refused for a reason the local copy cannot know, like
  // "il doit rester au moins un administrateur"), then report.
  const run = useCallback(
    async (userId, action, onSuccess) => {
      setBusyId(userId);
      setError(null);
      try {
        await action();
        await load();
        toast.success(onSuccess);
        return true;
      } catch (err) {
        if (await onAccessError(err)) return false;
        setError(err.message);
        toast.error(err.message);
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load, onAccessError]
  );

  const setRole = useCallback(
    (user, role) =>
      run(
        user.id,
        () => usersApi.setRole(user.id, role),
        role === 'admin'
          ? `${user.email} a maintenant accès à l'administration.`
          : `L'accès de ${user.email} a été retiré.`
      ),
    [run]
  );

  const remove = useCallback(
    (user) => run(user.id, () => usersApi.remove(user.id), 'Compte supprimé.'),
    [run]
  );

  return { users, loading, error, busyId, load, setRole, remove };
}

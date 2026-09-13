// A single-key shortcut that stays out of the way of typing.

import { useEffect, useRef } from 'react';

/**
 * Call `handler` when `key` is pressed outside a text field and without a
 * modifier. `enabled` is read through a ref so the listener is installed once,
 * rather than re-bound on every render of a busy view.
 */
export function useHotkey(key, handler, enabled = true) {
  const state = useRef({ handler, enabled });
  state.current = { handler, enabled };

  useEffect(() => {
    function onKeydown(e) {
      if (e.key !== key || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (!state.current.enabled) return;
      e.preventDefault();
      state.current.handler();
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [key]);
}

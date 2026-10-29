import { useEffect, useRef } from 'react';

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

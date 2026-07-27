import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'econ-dashboard-theme';

function read(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'system';
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

/**
 * Theme selection.
 *
 * `system` removes the attribute entirely so the CSS media query takes over;
 * an explicit choice stamps `data-theme` on the root, which the stylesheet
 * gives precedence over the OS preference in both directions.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem(STORAGE_KEY);
    } else {
      root.setAttribute('data-theme', choice);
      localStorage.setItem(STORAGE_KEY, choice);
    }
  }, [choice]);

  const cycle = useCallback(() => {
    setChoice((c) => (c === 'system' ? 'light' : c === 'light' ? 'dark' : 'system'));
  }, []);

  return { choice, setChoice, cycle };
}

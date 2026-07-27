import { useTheme, type ThemeChoice } from '../hooks/useTheme';

const NEXT_LABEL: Record<ThemeChoice, string> = {
  system: 'Match system theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

const ICON: Record<ThemeChoice, string> = {
  system: '◐',
  light: '☀',
  dark: '☾',
};

export function ThemeToggle() {
  const { choice, cycle } = useTheme();

  return (
    <button
      type="button"
      onClick={cycle}
      title={NEXT_LABEL[choice]}
      aria-label={`${NEXT_LABEL[choice]}. Click to change.`}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-surface text-sm text-ink-secondary transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-series-1"
    >
      <span aria-hidden>{ICON[choice]}</span>
    </button>
  );
}

import { CheckIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { themeList, themeVars } from '../../themes.js';

/**
 * A live miniature of one theme — not a drawing of one.
 *
 * It runs on the same `data-theme` attribute and `--theme-*` tokens the
 * invitation does, so the preview picks up the real corner radius, border,
 * shadow and texture from assets/themes.css. A hand-approximated swatch would
 * drift from the theme the first time one changed.
 */
function ThemePreview({ theme }) {
  return (
    <span
      data-theme={theme.id}
      style={themeVars(theme.id)}
      className="theme-surface t-page relative flex h-32 items-center justify-center overflow-hidden rounded-lg"
      aria-hidden="true"
    >
      <span className="absolute inset-0" style={{ background: 'var(--theme-bg-gradient)' }} />
      {/* Drawn at the invitation's own size and scaled down as a whole, so
          corner radii, border weights and offset shadows shrink with it. Sized
          down directly they would read as one rounded rectangle for every theme
          — which is the thing these themes fixed. */}
      <span className="relative w-[420px] origin-center scale-[0.32]">
        <span className="t-panel flex flex-col overflow-hidden bg-card">
          <span
            className="t-header relative flex h-20 items-center justify-center overflow-hidden text-3xl"
            style={{ background: 'var(--theme-header-gradient)' }}
          >
            <span className="relative z-2">{theme.icon}</span>
          </span>
          <span className="flex flex-col items-center gap-4 p-6">
            <span className="t-display font-display text-3xl leading-none text-[color:var(--theme-primary)]">Aa</span>
            <span className="flex w-full gap-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="t-tile t-tile-countdown h-12 flex-1" />
              ))}
            </span>
            <span className="t-cta h-11 w-full" style={{ background: 'var(--theme-button-gradient)' }} />
          </span>
        </span>
      </span>
    </span>
  );
}

/** The theme picker for the selected event. */
export default function ThemePanel({ currentTheme, saving, onSelect }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden="true">🎨</span> Thème de l'invitation
        </CardTitle>
        <CardDescription>Choisis l'ambiance affichée aux invités. Le changement est immédiat.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {themeList.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`flex flex-col gap-3 rounded-xl border bg-card p-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 ${
                t.id === currentTheme
                  ? 'border-primary ring-3 ring-ring/25'
                  : 'hover:border-primary/40 hover:bg-accent/40'
              }`}
              disabled={saving}
              aria-pressed={t.id === currentTheme}
              onClick={() => onSelect(t.id)}
            >
              <ThemePreview theme={t} />
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="text-base font-semibold">{t.label}</span>
                  {t.id === currentTheme && (
                    <Badge className="bg-success text-success-foreground">
                      <CheckIcon />
                      Actif
                    </Badge>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">{t.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

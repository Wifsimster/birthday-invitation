---
name: Birthday Invitation
source:
  tokens: frontend/src/assets/index.css
  theme-structure: frontend/src/assets/themes.css
  theme-catalog: frontend/src/themes.js
mode: "two layers: neutral tool surfaces (admin, sign-in) + 7 party themes inside .theme-surface; no dark mode"
colors:
  light:
    background: "oklch(0.984 0.003 247.858)"
    foreground: "oklch(0.129 0.042 264.695)"
    card: "oklch(1 0 0)"
    card-foreground: "oklch(0.129 0.042 264.695)"
    popover: "oklch(1 0 0)"
    popover-foreground: "oklch(0.129 0.042 264.695)"
    primary: "oklch(0.511 0.262 276.966)"
    primary-foreground: "oklch(0.984 0.003 247.858)"
    secondary: "oklch(0.968 0.007 247.896)"
    secondary-foreground: "oklch(0.208 0.042 265.755)"
    muted: "oklch(0.968 0.007 247.896)"
    muted-foreground: "oklch(0.554 0.046 257.417)"
    accent: "oklch(0.968 0.007 247.896)"
    accent-foreground: "oklch(0.208 0.042 265.755)"
    destructive: "oklch(0.577 0.245 27.325)"
    destructive-foreground: "oklch(0.984 0.003 247.858)"
    success: "oklch(0.596 0.145 163.225)"
    success-foreground: "oklch(0.984 0.003 247.858)"
    border: "oklch(0.929 0.013 255.508)"
    input: "oklch(0.929 0.013 255.508)"
    ring: "oklch(0.511 0.262 276.966)"
  party-themes:
    kid: { primary: "#E8443C", primaryDark: "#A82019", cardBg: "#FFFFFF", cardText: "#21243D", bg: ["#FFD166", "#EF476F", "#6C63FF"], radius: 1.1rem }
    floral: { primary: "#A8446B", primaryDark: "#7C2B4C", cardBg: "#FFFCF8", cardText: "#3A2E2A", bg: ["#F6E7DC", "#E0BFB8", "#9DAE8E"], radius: 1rem }
    neon: { primary: "#FF3D9A", primaryDark: "#FF8AC6", cardBg: "#141126", cardText: "#F2EEFF", bg: ["#2B0B45", "#5B0F8B", "#0A0A1A"], radius: 1rem }
    robotic: { primary: "#22D3EE", primaryDark: "#7DD3FC", cardBg: "#0E1626", cardText: "#DCE7F5", bg: ["#0B1220", "#12203A", "#030712"], radius: 0.25rem }
    retro: { primary: "#D6004A", primaryDark: "#9C0036", cardBg: "#FFF8E7", cardText: "#141414", bg: ["#FFD400", "#FF7A00", "#00A8B0"], radius: 0.125rem }
    modern: { primary: "#2F5BFF", primaryDark: "#1A3BC4", cardBg: "#FFFFFF", cardText: "#111827", bg: ["#EEF1F7", "#C3CDDF", "#6B7A93"], radius: 0.5rem }
    elegant: { primary: "#8C6D2C", primaryDark: "#6B5220", cardBg: "#FBF7EF", cardText: "#22252B", bg: ["#39414F", "#1E2531", "#0D1116"], radius: 0.125rem }
typography:
  sans: "var(--theme-font-body, 'Poppins', ui-sans-serif, system-ui, sans-serif)"
  display: "var(--theme-font-display, 'Fredoka', ui-sans-serif, system-ui, sans-serif)"
  per-theme: "kid Fredoka/Nunito, floral Dancing Script/Quicksand, neon Bungee/Poppins, robotic Orbitron/Rajdhani, retro Bungee/Outfit, modern Outfit/Outfit, elegant Cormorant Garamond/Outfit"
  scale: tailwind-default
rounded:
  base: 0.625rem (tool surfaces); per theme inside .theme-surface
  sm: "calc(var(--radius) - 4px)"
  md: "calc(var(--radius) - 2px)"
  lg: "var(--radius)"
  xl: "calc(var(--radius) + 4px)"
elevation:
  card: shadow-sm (Tailwind default)
  t-panel-shadow: "0 25px 50px rgba(0, 0, 0, 0.1)"
  t-cta-shadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)"
spacing:
  scale: tailwind-default (4px)
components:
  style: new-york
  primitives: radix (radix-ui)
  icons: lucide-react
  toasts: sonner
  language: JSX (tsx false)
---

# Birthday Invitation — DESIGN.md

This file describes the design system **as it exists in the code**. It
proposes nothing. Every value comes from the cited file; where they
disagree, the code wins and the gap goes under [Known Gaps](#known-gaps).

## Overview

A self-hosted birthday invitation with online RSVP. The UI has **two
layers** on one set of shadcn components (header comment of
`frontend/src/assets/index.css`):

- **Tool surfaces** (admin console, sign-in): a neutral slate / indigo shadcn palette, so they read as an application whatever the event's theme.
- **The invitation** (`.theme-surface`): the same tokens re-pointed at `--theme-*` properties that `themes.js` writes on `<html>`, so every component re-skins with the event's party theme. Seven themes; each changes palette, fonts, emoji **and** shape language (radius, borders, depth, texture) through `themes.css`.

The page backdrop is the theme's animated gradient (`theme-gradient-shift`,
12 s).

## Colors

### Tool surfaces (`index.css` `:root`)

| Token | Value | Role |
| --- | --- | --- |
| `--background` | `oklch(0.984 0.003 247.858)` | App background |
| `--foreground` | `oklch(0.129 0.042 264.695)` | Text |
| `--card` / `--popover` | `oklch(1 0 0)` | Cards, menus |
| `--primary` | `oklch(0.511 0.262 276.966)` | Indigo action |
| `--primary-foreground` | `oklch(0.984 0.003 247.858)` | |
| `--secondary` / `--muted` / `--accent` | `oklch(0.968 0.007 247.896)` | Quiet surfaces |
| `--secondary-foreground` / `--accent-foreground` | `oklch(0.208 0.042 265.755)` | |
| `--muted-foreground` | `oklch(0.554 0.046 257.417)` | Secondary text |
| `--destructive` / `-foreground` | `oklch(0.577 0.245 27.325)` / `oklch(0.984 0.003 247.858)` | |
| `--success` / `-foreground` | `oklch(0.596 0.145 163.225)` / `oklch(0.984 0.003 247.858)` | RSVP "accepted", peer of destructive |
| `--border` / `--input` | `oklch(0.929 0.013 255.508)` | |
| `--ring` | `oklch(0.511 0.262 276.966)` | Focus |

There is no dark mode. `@custom-variant dark (&:is(.dark *))` stays in
`index.css` so the stock shadcn `dark:` utilities never fire: nothing sets a
`.dark` class, and without the variant Tailwind would apply them on
`prefers-color-scheme: dark`.

### Invitation surface (`index.css` `.theme-surface`)

| shadcn token | Mapped to |
| --- | --- |
| `--background`, `--card`, `--popover` | `var(--theme-card-bg)` |
| `--foreground`, `--card-foreground`, `--popover-foreground` | `var(--theme-card-text)` |
| `--primary` / `--primary-foreground` | `var(--theme-primary)` / `var(--theme-button-text)` |
| `--secondary` | `color-mix(in srgb, primary 10%, card-bg)` |
| `--accent` | `color-mix(in srgb, primary 12%, card-bg)` |
| `--secondary-foreground`, `--accent-foreground` | `var(--theme-primary-dark)` |
| `--muted` | `color-mix(in srgb, card-text 6%, card-bg)` |
| `--muted-foreground` | `color-mix(in srgb, card-text 72%, transparent)` (72 % for AA) |
| `--border` / `--input` | card-text at 14 % / 20 % |
| `--ring` | `var(--theme-primary)` |

### Party themes (`frontend/src/themes.js`, default `kid`)

| Id | Label | primary / primaryDark | cardBg / cardText | Backdrop gradient | Display / body font |
| --- | --- | --- | --- | --- | --- |
| `kid` | Kid | `#E8443C` / `#A82019` | `#FFFFFF` / `#21243D` | `#FFD166` → `#EF476F` → `#6C63FF` | Fredoka / Nunito |
| `floral` | Floral | `#A8446B` / `#7C2B4C` | `#FFFCF8` / `#3A2E2A` | `#F6E7DC` → `#E0BFB8` → `#9DAE8E` | Dancing Script / Quicksand |
| `neon` | Néon | `#FF3D9A` / `#FF8AC6` | `#141126` / `#F2EEFF` | `#2B0B45` → `#5B0F8B` → `#0A0A1A` | Bungee / Poppins |
| `robotic` | Robotic | `#22D3EE` / `#7DD3FC` | `#0E1626` / `#DCE7F5` | `#0B1220` → `#12203A` → `#030712` | Orbitron / Rajdhani |
| `retro` | Retro | `#D6004A` / `#9C0036` | `#FFF8E7` / `#141414` | `#FFD400` → `#FF7A00` → `#00A8B0` | Bungee / Outfit |
| `modern` | Modern | `#2F5BFF` / `#1A3BC4` | `#FFFFFF` / `#111827` | `#EEF1F7` → `#C3CDDF` → `#6B7A93` | Outfit / Outfit |
| `elegant` | Élégant | `#8C6D2C` / `#6B5220` | `#FBF7EF` / `#22252B` | `#39414F` → `#1E2531` → `#0D1116` | Cormorant Garamond / Outfit |

Each theme also sets `secondary`, `accent`, `headerFrom/To`, `badgeFrom/To`,
`buttonFrom/To`, `headerText`, `badgeText`, `buttonText` (see `themes.js`).
**Palette contract** (header of `themes.js`, audited by `npm run
check:themes`): `cardText` on `cardBg` ≥ 4.5:1; `primaryDark` ≥ 4.5:1 and
`primary` ≥ 3:1 on `cardBg` (on a dark card the "dark" twin is the lighter
one); header, badge and button text ≥ 4.5:1 against both gradient stops. Theme
ids must match `server/src/themes.ts` `THEME_IDS` (tested).

## Typography

`--font-sans` = `var(--theme-font-body, 'Poppins', …)`, `--font-display` =
`var(--theme-font-display, 'Fredoka', …)`. The Poppins body fallback is the
tool-surface font (sign-in screens, before any theme is applied), not drift.
Google Fonts: `index.html` loads
Fredoka, Nunito and Poppins up front; the other theme families (Bungee,
Cormorant Garamond, Dancing Script, Orbitron, Outfit, Quicksand, Rajdhani)
load lazily on first use (`ensureFonts` in `themes.js`); the admin picker
preloads all of them. Tailwind default scale. Inputs `max(16px, 0.875rem)`
below 640 px (no iOS zoom). Per-theme type treatment via `--t-display-*`,
`--t-kicker-*` (uppercase, `0.06em`, 500 by default), `--t-cta-tracking`.

## Layout

Tailwind default spacing. `#app` is a flex column at `100dvh` with
`safe-area-inset-left/right` padding. `:target` / `[data-scroll-margin]`
clear the sticky admin bar (`3.5rem + 0.75rem`). Below `40rem`, a CardHeader
action drops onto its own row.

## Elevation

Tool surfaces: Card `shadow-sm`. Invitation parts take theme tokens
(`themes.css` defaults): `--t-panel-shadow` `0 25px 50px rgba(0, 0, 0, 0.1)`,
`--t-cta-shadow` `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0,
0, 0, 0.1)`, `--t-badge-shadow` ring of `--theme-primary-soft` +
`0 4px 15px rgba(0, 0, 0, 0.18)`, `--t-tile-shadow: none`. Retro casts a hard
offset shadow; Robotic bevels corners (`themes.js` comment, `themes.css`).

## Shapes

Tool surfaces: `--radius: 0.625rem` → `sm` 6 px, `md` 8 px, `lg` 10 px, `xl`
14 px; Card `rounded-xl`. Inside `.theme-surface` each theme sets `--radius`
(Kid `1.1rem`, Floral `1rem`, Néon `1rem`, Robotic `0.25rem`, Retro
`0.125rem`, Modern `0.5rem`, Élégant `0.125rem`) and re-declares
`--radius-sm…xl` so shadcn components follow. Invitation parts use
`--t-panel-radius` (20 px default), `--t-tile-radius` (16 px), pill
`--t-badge-radius` / `--t-cta-radius` (999 px).

## Motion

`@theme inline` utilities: `animate-float` (6 s), `animate-hero-float` (6 s),
`animate-rsvp-pulse` (2.5 s), `animate-card-in` (0.8 s); backdrop
`theme-gradient-shift` 12 s. `prefers-reduced-motion: reduce` sets
`animation: none` and `transition: none` everywhere and freezes the gradient.

## Components

shadcn `new-york` in **JSX** (`components.json` `tsx: false`), `radix-ui`,
`lucide-react`, `sonner`. Installed: `alert-dialog`, `alert`, `badge`,
`button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`,
`progress`, `radio-group`, `select`, `separator`, `skeleton`, `sonner`,
`table`, `tabs`, `textarea`, `tooltip`. Button variants are stock
(`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`).

Invitation parts are marked with `t-` classes (`t-panel`, `t-header`,
`t-tile`, `t-badge`, `t-cta`, `t-kicker`, `t-display`) and styled only
through `--t-*` tokens, so a theme restyles them without touching JSX.

## Do's and Don'ts

**Do**
- Add a theme as **both** halves: palette in `themes.js` and a `[data-theme]` block in `themes.css`; add its id to `server/src/themes.ts`.
- Run `npm run check:themes` (frontend) for every new palette.
- Style invitation parts through `t-` classes and `--t-*` tokens.
- Use `success` for the RSVP "accepted" state.

**Don't**
- Hard-code radii or shadows on invitation parts.
- Paint tool surfaces with `--theme-*` (they stay neutral whatever the event).
- Ship a theme that is only a recolour.

## Responsive

Mobile first; `sm` (640 px) restores input font size and the CardHeader
action column. Safe-area insets on `#app`. No image assets in themes, so a
switch is instant.

## Known Gaps

None open. Resolved 2026-10-10:

1. **`.dark` palette never applied**: the unused `.dark` token block is gone. The app has no dark mode; the `dark` custom variant is kept so shadcn's `dark:` utilities stay inert (see Colors).
2. **CSS fallbacks didn't match the default theme**: every generic `var(--theme-*, …)` fallback in `index.css`, `themes.css` and the invitation views now uses the default `kid` palette (`#E8443C`, `#A82019`, `#21243D`, `#FFFFFF`, accent `#FFC93C`, backdrop `#FFD166 → #EF476F → #6C63FF`, header/button `#D93A32 → #A82019`, badge `#FFD75E → #FF9F1C` with `#21243D` text). Visible change: the sign-in screens, which never apply a theme, now show the `kid` backdrop. The fallback text pairs clear AA: `#A82019` on white 7.28:1 (was `#C9184A` 5.66:1), `#E8443C` on white 3.94:1 for display text and borders (was `#FF6B6B` 2.78:1), white on `#D93A32` 4.56:1 (was `#4ECDC4` 1.93:1), `#21243D` on the badge stops 10.93:1 / 7.39:1 (was white on `#FFD93D` 1.38:1). The Poppins body fallback is intentional (see Typography).
3. **Comment drift**: `themes.css` now says the `--t-*` defaults are declared in that file.

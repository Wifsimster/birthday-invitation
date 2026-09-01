// Visual catalog for the selectable UI theme. The set of ids here MUST stay in
// sync with the server-side allow-list (server/src/themes.ts THEME_IDS) — the
// test in server/tests/themes.test.ts fails the build when they drift apart.
//
// A theme is described purely with hex colors, emoji and font stacks — no image
// assets — so it re-skins the whole app via CSS custom properties (see
// applyTheme). Theme names are labels only; the visuals merely evoke a vibe.
//
// Palette contract, so a new theme stays readable rather than merely pretty:
//
//   cardBg / cardText     the invitation panel. `cardText` on `cardBg` must
//                         clear WCAG AA (4.5:1) — a theme may go dark here,
//                         the surface tokens are derived from these two.
//   primary / primaryDark accent colour and its deeper twin. Both are drawn as
//                         text on the card, so primaryDark needs 4.5:1 and
//                         primary at least 3:1 against `cardBg`.
//   headerFrom/headerTo   the header gradient. Optional — defaults to
//                         primary → primaryDark — and exists so a theme can
//                         keep a vivid accent while still carrying
//                         `headerText` at 4.5:1.
//   button* / badge*      gradient stops plus the text colour laid over them,
//                         again at 4.5:1 against *both* stops.
//
// `npm run check:themes` (frontend) audits every pair above.

export const DEFAULT_THEME = 'fiesta';

export const THEMES = {
  fiesta: {
    label: 'Fiesta',
    icon: '🎉',
    palette: {
      primary: '#E4265A', primaryDark: '#A80B3D', secondary: '#4361EE', accent: '#FFB703',
      bgFrom: '#FF5C8A', bgVia: '#7B5BFF', bgTo: '#21D4FD',
      cardBg: '#FFFFFF', cardText: '#1F2333', headerText: '#FFFFFF',
      headerFrom: '#D31A50', headerTo: '#8E0733',
      badgeFrom: '#FFC94D', badgeTo: '#FB8500', buttonFrom: '#D31A50', buttonTo: '#96082F',
      badgeText: '#1F2333', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Fredoka', 'Trebuchet MS', system-ui, sans-serif", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🎉', '🎈', '🥳'],
    decorations: ['🎉', '🎈', '🎊', '✨', '🍭', '🎁'],
    copy: { title: '🎉 Tu es invité(e) ! 🎉', subtitle: 'Viens faire la fête avec nous 🎈' }
  },
  spiderman: {
    label: 'Spider-Man',
    icon: '🕷️',
    palette: {
      primary: '#CE1B26', primaryDark: '#8E0F17', secondary: '#1D4ED8', accent: '#0F1B3D',
      bgFrom: '#C1121F', bgVia: '#1E3A8A', bgTo: '#0B1220',
      cardBg: '#FFFFFF', cardText: '#16213E', headerText: '#FFFFFF',
      badgeFrom: '#CE1B26', badgeTo: '#1D4ED8', buttonFrom: '#CE1B26', buttonTo: '#8E0F17',
      badgeText: '#FFFFFF', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Bangers', 'Impact', 'Arial Black', cursive", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🕷️', '🕸️', '🦸'],
    decorations: ['🕷️', '🕸️', '🦸', '💥', '🌃', '⚡'],
    copy: { title: '🕸️ Une mission t\'attend ! 🕸️', subtitle: 'Enfile ton costume de héros et rejoins l\'aventure' }
  },
  ironman: {
    label: 'Iron Man',
    icon: '🤖',
    palette: {
      primary: '#C31F33', primaryDark: '#8C0E1E', secondary: '#B8860B', accent: '#FFC300',
      bgFrom: '#7A0C16', bgVia: '#B71C2B', bgTo: '#C9930B',
      cardBg: '#FFFDF5', cardText: '#2A1206', headerText: '#FFF6D6',
      badgeFrom: '#FFC300', badgeTo: '#E08A00', buttonFrom: '#C31F33', buttonTo: '#8C0E1E',
      badgeText: '#2A1206', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Orbitron', 'Trebuchet MS', 'Arial Black', sans-serif", body: "'Rajdhani', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🤖', '⚙️', '🔥'],
    decorations: ['🤖', '⚙️', '🔧', '⚡', '🔥', '💛'],
    copy: { title: '⚡ Active les réacteurs ! ⚡', subtitle: 'Prépare ton armure pour une fête high-tech' }
  },
  pawpatrol: {
    label: 'Pat\' Patrouille',
    icon: '🐾',
    palette: {
      primary: '#00679E', primaryDark: '#004E7A', secondary: '#E4002B', accent: '#FFD200',
      bgFrom: '#00A0E3', bgVia: '#1976D2', bgTo: '#0B5394',
      cardBg: '#FFFFFF', cardText: '#16334A', headerText: '#FFFFFF',
      badgeFrom: '#FFD200', badgeTo: '#FFA000', buttonFrom: '#CC0026', buttonTo: '#93001B',
      badgeText: '#16334A', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Fredoka', 'Trebuchet MS', system-ui, sans-serif", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🐾', '🚓', '🚒'],
    decorations: ['🐾', '🐶', '🚓', '🚒', '🚁', '⭐'],
    copy: { title: '🐾 Pas de mission trop dure ! 🐾', subtitle: 'La patrouille a besoin de toi pour faire la fête' }
  },
  mickey: {
    label: 'Mickey',
    icon: '🐭',
    palette: {
      primary: '#C9121A', primaryDark: '#8E080E', secondary: '#111111', accent: '#FFC60A',
      bgFrom: '#E63946', bgVia: '#C1121F', bgTo: '#1A1A1A',
      cardBg: '#FFFFFF', cardText: '#1A1A1A', headerText: '#FFFFFF',
      badgeFrom: '#FFC60A', badgeTo: '#F59E0B', buttonFrom: '#C9121A', buttonTo: '#8E080E',
      badgeText: '#1A1A1A', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Fredoka', 'Trebuchet MS', system-ui, sans-serif", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🐭', '🎈', '🎀'],
    decorations: ['🐭', '🎈', '🎀', '⭐', '🧤', '🎉'],
    copy: { title: '🎈 C\'est la fête, hourra ! 🎈', subtitle: 'Une journée magique t\'attend, viens vite' }
  },
  princess: {
    label: 'Princesse',
    icon: '👑',
    palette: {
      primary: '#C43D80', primaryDark: '#96245E', secondary: '#7C5BD1', accent: '#E8C36B',
      bgFrom: '#FAD0E4', bgVia: '#E7B6E8', bgTo: '#C9B6F2',
      cardBg: '#FFFBFE', cardText: '#40203A', headerText: '#FFFFFF',
      headerFrom: '#B33471', headerTo: '#7A1A4C',
      badgeFrom: '#F3D27A', badgeTo: '#E0A93B', buttonFrom: '#B33471', buttonTo: '#7A1A4C',
      badgeText: '#40203A', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Pacifico', 'Brush Script MT', 'Comic Sans MS', cursive", body: "'Quicksand', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['👑', '✨', '🏰'],
    decorations: ['👑', '✨', '🏰', '🌸', '💖', '🦄'],
    copy: { title: '👑 Une invitation royale 👑', subtitle: 'Rejoins-nous pour un anniversaire de conte de fées' }
  },
  dino: {
    label: 'Dino',
    icon: '🦖',
    palette: {
      primary: '#1F7A4C', primaryDark: '#155937', secondary: '#A77B43', accent: '#E8B23A',
      bgFrom: '#3FA34D', bgVia: '#1E7A46', bgTo: '#14532D',
      cardBg: '#FDFBF3', cardText: '#22331C', headerText: '#FFFFFF',
      badgeFrom: '#F0C154', badgeTo: '#D9930F', buttonFrom: '#1F7A4C', buttonTo: '#155937',
      badgeText: '#22331C', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Bangers', 'Trebuchet MS', 'Arial Black', cursive", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🦖', '🌿', '🦕'],
    decorations: ['🦖', '🦕', '🌿', '🌴', '🥚', '🌋'],
    copy: { title: '🦖 Une fête préhistorique ! 🦖', subtitle: 'Rugis de joie et viens explorer la jungle avec nous' }
  },
  space: {
    label: 'Espace',
    icon: '🚀',
    palette: {
      primary: '#6D28D9', primaryDark: '#4C1D95', secondary: '#22D3EE', accent: '#F472B6',
      bgFrom: '#1E1B4B', bgVia: '#3B0764', bgTo: '#0B1026',
      cardBg: '#FFFFFF', cardText: '#1A1633', headerText: '#EAEAFF',
      badgeFrom: '#67E8F9', badgeTo: '#38BDF8', buttonFrom: '#6D28D9', buttonTo: '#4C1D95',
      badgeText: '#07223A', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Orbitron', 'Trebuchet MS', 'Arial Black', sans-serif", body: "'Quicksand', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🚀', '🪐', '✨'],
    decorations: ['🚀', '🪐', '⭐', '🌙', '👽', '🌌'],
    copy: { title: '🚀 Décollage imminent ! 🚀', subtitle: 'Embarque pour une fête à travers les étoiles' }
  },
  unicorn: {
    label: 'Licorne',
    icon: '🦄',
    palette: {
      primary: '#D6337F', primaryDark: '#A31F5F', secondary: '#3BAFA2', accent: '#FFD166',
      bgFrom: '#FFC8DD', bgVia: '#C8B6FF', bgTo: '#A0E7E5',
      cardBg: '#FFFCFE', cardText: '#3F2046', headerText: '#FFFFFF',
      headerFrom: '#C22874', headerTo: '#8C1A52',
      badgeFrom: '#FFD166', badgeTo: '#FFB08B', buttonFrom: '#C22874', buttonTo: '#8C1A52',
      badgeText: '#3F2046', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Pacifico', 'Brush Script MT', 'Comic Sans MS', cursive", body: "'Quicksand', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🦄', '🌈', '✨'],
    decorations: ['🦄', '🌈', '✨', '☁️', '💖', '⭐'],
    copy: { title: '🦄 Un anniversaire magique 🦄', subtitle: 'Suis l\'arc-en-ciel jusqu\'à notre fête enchantée' }
  },

  // ---- Dark-surface themes. `cardBg` goes near-black and the surface tokens
  // in .theme-surface follow it, so the panel reads as a lit sign rather than a
  // white sheet dropped on a dark page. ----

  neon: {
    label: 'Néon',
    icon: '🪩',
    palette: {
      primary: '#FF3D9A', primaryDark: '#FF7AC0', secondary: '#22D3EE', accent: '#A855F7',
      bgFrom: '#2B0B45', bgVia: '#5B0F8B', bgTo: '#0A0A1A',
      cardBg: '#141126', cardText: '#F2EEFF', headerText: '#FFFFFF',
      headerFrom: '#A3117A', headerTo: '#3D1183',
      badgeFrom: '#FF3D9A', badgeTo: '#A855F7', buttonFrom: '#B21270', buttonTo: '#5B1494',
      badgeText: '#1A0A18', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Bungee', 'Impact', 'Arial Black', sans-serif", body: "'Poppins', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🪩', '🎧', '💜'],
    decorations: ['🪩', '🎧', '🕺', '💿', '✨', '💜'],
    copy: { title: '🪩 Ça va briller ! 🪩', subtitle: 'Sors ton fluo, on allume la piste ce soir' }
  },
  gaming: {
    label: 'Gaming',
    icon: '🎮',
    palette: {
      primary: '#4ADE80', primaryDark: '#86EFAC', secondary: '#38BDF8', accent: '#FACC15',
      bgFrom: '#0F172A', bgVia: '#1E293B', bgTo: '#020617',
      cardBg: '#101828', cardText: '#E6EDF7', headerText: '#FFFFFF',
      headerFrom: '#166534', headerTo: '#0C4A6E',
      badgeFrom: '#4ADE80', badgeTo: '#22D3EE', buttonFrom: '#15803D', buttonTo: '#075985',
      badgeText: '#052E16', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Press Start 2P', 'Courier New', monospace", body: "'Rajdhani', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🎮', '👾', '🕹️'],
    decorations: ['🎮', '👾', '🕹️', '🏆', '⚡', '💥'],
    copy: { title: '🎮 Nouvelle quête ! 🎮', subtitle: 'Rejoins la partie, le boss final t\'attend' }
  },
  y2k: {
    label: 'Y2K',
    icon: '💿',
    palette: {
      primary: '#FF5FD0', primaryDark: '#FFA1E4', secondary: '#7DF9FF', accent: '#C4B5FD',
      bgFrom: '#7DD3FC', bgVia: '#C084FC', bgTo: '#F0ABFC',
      cardBg: '#18122B', cardText: '#F3EDFF', headerText: '#FFFFFF',
      headerFrom: '#B01897', headerTo: '#2E1F86',
      badgeFrom: '#7DF9FF', badgeTo: '#C4B5FD', buttonFrom: '#A9138E', buttonTo: '#3B24A8',
      badgeText: '#151033', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Bungee', 'Impact', 'Arial Black', sans-serif", body: "'Outfit', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['💿', '🦋', '⭐'],
    decorations: ['💿', '🦋', '⭐', '📼', '🛼', '💜'],
    copy: { title: '💿 C\'est trop stylé ! 💿', subtitle: 'Retour direct dans les années 2000, viens danser' }
  },

  // ---- Light-surface themes ----

  foot: {
    label: 'Football',
    icon: '⚽',
    palette: {
      primary: '#0B7A3B', primaryDark: '#075129', secondary: '#111827', accent: '#F5C518',
      bgFrom: '#22A24F', bgVia: '#0E7A3C', bgTo: '#053C1F',
      cardBg: '#FFFFFF', cardText: '#111C16', headerText: '#FFFFFF',
      badgeFrom: '#F5C518', badgeTo: '#E09B00', buttonFrom: '#0B7A3B', buttonTo: '#075129',
      badgeText: '#111C16', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Bungee', 'Impact', 'Arial Black', sans-serif", body: "'Rajdhani', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['⚽', '🏆', '🥅'],
    decorations: ['⚽', '🏆', '🥅', '👟', '🧤', '🎽'],
    copy: { title: '⚽ Coup d\'envoi ! ⚽', subtitle: 'Enfile tes crampons, on entre sur le terrain' }
  },
  mermaid: {
    label: 'Sirène',
    icon: '🧜‍♀️',
    palette: {
      primary: '#0A7A88', primaryDark: '#075B66', secondary: '#F0788C', accent: '#7DD3C0',
      bgFrom: '#7DE2D1', bgVia: '#3AA8C1', bgTo: '#1B4E8E',
      cardBg: '#F7FDFC', cardText: '#123240', headerText: '#FFFFFF',
      badgeFrom: '#FFB3C1', badgeTo: '#F0788C', buttonFrom: '#0A7A88', buttonTo: '#075B66',
      badgeText: '#123240', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Pacifico', 'Brush Script MT', 'Comic Sans MS', cursive", body: "'Quicksand', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🧜‍♀️', '🐚', '🫧'],
    decorations: ['🧜‍♀️', '🐚', '🌊', '🐠', '🫧', '💎'],
    copy: { title: '🧜‍♀️ Plonge avec nous ! 🧜‍♀️', subtitle: 'Une fête sous les vagues t\'attend' }
  },
  jungle: {
    label: 'Safari',
    icon: '🦁',
    palette: {
      primary: '#2F7D32', primaryDark: '#1F5722', secondary: '#B45309', accent: '#F2B01E',
      bgFrom: '#7CB342', bgVia: '#2F7D32', bgTo: '#1B4332',
      cardBg: '#FFFCF2', cardText: '#26301C', headerText: '#FFFFFF',
      badgeFrom: '#F7C244', badgeTo: '#E0900F', buttonFrom: '#2F7D32', buttonTo: '#1F5722',
      badgeText: '#26301C', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Fredoka', 'Trebuchet MS', system-ui, sans-serif", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🦁', '🐘', '🌴'],
    decorations: ['🦁', '🐘', '🌴', '🦓', '🐒', '🌿'],
    copy: { title: '🦁 L\'expédition commence ! 🦁', subtitle: 'Attrape tes jumelles, safari en vue' }
  },
  manga: {
    label: 'Manga',
    icon: '🌸',
    palette: {
      primary: '#D6296B', primaryDark: '#9E1348', secondary: '#1E3A8A', accent: '#FBBF24',
      bgFrom: '#FBCFE8', bgVia: '#E0567F', bgTo: '#1E2A5A',
      cardBg: '#FFFBFC', cardText: '#1B2138', headerText: '#FFFFFF',
      badgeFrom: '#FBBF24', badgeTo: '#F59E0B', buttonFrom: '#D6296B', buttonTo: '#9E1348',
      badgeText: '#1B2138', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Bangers', 'Impact', 'Arial Black', cursive", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🌸', '⚡', '🍥'],
    decorations: ['🌸', '⚡', '🍥', '🗾', '💥', '🐉'],
    copy: { title: '🌸 Prépare-toi ! 🌸', subtitle: 'Une aventure façon manga va commencer' }
  },
  boho: {
    label: 'Bohème',
    icon: '🌾',
    palette: {
      primary: '#A8532F', primaryDark: '#7C3A1F', secondary: '#6B7F5E', accent: '#D9A441',
      bgFrom: '#EFE0D0', bgVia: '#C89A6E', bgTo: '#7C5F45',
      cardBg: '#FFFBF4', cardText: '#33291F', headerText: '#FFF6EC',
      badgeFrom: '#E4C08A', badgeTo: '#D9A441', buttonFrom: '#A8532F', buttonTo: '#7C3A1F',
      badgeText: '#33291F', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Dancing Script', 'Brush Script MT', cursive", body: "'Outfit', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🌾', '🕊️', '🌿'],
    decorations: ['🌾', '🕊️', '🌿', '🪴', '🤎', '✨'],
    copy: { title: '🌾 Save the date 🌾', subtitle: 'Un anniversaire tout en douceur, entre nous' }
  },
  skate: {
    label: 'Skate',
    icon: '🛹',
    palette: {
      primary: '#E4572E', primaryDark: '#A93414', secondary: '#2D3142', accent: '#17BEBB',
      bgFrom: '#F2A65A', bgVia: '#E4572E', bgTo: '#2D3142',
      cardBg: '#FFFDF9', cardText: '#20242F', headerText: '#FFFFFF',
      headerFrom: '#C4401D', headerTo: '#8E2A0F',
      badgeFrom: '#4FE3E0', badgeTo: '#17BEBB', buttonFrom: '#C4401D', buttonTo: '#8E2A0F',
      badgeText: '#0A2426', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Bungee', 'Impact', 'Arial Black', sans-serif", body: "'Outfit', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🛹', '🧢', '🔥'],
    decorations: ['🛹', '🧢', '🎧', '🔥', '🛼', '⚡'],
    copy: { title: '🛹 Rendez-vous au spot ! 🛹', subtitle: 'Ramène ta planche, on trace ensemble' }
  }
};

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME];
}

// Convert a #rrggbb hex to an rgba() string — used to derive translucent accent
// tints (e.g. focus rings) that can't be expressed by appending alpha to a
// var() reference.
function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// A short list of {id, ...theme} for rendering the admin picker.
export const themeList = Object.entries(THEMES).map(([id, theme]) => ({ id, ...theme }));

/*
 * Web fonts, fetched per theme instead of all at once.
 *
 * index.html only carries the families the app shows before a theme is known
 * (the sign-in screens and the default Fiesta paint). Everything else is
 * requested the first time a theme that needs it is applied, which keeps the
 * catalog free to grow without every visitor paying for seventeen themes worth
 * of typefaces on a phone.
 *
 * Keys are the family name as it appears first in a theme's font stack; values
 * are the `family=` argument of the Google Fonts CSS API. Families already in
 * index.html are deliberately absent.
 */
const LAZY_FONTS = {
  Bangers: 'Bangers',
  Bungee: 'Bungee',
  'Dancing Script': 'Dancing+Script:wght@400;600;700',
  Orbitron: 'Orbitron:wght@500;700',
  Outfit: 'Outfit:wght@300;400;500;600',
  Pacifico: 'Pacifico',
  'Press Start 2P': 'Press+Start+2P',
  Quicksand: 'Quicksand:wght@400;500;600;700',
  Rajdhani: 'Rajdhani:wght@500;600;700'
};

const requestedFonts = new Set();

// The leading family of a CSS font stack, unquoted: "'Bungee', Impact" → Bungee.
function leadingFamily(stack) {
  const m = /^\s*'([^']+)'/.exec(stack);
  return m ? m[1] : null;
}

// Append a stylesheet for whichever of the theme's families aren't loaded yet.
// One <link> per family keeps each request cacheable on its own and means a
// failed fetch can't take the other families down with it.
function ensureFonts(theme) {
  for (const stack of [theme.fonts.display, theme.fonts.body]) {
    const family = leadingFamily(stack);
    const spec = family && LAZY_FONTS[family];
    if (!spec || requestedFonts.has(family)) continue;
    requestedFonts.add(family);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    document.head.appendChild(link);
  }
}

// Fetch every catalog typeface at once. The admin's theme picker previews each
// label in its own display font, which only works if the fonts are there — a
// cost worth paying on one admin panel, never on a guest's invitation.
export function preloadThemeFonts() {
  for (const theme of Object.values(THEMES)) ensureFonts(theme);
}

// Write the theme's tokens as CSS custom properties on <html> so the whole app
// re-skins, and expose the id via data-theme for attribute-based styling.
// Gradients are derived from the palette so the catalog stays compact.
export function applyTheme(themeId) {
  const theme = getTheme(themeId);
  const p = theme.palette;
  const root = document.documentElement;
  const set = (k, v) => root.style.setProperty(k, v);

  set('--theme-primary', p.primary);
  set('--theme-primary-dark', p.primaryDark);
  set('--theme-primary-soft', hexToRgba(p.primary, 0.22));
  set('--theme-secondary', p.secondary);
  set('--theme-accent', p.accent);
  set('--theme-card-bg', p.cardBg);
  set('--theme-card-text', p.cardText);
  set('--theme-header-text', p.headerText);
  // Readable text colours on the badge/button gradients (dark on light themes).
  set('--theme-badge-text', p.badgeText || '#FFFFFF');
  set('--theme-button-text', p.buttonText || '#FFFFFF');

  set('--theme-bg-gradient', `linear-gradient(135deg, ${p.bgFrom}, ${p.bgVia}, ${p.bgTo})`);
  // A theme may give the header its own (usually deeper) pair of stops so the
  // accent colour stays vivid without dragging the header text under AA.
  set(
    '--theme-header-gradient',
    `linear-gradient(135deg, ${p.headerFrom || p.primary}, ${p.headerTo || p.primaryDark})`
  );
  set('--theme-button-gradient', `linear-gradient(135deg, ${p.buttonFrom}, ${p.buttonTo})`);
  set('--theme-badge-gradient', `linear-gradient(135deg, ${p.badgeFrom}, ${p.badgeTo})`);

  set('--theme-font-display', theme.fonts.display);
  set('--theme-font-body', theme.fonts.body);

  ensureFonts(theme);
  root.dataset.theme = themeId;
  return theme;
}

// Visual catalog for the selectable UI theme. The set of ids here MUST stay in
// sync with the server-side allow-list (server/src/themes.ts THEME_IDS).
//
// A theme is described purely with hex colors, emoji and font stacks — no image
// assets — so it re-skins the whole app via CSS custom properties (see
// applyTheme). Theme names are labels only; the visuals merely evoke a vibe.

export const DEFAULT_THEME = 'fiesta';

export const THEMES = {
  fiesta: {
    label: 'Fiesta',
    icon: '🎉',
    palette: {
      primary: '#FF4D6D', primaryDark: '#C9184A', secondary: '#4361EE', accent: '#FFB703',
      bgFrom: '#FF5C8A', bgVia: '#7B5BFF', bgTo: '#21D4FD',
      cardBg: '#FFFFFF', cardText: '#1F2333', headerText: '#FFFFFF',
      badgeFrom: '#FFB703', badgeTo: '#FB8500', buttonFrom: '#FF4D6D', buttonTo: '#C9184A'
    },
    fonts: { display: "'Baloo 2', 'Trebuchet MS', 'Comic Sans MS', cursive", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🎉', '🎈', '🥳'],
    decorations: ['🎉', '🎈', '🎊', '✨', '🍭', '🎁'],
    copy: { title: '🎉 Tu es invité(e) ! 🎉', subtitle: 'Viens faire la fête avec nous 🎈' }
  },
  spiderman: {
    label: 'Spider-Man',
    icon: '🕷️',
    palette: {
      primary: '#E23636', primaryDark: '#A11616', secondary: '#1D4ED8', accent: '#0F1B3D',
      bgFrom: '#C1121F', bgVia: '#1E3A8A', bgTo: '#0B1220',
      cardBg: '#FFFFFF', cardText: '#16213E', headerText: '#FFFFFF',
      badgeFrom: '#E23636', badgeTo: '#1D4ED8', buttonFrom: '#E23636', buttonTo: '#A11616'
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
      primary: '#D7263D', primaryDark: '#8C0E1E', secondary: '#FFC300', accent: '#FFD700',
      bgFrom: '#7A0C16', bgVia: '#B71C2B', bgTo: '#C9930B',
      cardBg: '#FFFDF5', cardText: '#2A1206', headerText: '#FFF6D6',
      badgeFrom: '#FFC300', badgeTo: '#E08A00', buttonFrom: '#D7263D', buttonTo: '#8C0E1E'
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
      primary: '#0085CA', primaryDark: '#005B8C', secondary: '#E4002B', accent: '#FFD200',
      bgFrom: '#00A0E3', bgVia: '#1976D2', bgTo: '#0B5394',
      cardBg: '#FFFFFF', cardText: '#16334A', headerText: '#FFFFFF',
      badgeFrom: '#FFD200', badgeTo: '#FFA000', buttonFrom: '#E4002B', buttonTo: '#B00020'
    },
    fonts: { display: "'Baloo 2', 'Trebuchet MS', 'Comic Sans MS', cursive", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🐾', '🚓', '🚒'],
    decorations: ['🐾', '🐶', '🚓', '🚒', '🚁', '⭐'],
    copy: { title: '🐾 Pas de mission trop dure ! 🐾', subtitle: 'La patrouille a besoin de toi pour faire la fête' }
  },
  mickey: {
    label: 'Mickey',
    icon: '🐭',
    palette: {
      primary: '#D7141A', primaryDark: '#9E0B10', secondary: '#111111', accent: '#FFC60A',
      bgFrom: '#E63946', bgVia: '#C1121F', bgTo: '#1A1A1A',
      cardBg: '#FFFFFF', cardText: '#1A1A1A', headerText: '#FFFFFF',
      badgeFrom: '#FFC60A', badgeTo: '#F59E0B', buttonFrom: '#D7141A', buttonTo: '#9E0B10'
    },
    fonts: { display: "'Baloo 2', 'Trebuchet MS', 'Comic Sans MS', cursive", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🐭', '🎈', '🎀'],
    decorations: ['🐭', '🎈', '🎀', '⭐', '🧤', '🎉'],
    copy: { title: '🎈 C\'est la fête, hourra ! 🎈', subtitle: 'Une journée magique t\'attend, viens vite' }
  },
  princess: {
    label: 'Princesse',
    icon: '👑',
    palette: {
      primary: '#E86AA6', primaryDark: '#C44D88', secondary: '#B79CED', accent: '#E8C36B',
      bgFrom: '#FAD0E4', bgVia: '#E7B6E8', bgTo: '#C9B6F2',
      cardBg: '#FFFBFE', cardText: '#4A2740', headerText: '#5B2A4E',
      badgeFrom: '#F3D27A', badgeTo: '#E0A93B', buttonFrom: '#E86AA6', buttonTo: '#C44D88'
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
      primary: '#2E8B57', primaryDark: '#1E5E3A', secondary: '#A77B43', accent: '#E8B23A',
      bgFrom: '#3FA34D', bgVia: '#1E7A46', bgTo: '#14532D',
      cardBg: '#FDFBF3', cardText: '#22331C', headerText: '#F2FBEF',
      badgeFrom: '#E8B23A', badgeTo: '#C8860F', buttonFrom: '#2E8B57', buttonTo: '#1E5E3A'
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
      primary: '#7C3AED', primaryDark: '#4C1D95', secondary: '#22D3EE', accent: '#F472B6',
      bgFrom: '#1E1B4B', bgVia: '#3B0764', bgTo: '#0B1026',
      cardBg: '#FFFFFF', cardText: '#1A1633', headerText: '#EAEAFF',
      badgeFrom: '#22D3EE', badgeTo: '#3B82F6', buttonFrom: '#7C3AED', buttonTo: '#4C1D95'
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
      primary: '#FF7EB9', primaryDark: '#E0559A', secondary: '#5EE0D0', accent: '#FFD166',
      bgFrom: '#FFC8DD', bgVia: '#C8B6FF', bgTo: '#A0E7E5',
      cardBg: '#FFFCFE', cardText: '#46264D', headerText: '#54285C',
      badgeFrom: '#FFD166', badgeTo: '#FF9A8B', buttonFrom: '#FF7EB9', buttonTo: '#E0559A'
    },
    fonts: { display: "'Pacifico', 'Brush Script MT', 'Comic Sans MS', cursive", body: "'Quicksand', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🦄', '🌈', '✨'],
    decorations: ['🦄', '🌈', '✨', '☁️', '💖', '⭐'],
    copy: { title: '🦄 Un anniversaire magique 🦄', subtitle: 'Suis l\'arc-en-ciel jusqu\'à notre fête enchantée' }
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

  set('--theme-bg-gradient', `linear-gradient(135deg, ${p.bgFrom}, ${p.bgVia}, ${p.bgTo})`);
  set('--theme-header-gradient', `linear-gradient(135deg, ${p.primary}, ${p.primaryDark})`);
  set('--theme-button-gradient', `linear-gradient(135deg, ${p.buttonFrom}, ${p.buttonTo})`);
  set('--theme-badge-gradient', `linear-gradient(135deg, ${p.badgeFrom}, ${p.badgeTo})`);

  set('--theme-font-display', theme.fonts.display);
  set('--theme-font-body', theme.fonts.body);

  root.dataset.theme = themeId;
  return theme;
}

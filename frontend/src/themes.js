export const DEFAULT_THEME = 'kid';

export const THEMES = {
  kid: {
    label: 'Kid',
    icon: '🎈',
    blurb: 'Rond, coloré, contours épais et ombres franches.',
    palette: {
      primary: '#E8443C', primaryDark: '#A82019', secondary: '#2C7BE5', accent: '#FFC93C',
      bgFrom: '#FFD166', bgVia: '#EF476F', bgTo: '#6C63FF',
      cardBg: '#FFFFFF', cardText: '#21243D', headerText: '#FFFFFF',
      headerFrom: '#D93A32', headerTo: '#A82019',
      badgeFrom: '#FFD75E', badgeTo: '#FF9F1C', buttonFrom: '#D93A32', buttonTo: '#A82019',
      badgeText: '#21243D', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Fredoka', 'Trebuchet MS', system-ui, sans-serif", body: "'Nunito', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🎈', '🎉', '🥳'],
    decorations: ['🎈', '🎉', '🎊', '⭐', '🍭', '🎁'],
    copy: { title: '🎉 Tu es invité(e) ! 🎉', subtitle: 'Viens faire la fête avec nous 🎈' }
  },
  floral: {
    label: 'Floral',
    icon: '🌸',
    blurb: 'Papier crème, bord festonné, anglaise et compteurs ronds.',
    palette: {
      primary: '#A8446B', primaryDark: '#7C2B4C', secondary: '#6E8460', accent: '#E4B7A0',
      bgFrom: '#F6E7DC', bgVia: '#E0BFB8', bgTo: '#9DAE8E',
      cardBg: '#FFFCF8', cardText: '#3A2E2A', headerText: '#FFF6F0',
      badgeFrom: '#F3D9C6', badgeTo: '#E4B7A0', buttonFrom: '#A8446B', buttonTo: '#7C2B4C',
      badgeText: '#3A2E2A', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Dancing Script', 'Brush Script MT', cursive", body: "'Quicksand', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🌸', '🌿', '🕊️'],
    decorations: ['🌸', '🌿', '🌷', '🍃', '✨', '🤍'],
    copy: { title: '🌸 Une jolie journée nous attend 🌸', subtitle: 'Rejoins-nous pour souffler les bougies' }
  },
  neon: {
    label: 'Néon',
    icon: '🪩',
    blurb: 'Nuit, halos saturés, pilules lumineuses et faisceaux.',
    palette: {
      primary: '#FF3D9A', primaryDark: '#FF8AC6', secondary: '#22D3EE', accent: '#A855F7',
      bgFrom: '#2B0B45', bgVia: '#5B0F8B', bgTo: '#0A0A1A',
      cardBg: '#141126', cardText: '#F2EEFF', headerText: '#FFFFFF',
      headerFrom: '#A3117A', headerTo: '#3D1183',
      badgeFrom: '#FF3D9A', badgeTo: '#A855F7', buttonFrom: '#B21270', buttonTo: '#5B1494',
      badgeText: '#1A0A18', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Bungee', 'Impact', 'Arial Black', sans-serif", body: "'Poppins', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🪩', '🎧', '💜'],
    decorations: ['🪩', '🎧', '🕺', '💿', '✨', '💜'],
    copy: { title: '🪩 Ça va briller ! 🪩', subtitle: "Sors ton fluo, on allume la piste ce soir" }
  },
  robotic: {
    label: 'Robotic',
    icon: '🤖',
    blurb: 'Angles biseautés, grille technique, capitales espacées.',
    palette: {
      primary: '#22D3EE', primaryDark: '#7DD3FC', secondary: '#38BDF8', accent: '#A3E635',
      bgFrom: '#0B1220', bgVia: '#12203A', bgTo: '#030712',
      cardBg: '#0E1626', cardText: '#DCE7F5', headerText: '#FFFFFF',
      headerFrom: '#0B4E63', headerTo: '#10233F',
      badgeFrom: '#22D3EE', badgeTo: '#38BDF8', buttonFrom: '#0A6377', buttonTo: '#123B63',
      badgeText: '#04222E', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Orbitron', 'Trebuchet MS', 'Arial Black', sans-serif", body: "'Rajdhani', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🤖', '⚙️', '⚡'],
    decorations: ['🤖', '⚙️', '🛰️', '⚡', '🔩', '📡'],
    copy: { title: '⚡ Système activé ⚡', subtitle: 'Protocole fête initialisé — ta présence est requise' }
  },
  retro: {
    label: 'Retro',
    icon: '📼',
    blurb: "Contours à l'encre, ombres portées franches, rayures.",
    palette: {
      primary: '#D6004A', primaryDark: '#9C0036', secondary: '#141414', accent: '#FFD400',
      bgFrom: '#FFD400', bgVia: '#FF7A00', bgTo: '#00A8B0',
      cardBg: '#FFF8E7', cardText: '#141414', headerText: '#FFFFFF',
      badgeFrom: '#FFD400', badgeTo: '#FFAE00', buttonFrom: '#D6004A', buttonTo: '#9C0036',
      badgeText: '#141414', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Bungee', 'Impact', 'Arial Black', sans-serif", body: "'Outfit', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['📼', '🕹️', '⭐'],
    decorations: ['📼', '🕹️', '💿', '⭐', '🛼', '🎸'],
    copy: { title: "📼 Rembobine, c'est la fête ! 📼", subtitle: 'Ambiance rétro garantie, ramène ton meilleur look' }
  },
  modern: {
    label: 'Modern',
    icon: '✦',
    blurb: "Éditorial : beaucoup de blanc, un seul accent, aucun ornement.",
    palette: {
      primary: '#2F5BFF', primaryDark: '#1A3BC4', secondary: '#111827', accent: '#0E9490',
      bgFrom: '#EEF1F7', bgVia: '#C3CDDF', bgTo: '#6B7A93',
      cardBg: '#FFFFFF', cardText: '#111827', headerText: '#FFFFFF',
      badgeFrom: '#E7ECF5', badgeTo: '#CBD5E1', buttonFrom: '#2F5BFF', buttonTo: '#1A3BC4',
      badgeText: '#111827', buttonText: '#FFFFFF'
    },
    fonts: { display: "'Outfit', 'Segoe UI', system-ui, sans-serif", body: "'Outfit', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['✦'],
    decorations: ['✦', '✧', '◆'],
    copy: { title: 'Save the date', subtitle: 'Un anniversaire à ne pas manquer' }
  },
  elegant: {
    label: 'Élégant',
    icon: '🥂',
    blurb: 'Encre et or, filets fins, romaine et petites capitales.',
    palette: {
      primary: '#8C6D2C', primaryDark: '#6B5220', secondary: '#1C2530', accent: '#C9A227',
      bgFrom: '#39414F', bgVia: '#1E2531', bgTo: '#0D1116',
      cardBg: '#FBF7EF', cardText: '#22252B', headerText: '#F0E2BC',
      headerFrom: '#1C2530', headerTo: '#0D1116',
      badgeFrom: '#EBDCB4', badgeTo: '#D9BE70', buttonFrom: '#1C2530', buttonTo: '#0D1116',
      badgeText: '#22252B', buttonText: '#F0E2BC'
    },
    fonts: { display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif", body: "'Outfit', 'Segoe UI', system-ui, sans-serif" },
    heroEmojis: ['🥂', '✨', '🎂'],
    decorations: ['🥂', '✨', '🎂', '🕯️', '🤍', '🍾'],
    copy: { title: '✨ Vous êtes convié(e) ✨', subtitle: 'Un anniversaire à célébrer comme il se doit' }
  }
};

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME];
}

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const themeList = Object.entries(THEMES).map(([id, theme]) => ({ id, ...theme }));

const LAZY_FONTS = {
  Bungee: 'Bungee',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500',
  'Dancing Script': 'Dancing+Script:wght@400;600;700',
  Orbitron: 'Orbitron:wght@500;700',
  Outfit: 'Outfit:wght@300;400;500;600;700',
  Quicksand: 'Quicksand:wght@400;500;600;700',
  Rajdhani: 'Rajdhani:wght@500;600;700'
};

const requestedFonts = new Set();

function leadingFamily(stack) {
  const m = /^\s*'([^']+)'/.exec(stack);
  return m ? m[1] : null;
}

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

export function preloadThemeFonts() {
  for (const theme of Object.values(THEMES)) ensureFonts(theme);
}

export function themeVars(themeId) {
  const p = getTheme(themeId).palette;
  const theme = getTheme(themeId);
  return {
    '--theme-primary': p.primary,
    '--theme-primary-dark': p.primaryDark,
    '--theme-primary-soft': hexToRgba(p.primary, 0.22),
    '--theme-secondary': p.secondary,
    '--theme-accent': p.accent,
    '--theme-card-bg': p.cardBg,
    '--theme-card-text': p.cardText,
    '--theme-header-text': p.headerText,
    '--theme-badge-text': p.badgeText || '#FFFFFF',
    '--theme-button-text': p.buttonText || '#FFFFFF',

    '--theme-bg-gradient': `linear-gradient(135deg, ${p.bgFrom}, ${p.bgVia}, ${p.bgTo})`,
    '--theme-header-gradient':
      `linear-gradient(135deg, ${p.headerFrom || p.primary}, ${p.headerTo || p.primaryDark})`,
    '--theme-button-gradient': `linear-gradient(135deg, ${p.buttonFrom}, ${p.buttonTo})`,
    '--theme-badge-gradient': `linear-gradient(135deg, ${p.badgeFrom}, ${p.badgeTo})`,

    '--theme-font-display': theme.fonts.display,
    '--theme-font-body': theme.fonts.body
  };
}

export function applyTheme(themeId) {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(themeVars(themeId))) {
    root.style.setProperty(key, value);
  }
  ensureFonts(theme);
  root.dataset.theme = themeId;
  return theme;
}

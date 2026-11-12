// SnapContact design tokens: a deep navy base, a clear blue accent for actions, and gold reserved
// for Pro so a paying member can tell their plan apart at a glance.
const darkTheme = {
  text: '#F1F5FF',
  tint: '#5B8CFF',
  background: '#070B14',
  foreground: '#F1F5FF',
  card: '#0F1729',
  cardForeground: '#F1F5FF',
  primary: '#FFFFFF',
  primaryForeground: '#070B14',
  secondary: '#162036',
  secondaryForeground: '#F1F5FF',
  muted: '#162036',
  mutedForeground: '#9AA8C2',
  subtle: '#67769A',
  accent: '#5B8CFF',
  accentForeground: '#FFFFFF',
  destructive: '#F25C5C',
  destructiveForeground: '#FFFFFF',
  border: '#1E2A44',
  borderSubtle: '#162036',
  borderHighlight: '#2E3F63',
  input: '#0F1729',
  inputSurface: '#0C1426',
  // Pro: gold accent used only for paid-plan styling.
  pro: '#F5C542',
  proDeep: '#C98A12',
  proForeground: '#1A1200',
  proSoft: 'rgba(245, 197, 66, 0.14)',
};

const colors = {
  light: darkTheme,
  dark: darkTheme,
  radius: 20,
};

export default colors;

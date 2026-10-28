/** Preserve the supplied light palette and a motion-safe writing-card accent. */
import colors from 'tailwindcss/colors';

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: colors.slate[50], surface: '#ffffff', 'surface-raised': '#ffffff',
        foreground: colors.slate[800], 'foreground-muted': colors.slate[600],
        border: colors.slate[200], ring: colors.indigo[500],
        primary: colors.indigo, secondary: colors.violet, neutral: colors.slate,
        success: { DEFAULT: colors.teal[700], light: colors.teal[50] },
        warning: { DEFAULT: colors.amber[800], light: colors.amber[50] },
        error: { DEFAULT: colors.red[700], light: colors.red[50] },
        info: { DEFAULT: colors.indigo[700], light: colors.indigo[50] },
      },
      fontFamily: { display: ['Georgia', 'Cambria', 'serif'], sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      fontSize: { hero: ['clamp(2.5rem, 4.5vw, 3.75rem)', { lineHeight: '1.12', letterSpacing: '-0.035em' }] },
      boxShadow: { focal: '0 24px 60px -18px rgb(67 56 202 / 0.24)' },
      keyframes: { float: { '0%, 100%': { transform: 'translateY(0) rotate(-3deg)' }, '50%': { transform: 'translateY(-10px) rotate(-2deg)' } } },
      animation: { float: 'float 6s ease-in-out infinite' },
      transitionDuration: { gentle: '250ms' },
    },
  },
  plugins: [],
};

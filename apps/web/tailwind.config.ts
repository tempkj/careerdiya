import type { Config } from 'tailwindcss';

// Career Diya design tokens (public/assets/site.css + design-system-v2.css), mapped onto the
// Tailwind scales the CareerĀsanā components already use, so gray/blue utilities render in
// Career Diya's ink, warm neutrals and navy rather than Tailwind's defaults.
export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        gray: {
          50: '#fbfbf8', // paper
          100: '#f4f3ee',
          200: '#e8e7e2', // line
          300: '#ddd9d0', // input border
          400: '#6c7386', // darkened from #9a9fae: small grey labels now meet WCAG AA (4.5:1)
          500: '#687083', // muted
          600: '#586175',
          700: '#42475a',
          800: '#262a3a',
          900: '#151827', // ink
        },
        blue: {
          50: '#eef1fa',
          100: '#dde3f5',
          200: '#bcc7ea',
          300: '#8fa0d6',
          400: '#5d73bd',
          500: '#3a52a6',
          600: '#2a4498',
          700: '#213a8f', // brand navy
          800: '#1a2e72',
          900: '#142357',
        },
        brand: { DEFAULT: '#213a8f', gold: '#d4a017', soft: '#f8f1d9' },
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
} satisfies Config;

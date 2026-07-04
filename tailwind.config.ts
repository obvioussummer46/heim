import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d1117',
          raised: '#161b22',
          overlay: '#1f2630',
        },
        accent: {
          DEFAULT: '#a78bfa',
          dim: '#7c5cd6',
        },
      },
    },
  },
  plugins: [],
};
export default config;

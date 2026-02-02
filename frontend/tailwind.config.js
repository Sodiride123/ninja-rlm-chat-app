/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Refined neutral palette - softer, warmer tones
        surface: {
          primary: '#ffffff',
          secondary: '#f9fafb',
          tertiary: '#f3f4f6',
          hover: '#f3f4f6',
          user: '#e8e8ed',  // Soft neutral for user messages - subtle, premium feel
        },
        border: {
          DEFAULT: '#e5e7eb',
          subtle: '#f0f0f0',
        },
        text: {
          primary: '#111827',
          secondary: '#6b7280',
          tertiary: '#9ca3af',
        },
        // Refined accent colors
        accent: {
          primary: '#2563eb',
          'primary-hover': '#1d4ed8',
          subtle: '#eff6ff',
          'subtle-hover': '#dbeafe',
        },
        // Progress panel dark theme
        panel: {
          bg: '#1a1a1a',
          surface: '#262626',
          'surface-hover': '#333333',
          border: '#333333',
          text: '#e5e5e5',
          'text-secondary': '#a3a3a3',
        },
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'soft-md': '0 2px 4px -1px rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03)',
        'soft-lg': '0 4px 6px -2px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.03)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

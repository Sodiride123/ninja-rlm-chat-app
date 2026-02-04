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
        // ChatPDF-style violet accent colors
        accent: {
          primary: '#7c3aed',        // violet-600
          'primary-hover': '#6d28d9', // violet-700
          subtle: '#f5f3ff',          // violet-50
          'subtle-hover': '#ede9fe',  // violet-100
          muted: '#a78bfa',           // violet-400 for secondary elements
        },
        // Progress panel - light theme matching sidebar
        panel: {
          bg: '#f5f5f7',
          surface: '#ffffff',
          'surface-hover': '#f0f0f2',
          border: '#e5e7eb',
          text: '#111827',
          'text-secondary': '#6b7280',
        },
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'soft-md': '0 2px 4px -1px rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03)',
        'soft-lg': '0 4px 6px -2px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.03)',
        // ChatPDF-style shadows - clean, premium
        'chatpdf': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'chatpdf-md': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'chatpdf-lg': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      borderRadius: {
        'chatpdf': '12px',      // ChatPDF rounded corners
        'chatpdf-lg': '16px',
        'chatpdf-xl': '20px',
      },
      fontSize: {
        'chatpdf-sm': ['13px', '20px'],
        'chatpdf-base': ['15px', '24px'],
      },
    },
  },
  plugins: [],
};

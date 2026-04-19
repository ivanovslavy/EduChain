/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light Theme Colors (65% primary, 30% secondary, 5% accent)
        light: {
          primary: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
          },
          accent: {
            50: '#fef2f2',
            100: '#fee2e2',
            200: '#fecaca',
            300: '#fca5a5',
            400: '#f87171',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c',
            800: '#991b1b',
            900: '#7f1d1d',
          }
        },
        // Dark Theme Colors
        dark: {
          primary: {
            50: '#1a1f2e',
            100: '#1e2532',
            200: '#252b3a',
            300: '#2d3548',
            400: '#3d4758',
            500: '#5a6478',
            600: '#8892a6',
            700: '#a8b4c8',
            800: '#c8d4e8',
            900: '#e8f4ff',
          },
          accent: {
            50: '#1a1f2e',
            100: '#2d1f2e',
            200: '#3d2a3d',
            300: '#4d3a4d',
            400: '#6d4a6d',
            500: '#8d6a8d',
            600: '#ad8aad',
            700: '#cdaacd',
            800: '#ddcadd',
            900: '#edeaed',
          }
        }
      },
    },
  },
  plugins: [],
}

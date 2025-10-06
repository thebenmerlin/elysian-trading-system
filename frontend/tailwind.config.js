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
        // Terminal color scheme
        'terminal': {
          'bg': '#000000',
          'primary': '#00FF9C',  // Bright green
          'secondary': '#00D2FF', // Cyan
          'warning': '#FFB800',   // Orange
          'error': '#FF5757',     // Red
          'muted': '#888888',     // Gray
          'border': '#333333',    // Dark gray
        }
      },
      fontFamily: {
        'mono': ['SF Mono', 'Monaco', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'typewriter': 'typewriter 2s steps(20) forwards',
        'caret': 'caret 1s infinite',
        'pulse-green': 'pulse-green 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
      },
      keyframes: {
        typewriter: {
          '0%': { width: '0%' },
          '100%': { width: '100%' }
        },
        caret: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' }
        },
        'pulse-green': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
      screens: {
        'xs': '475px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

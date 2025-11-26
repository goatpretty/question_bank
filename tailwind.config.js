/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '2.5rem',
        '2xl': '3rem',
      },
    },
    extend: {
      colors: {
        // Primary Color System - Professional Blue Palette
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        // Secondary Color System - Slate for professional feel
        secondary: {
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
          950: '#020617',
        },
        // Accent Colors
        accent: {
          blue: '#3b82f6',
          green: '#10b981',
          red: '#ef4444',
          orange: '#f59e0b',
          purple: '#8b5cf6',
          pink: '#ec4899',
        },
        // Semantic Colors
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        // Enhanced typography scale
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      spacing: {
        // Enhanced spacing system
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      boxShadow: {
        // Professional shadow system
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 20px 30px -3px rgba(0, 0, 0, 0.05)',
        'strong': '0 10px 40px -8px rgba(0, 0, 0, 0.15), 0 25px 50px -5px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.3)',
        'glow-strong': '0 0 40px rgba(59, 130, 246, 0.5)',
      },
      animation: {
        // Smooth animations
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-soft': 'bounceSoft 0.6s ease-in-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(-5%)' },
          '50%': { transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      borderRadius: {
        // Enhanced border radius
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
      },
      backdropBlur: {
        // Glass morphism support
        xs: '2px',
      },
      transitionDuration: {
        // Custom transitions
        '250': '250ms',
        '350': '350ms',
        '450': '450ms',
        '550': '550ms',
      },
      transitionTimingFunction: {
        // Smooth easing
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      screens: {
        // Enhanced responsive breakpoints
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        '3xl': '1920px',
        '4xl': '2560px',
      },
      zIndex: {
        // Enhanced z-index system
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [
    // Custom plugin for glass morphism and advanced utilities
    function({ addUtilities, theme, variants }) {
      addUtilities({
        // Glass morphism effects
        '.glass': {
          'backdrop-filter': 'blur(10px)',
          'background-color': 'rgba(255, 255, 255, 0.1)',
          'border': '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.glass-dark': {
          'backdrop-filter': 'blur(10px)',
          'background-color': 'rgba(0, 0, 0, 0.1)',
          'border': '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.glass-strong': {
          'backdrop-filter': 'blur(20px)',
          'background-color': 'rgba(255, 255, 255, 0.15)',
          'border': '1px solid rgba(255, 255, 255, 0.25)',
        },
        '.glass-strong-dark': {
          'backdrop-filter': 'blur(20px)',
          'background-color': 'rgba(0, 0, 0, 0.15)',
          'border': '1px solid rgba(255, 255, 255, 0.15)',
        },
        // Text shadows
        '.text-shadow': {
          'text-shadow': '0 2px 4px rgba(0, 0, 0, 0.1)',
        },
        '.text-shadow-lg': {
          'text-shadow': '0 4px 8px rgba(0, 0, 0, 0.2)',
        },
        '.text-shadow-soft': {
          'text-shadow': '0 1px 2px rgba(0, 0, 0, 0.05)',
        },
        // Gradient text utilities
        '.gradient-text-primary': {
          'background': 'linear-gradient(to right, #0ea5e9, #0284c7)',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
        },
        '.gradient-text-purple': {
          'background': 'linear-gradient(to right, #8b5cf6, #a855f7)',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
        },
        '.gradient-text-green': {
          'background': 'linear-gradient(to right, #10b981, #059669)',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
        },
        // Advanced spacing utilities
        '.spacing-tight': {
          'letter-spacing': '-0.025em',
        },
        '.spacing-wide': {
          'letter-spacing': '0.025em',
        },
        '.spacing-wider': {
          'letter-spacing': '0.05em',
        },
        // Focus ring utilities
        '.focus-ring': {
          'outline': '2px solid transparent',
          'outline-offset': '2px',
          'box-shadow': '0 0 0 2px #fff, 0 0 0 4px #0ea5e9',
        },
        '.focus-ring-dark': {
          'outline': '2px solid transparent',
          'outline-offset': '2px',
          'box-shadow': '0 0 0 2px #020617, 0 0 0 4px #0ea5e9',
        },
        // Animation utilities
        '.animate-delay-100': {
          'animation-delay': '100ms',
        },
        '.animate-delay-200': {
          'animation-delay': '200ms',
        },
        '.animate-delay-300': {
          'animation-delay': '300ms',
        },
        '.animate-delay-400': {
          'animation-delay': '400ms',
        },
        '.animate-delay-500': {
          'animation-delay': '500ms',
        },
        // Scroll utilities
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            'display': 'none',
          },
        },
        '.scrollbar-thin': {
          '&::-webkit-scrollbar': {
            'width': '4px',
            'height': '4px',
          },
          '&::-webkit-scrollbar-track': {
            'background': 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            'background': '#cbd5e1',
            'border-radius': '2px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            'background': '#94a3b8',
          },
        },
        // Dark mode scrollbar
        '.dark .scrollbar-thin': {
          '&::-webkit-scrollbar-thumb': {
            'background': '#475569',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            'background': '#64748b',
          },
        },
      });
    },
    // Plugin for safe area utilities (mobile notch support)
    function({ addUtilities }) {
      addUtilities({
        '.safe-top': {
          'padding-top': 'env(safe-area-inset-top)',
        },
        '.safe-bottom': {
          'padding-bottom': 'env(safe-area-inset-bottom)',
        },
        '.safe-left': {
          'padding-left': 'env(safe-area-inset-left)',
        },
        '.safe-right': {
          'padding-right': 'env(safe-area-inset-right)',
        },
      });
    },
  ],
};
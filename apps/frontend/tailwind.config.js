/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // Enhanced Color Palette
      colors: {
        brand: {
          navy: "#0F2B5E",
          red: "#E63946",
          sand: "#F5EFEA",
          sky: "#00a8e8",
        },
        ink: "#0b1220",
        mist: "#f9fbff",
        
        // Semantic Colors
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        
        // Extended Gray Scale
        gray: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
      },

      // Enhanced Typography
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "-apple-system", "sans-serif"],
        display: ["Fraunces", "serif"],
        mono: ["Menlo", "Monaco", "Courier New", "monospace"],
      },

      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        "4xl": ["36px", { lineHeight: "44px" }],
      },

      fontWeight: {
        thin: "100",
        extralight: "200",
        light: "300",
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        extrabold: "800",
        black: "900",
      },

      // Professional Spacing Scale
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
        "4xl": "64px",
      },

      // Border Radius
      borderRadius: {
        none: "0",
        sm: "4px",
        base: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        full: "9999px",
      },

      // Professional Shadows
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        base: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        md: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        lg: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        xl: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)",
        none: "none",
      },

      // Smooth Transitions
      transitionDuration: {
        150: "150ms",
        200: "200ms",
        300: "300ms",
        500: "500ms",
      },

      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      // Enhanced Keyframes
      keyframes: {
        floatSlow: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },

      animation: {
        "float-slow": "floatSlow 8s ease-in-out infinite",
        rise: "rise 0.8s ease forwards",
        shimmer: "shimmer 6s ease-in-out infinite",
        "slide-down": "slideDown 300ms ease forwards",
        "slide-up": "slideUp 300ms ease forwards",
        "fade-in": "fadeIn 300ms ease forwards",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scale-in": "scaleIn 300ms ease forwards",
      },

      // Backdrop Effects
      backdropFilter: {
        blur: "blur(4px)",
        "blur-md": "blur(12px)",
      },
    },
  },

  plugins: [
    // Component layer for reusable styles
    function ({ addBase, addComponents, e, theme }) {
      // Base improvements
      addBase({
        "html": { scrollBehavior: "smooth" },
        "body": { 
          "@apply bg-mist text-ink": {},
          fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
        },
        "::-webkit-scrollbar": {
          width: "8px",
          height: "8px",
        },
        "::-webkit-scrollbar-track": {
          "@apply bg-mist": {},
        },
        "::-webkit-scrollbar-thumb": {
          "@apply bg-gray-300 rounded-full hover:bg-gray-400": {},
        },
      });

      // Component layers
      addComponents({
        // Buttons - Multiple variants
        ".btn": {
          "@apply px-lg py-md rounded-md font-semibold transition-all duration-200 inline-flex items-center justify-center gap-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed": {},
        },
        ".btn-primary": {
          "@apply btn bg-brand-red text-white hover:bg-opacity-90 shadow-sm hover:shadow-md active:shadow-xs": {},
        },
        ".btn-secondary": {
          "@apply btn bg-gray-100 text-ink hover:bg-gray-200 border border-gray-200": {},
        },
        ".btn-outline": {
          "@apply btn bg-white text-brand-navy border-2 border-brand-navy hover:bg-brand-navy hover:text-white": {},
        },
        ".btn-ghost": {
          "@apply btn bg-transparent text-brand-navy hover:bg-brand-navy/10": {},
        },
        ".btn-sm": {
          "@apply px-md py-sm text-sm": {},
        },
        ".btn-lg": {
          "@apply px-2xl py-lg text-lg": {},
        },
        ".btn-icon": {
          "@apply btn p-md hover:bg-gray-100 rounded-lg": {},
        },
        ".btn-disabled": {
          "@apply opacity-50 cursor-not-allowed": {},
        },

        // Form Fields
        ".form-field": {
          "@apply w-full rounded-md border border-gray-200 px-lg py-md text-base bg-white transition-all duration-200": {},
          "&:focus": {
            "@apply border-brand-navy outline-none ring-2 ring-brand-navy/20": {},
          },
          "&:disabled": {
            "@apply bg-gray-50 text-gray-500 cursor-not-allowed": {},
          },
          "&::placeholder": {
            "@apply text-gray-400": {},
          },
        },

        ".form-label": {
          "@apply block text-sm font-semibold text-ink mb-md": {},
        },

        ".form-error": {
          "@apply text-danger text-sm mt-sm": {},
        },

        ".form-hint": {
          "@apply text-gray-500 text-sm mt-sm": {},
        },

        // Cards & Containers
        ".card": {
          "@apply bg-white rounded-lg border border-gray-200 p-lg shadow-sm hover:shadow-md transition-shadow duration-200": {},
        },

        ".card-elevated": {
          "@apply card shadow-md hover:shadow-lg": {},
        },

        ".card-flat": {
          "@apply bg-white rounded-lg p-lg border-0": {},
        },

        ".card-hover": {
          "@apply card cursor-pointer hover:border-brand-navy": {},
        },

        // Badges
        ".badge": {
          "@apply inline-flex items-center px-md py-sm rounded-full text-xs font-semibold": {},
        },

        ".badge-success": {
          "@apply badge bg-success/10 text-success": {},
        },

        ".badge-warning": {
          "@apply badge bg-warning/10 text-warning": {},
        },

        ".badge-danger": {
          "@apply badge bg-danger/10 text-danger": {},
        },

        ".badge-info": {
          "@apply badge bg-info/10 text-info": {},
        },

        ".badge-primary": {
          "@apply badge bg-brand-red/10 text-brand-red": {},
        },

        // Alerts
        ".alert": {
          "@apply px-lg py-md rounded-md border": {},
        },

        ".alert-success": {
          "@apply alert bg-success/10 border-success/30 text-success": {},
        },

        ".alert-warning": {
          "@apply alert bg-warning/10 border-warning/30 text-warning": {},
        },

        ".alert-danger": {
          "@apply alert bg-danger/10 border-danger/30 text-danger": {},
        },

        ".alert-info": {
          "@apply alert bg-info/10 border-info/30 text-info": {},
        },

        // Text Utilities
        ".text-headline": {
          "@apply text-3xl font-bold text-ink": {},
        },

        ".text-subheadline": {
          "@apply text-2xl font-bold text-ink": {},
        },

        ".text-title": {
          "@apply text-xl font-semibold text-ink": {},
        },

        ".text-subtitle": {
          "@apply text-lg font-semibold text-gray-700": {},
        },

        ".text-body": {
          "@apply text-base text-gray-600": {},
        },

        ".text-caption": {
          "@apply text-sm text-gray-500": {},
        },

        // Responsive Container
        ".container-responsive": {
          "@apply w-full max-w-6xl mx-auto px-lg": {},
        },

        // Dividers
        ".divider": {
          "@apply border-t border-gray-200": {},
        },

        // State indicators
        ".state-active": {
          "@apply bg-success/10 text-success": {},
        },

        ".state-inactive": {
          "@apply bg-gray-100 text-gray-600": {},
        },

        ".state-pending": {
          "@apply bg-warning/10 text-warning": {},
        },

        ".state-error": {
          "@apply bg-danger/10 text-danger": {},
        },
      });
    },
  ],
}


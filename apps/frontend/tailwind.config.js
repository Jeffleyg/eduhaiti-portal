/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#002147",
          red: "#d21034",
          sky: "#00a8e8",
        },
        ink: "#0b1220",
        sand: "#f4f1ea",
        mist: "#f9fbff",
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        display: ["Fraunces", "serif"],
      },
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
      },
      animation: {
        "float-slow": "floatSlow 8s ease-in-out infinite",
        rise: "rise 0.8s ease forwards",
        shimmer: "shimmer 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}


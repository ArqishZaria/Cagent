/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070A11",
          900: "#0A0E17", // app background
          800: "#0F1420",
          700: "#131A2B", // raised surface
          600: "#182136", // higher surface (cards, modals)
          500: "#232D42", // borders / hairlines
          400: "#3A4661",
          300: "#5B6685",
          200: "#8891A6", // muted text
          100: "#C4CADA",
          50: "#EDEFF5", // primary text
        },
        signal: {
          DEFAULT: "#5B6EF5", // indigo — primary actions, links, active nav
          bright: "#7C8CFF",
          dim: "#3D4BB8",
        },
        amber: {
          DEFAULT: "#F2A93B", // money / urgent CTAs
          bright: "#FFC367",
          dim: "#B9821F",
        },
        live: {
          DEFAULT: "#33D6A6", // active call / lead won / success
          dim: "#1F9E7A",
        },
        alert: {
          DEFAULT: "#F0554C", // overdue / do-not-contact / hangup
          dim: "#B23A33",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        // Layered "3D" elevation — soft ambient + tight contact shadow.
        raised: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -8px rgba(0,0,0,0.55), 0 2px 6px -2px rgba(0,0,0,0.5)",
        "raised-lg": "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 20px 48px -12px rgba(0,0,0,0.6), 0 4px 12px -4px rgba(0,0,0,0.5)",
        pressed: "0 1px 2px 0 rgba(0,0,0,0.6) inset, 0 -1px 0 0 rgba(255,255,255,0.03) inset",
        key: "0 1px 0 rgba(255,255,255,0.06) inset, 0 3px 0 0 #0A0E17, 0 6px 12px -2px rgba(0,0,0,0.5)",
        "key-active": "0 1px 2px rgba(0,0,0,0.5) inset",
        glow: "0 0 0 1px rgba(91,110,245,0.4), 0 0 32px -4px rgba(91,110,245,0.5)",
      },
      keyframes: {
        "signal-bar": {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "signal-bar": "signal-bar 1s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-up": "fade-up 0.35s ease-out",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
//
// Design system — "The Ledger"
// A light, business-professional palette built around a deep forest-teal
// (trust, primary actions), a brass/gold accent (money, deal value — this
// product bills real invoices), and warm paper neutrals instead of stark
// white/gray. Deliberately not "SaaS indigo": the old palette leaned on a
// generic blue; this one reads more like a well-run finance/ops tool.
//
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Warm paper neutrals — page background, surfaces, hairlines.
        paper: {
          0: "#FFFFFF",
          50: "#FBFAF7", // page background
          100: "#F3F1E9", // sunken fill (input bg, table stripe)
          200: "#E7E3D6", // hairline borders
          300: "#D6D0BE", // stronger borders
        },
        // Text — warm near-black down to faint hint text.
        ink: {
          900: "#1C1A16", // headings
          800: "#2B2823",
          700: "#3F3B33", // body text
          600: "#565149",
          500: "#726C60", // muted / secondary
          400: "#928C7C",
          300: "#AFA994",
          200: "#CDC7B4",
          100: "#E7E3D6",
        },
        // Brand — deep forest teal. Primary actions, links, active nav.
        signal: {
          DEFAULT: "#1F5F4D",
          bright: "#2C7C67",
          dim: "#153F33",
        },
        // Brass / gold — money, deal value, featured pricing, purchase CTAs.
        amber: {
          DEFAULT: "#A2712B",
          bright: "#C08F3E",
          dim: "#79521E",
        },
        // Success / live-call / won-deal green — distinct from brand teal.
        live: {
          DEFAULT: "#3F7D4F",
          dim: "#2C5B39",
        },
        // Danger — overdue, do-not-contact, hangup.
        alert: {
          DEFAULT: "#A23A2E",
          dim: "#772A21",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "ui-serif", "Georgia", "serif"],
        body: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(28,26,22,0.05), 0 1px 1px 0 rgba(28,26,22,0.03)",
        raised: "0 1px 2px 0 rgba(28,26,22,0.05), 0 1px 1px 0 rgba(28,26,22,0.03)",
        "raised-lg": "0 24px 48px -20px rgba(28,26,22,0.20), 0 6px 16px -6px rgba(28,26,22,0.10)",
        pressed: "inset 0 1px 2px 0 rgba(28,26,22,0.14)",
        key: "0 1px 0 0 rgba(255,255,255,0.7) inset, 0 2px 0 0 #E7E3D6, 0 6px 12px -4px rgba(28,26,22,0.16)",
        "key-active": "inset 0 1px 3px rgba(28,26,22,0.18)",
        glow: "0 0 0 1px rgba(31,95,77,0.35), 0 0 0 5px rgba(31,95,77,0.08)",
        focus: "0 0 0 3px rgba(31,95,77,0.16)",
      },
      keyframes: {
        "signal-bar": {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "ledger-in": {
          "0%": { opacity: "0", transform: "translateX(-6px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "signal-bar": "signal-bar 1s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-up": "fade-up 0.4s ease-out",
        "ledger-in": "ledger-in 0.35s ease-out backwards",
      },
    },
  },
  plugins: [],
};

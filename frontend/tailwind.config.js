/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // ---- APP (post-login) — Stripe/Apollo clean dashboard ----
        paper: {
          0: "#FFFFFF",
          50: "#F7F8FA",
          100: "#F0F2F5",
          200: "#E4E7EC",
          300: "#CBD2DC",
        },
        ink: {
          900: "#101828",
          800: "#1D2939",
          700: "#344054",
          600: "#475467",
          500: "#667085",
          400: "#98A2B3",
          300: "#D0D5DD",
          200: "#E4E7EC",
          100: "#F0F2F5",
        },
        signal: { DEFAULT: "#4F46E5", bright: "#6366F1", dim: "#4338CA" }, // primary indigo
        amber:  { DEFAULT: "#F79009", bright: "#FDB022", dim: "#B54708" }, // secondary / money
        live:   { DEFAULT: "#12B76A", dim: "#027A48" },                   // success
        alert:  { DEFAULT: "#F04438", dim: "#B42318" },                   // danger

        // ---- MARKETING (logged out) — close.com-style ----
        mkt: {
          ink: "#0A0A0B",        // page background — the ONLY background, everywhere
          panel: "#131316",      // cards sit slightly lighter than the page
          panelHover: "#1B1B1F",
          line: "#232326",       // hairline borders on dark
          muted: "#9A9AA3",      // body text on dark
          green: "#00D964",
          greenDim: "#00A84E",
          yellow: "#FFC53D",
        },
      },
      fontFamily: {
        display: ["'Sora'", "system-ui", "sans-serif"],   // marketing headlines
        voice: ["'Sora'", "system-ui", "sans-serif"],
        body: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"], // app + marketing body
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(16,24,40,0.06)",
        raised: "0 1px 3px 0 rgba(16,24,40,0.10), 0 1px 2px -1px rgba(16,24,40,0.06)",
        "raised-lg": "0 20px 24px -4px rgba(16,24,40,0.08), 0 8px 8px -4px rgba(16,24,40,0.03)",
        pressed: "inset 0 1px 2px 0 rgba(16,24,40,0.12)",
        key: "0 1px 0 0 rgba(255,255,255,0.7) inset, 0 2px 0 0 #E4E7EC, 0 6px 12px -4px rgba(16,24,40,0.12)",
        "key-active": "inset 0 1px 3px rgba(16,24,40,0.16)",
        glow: "0 0 0 4px rgba(79,70,229,0.12)",
        focus: "0 0 0 3px rgba(79,70,229,0.18)",
      },
      keyframes: {
        "signal-bar": { "0%,100%": { transform: "scaleY(0.3)" }, "50%": { transform: "scaleY(1)" } },
        "pulse-ring": { "0%": { transform: "scale(0.9)", opacity: "0.7" }, "100%": { transform: "scale(1.6)", opacity: "0" } },
        "fade-up": { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "ledger-in": { "0%": { opacity: "0", transform: "translateX(-6px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
        "drift-a": { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(40px,-30px) scale(1.08)" } },
        "drift-b": { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(-35px,30px) scale(0.94)" } },
        "drift-c": { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(20px,35px) scale(1.05)" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        "word-in": { "0%": { opacity: "0", transform: "translateY(100%)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "word-out": { "0%": { opacity: "1", transform: "translateY(0)" }, "100%": { opacity: "0", transform: "translateY(-100%)" } },
        "count-pop": { "0%": { opacity: "0", transform: "scale(0.9)" }, "100%": { opacity: "1", transform: "scale(1)" } },
      },
      animation: {
        "signal-bar": "signal-bar 1s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-up": "fade-up 0.5s ease-out",
        "ledger-in": "ledger-in 0.35s ease-out backwards",
        "drift-a": "drift-a 16s ease-in-out infinite",
        "drift-b": "drift-b 19s ease-in-out infinite",
        "drift-c": "drift-c 22s ease-in-out infinite",
        marquee: "marquee 28s linear infinite",
        "word-in": "word-in 0.45s cubic-bezier(.2,.9,.3,1)",
        "word-out": "word-out 0.35s ease-in",
        "count-pop": "count-pop 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
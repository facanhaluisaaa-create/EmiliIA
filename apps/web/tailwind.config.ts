import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#1D2924", 900: "#15201B", 800: "#1D2924", 700: "#2A3A33", 600: "#3A4D44" },
        sage: { DEFAULT: "#A9B8A3", 100: "#EEF2EC", 200: "#DCE3D8", 300: "#C7D2C2", 400: "#A9B8A3", 500: "#8FA088" },
        cream: "#F5F5F0",
        ink: { DEFAULT: "#1D2924", muted: "#65776C", faint: "#8E9B93" },
        line: "#E3E6E0",
        status: {
          good: "#3F7D5A",
          warn: "#B8862B",
          bad: "#B04A3A",
          info: "#4C6F8F",
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(29, 41, 36, 0.04), 0 4px 16px rgba(29, 41, 36, 0.05)",
        float: "0 12px 40px rgba(29, 41, 36, 0.14)",
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem" },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fade: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        sheet: { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        dialog: { "0%": { opacity: "0", transform: "translate(-50%, calc(-50% + 8px))" }, "100%": { opacity: "1", transform: "translate(-50%, -50%)" } },
      },
      animation: {
        rise: "rise 0.35s ease-out both",
        fade: "fade 0.25s ease-out both",
        sheet: "sheet 0.3s ease-out both",
        dialog: "dialog 0.3s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;

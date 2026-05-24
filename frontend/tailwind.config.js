/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dizajno: {
          bg: "#fafafa",
          surface: "#ffffff",
          elevated: "#f4f4f5",
          "border-subtle": "#f4f4f5",
          border: "#e4e4e7",
          "border-strong": "#d4d4d8",
          muted: "#71717a",
          "muted-subtle": "#a1a1aa",
          text: "#18181b",
          "text-subtle": "#3f3f46",
          accent: "#5e63d4",
          "accent-hover": "#4b51c4",
          "accent-soft": "#eef0ff",
          "accent-ink": "#3b3f9b",
          success: "#15803d",
          "success-soft": "#f0fdf4",
          warning: "#a16207",
          "warning-soft": "#fefce8",
          danger: "#b91c1c",
          "danger-soft": "#fef2f2",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        "card-sm":
          "0 1px 0 0 rgba(24, 24, 27, 0.04), 0 1px 2px 0 rgba(24, 24, 27, 0.04)",
        card:
          "0 1px 0 0 rgba(24, 24, 27, 0.04), 0 2px 6px -1px rgba(24, 24, 27, 0.06)",
        "card-lg":
          "0 1px 0 0 rgba(24, 24, 27, 0.04), 0 12px 24px -8px rgba(24, 24, 27, 0.08), 0 4px 8px -2px rgba(24, 24, 27, 0.04)",
        ring: "0 0 0 1px rgba(94, 99, 212, 0.5), 0 0 0 4px rgba(94, 99, 212, 0.12)",
      },
      letterSpacing: {
        "label": "0.08em",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "scale-in": "scaleIn 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slideUp 220ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

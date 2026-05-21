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
          bg: "#f8f8fa",
          surface: "#ffffff",
          elevated: "#f0f0f5",
          border: "#d8d8e3",
          muted: "#8888a0",
          text: "#1a1a2e",
          accent: "#6366f1",
          "accent-hover": "#4f46e5",
          success: "#16a34a",
          warning: "#ca8a04",
          danger: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

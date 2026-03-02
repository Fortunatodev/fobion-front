import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./contexts/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0A",
        surface:    "#111111",
        "surface-2": "#161616",
        border:     "#1F1F1F",
        "border-2": "#2F2F2F",
        muted:      "#A1A1AA",
        primary:    "#0066FF",
        success:    "#10B981",
        warning:    "#F59E0B",
        danger:     "#EF4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}

export default config
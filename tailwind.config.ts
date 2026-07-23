import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a5f",
        },
        sidebar: "#1e3a5f",
        success: "#10b981",
        danger:  "#ef4444",
        warning: "#f59e0b",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-noto-sans-thai)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

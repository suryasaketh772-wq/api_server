import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(220, 25%, 7%)",
        foreground: "hsl(0, 0%, 95%)",
        card: {
          DEFAULT: "hsla(220, 20%, 12%, 0.65)",
          foreground: "hsl(0, 0%, 95%)",
        },
        gold: {
          primary: "hsl(45, 60%, 55%)",
          dark: "hsl(38, 70%, 45%)",
          light: "hsl(45, 75%, 65%)",
        },
        muted: "hsl(215, 12%, 60%)",
        border: "hsla(0, 0%, 100%, 0.06)",
        green: {
          accent: "hsl(140, 80%, 48%)",
        },
        red: {
          accent: "hsl(355, 80%, 55%)",
        }
      },
      backdropBlur: {
        glass: "16px",
      },
      animation: {
        "status-pulse": "statusPulse 2s infinite ease-in-out",
        "status-blink": "statusBlink 0.8s infinite alternate",
        "pulse-fast": "pulseFast 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards",
      },
      keyframes: {
        statusPulse: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.2)", opacity: "0.6" },
        },
        statusBlink: {
          from: { opacity: "1" },
          to: { opacity: "0.3" },
        },
        pulseFast: {
          "0%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        }
      }
    },
  },
  plugins: [],
};

export default config;

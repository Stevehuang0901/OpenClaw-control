import type { Config } from "tailwindcss";

export default {
  content: [
    "./apps/web/index.html",
    "./apps/web/src/**/*.{ts,tsx}",
    "./packages/shared/src/**/*.ts"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#f5e6bf",
        paper: "#16121f",
        brass: "#e3a05f",
        teal: "#58b2a9",
        mint: "#94d67f",
        coral: "#ea7a72",
        slate: "#778094",
        void: "#09070d",
        smoke: "#21192c"
      },
      boxShadow: {
        pixel: "0 0 0 2px #f5e6bf, 6px 6px 0 0 rgba(0, 0, 0, 0.48)",
        insetPixel: "inset 0 0 0 2px #f5e6bf"
      },
      backgroundImage: {
        plaid:
          "linear-gradient(90deg, rgba(255,255,255,0.08) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.06) 50%, transparent 50%)"
      }
    }
  },
  plugins: []
} satisfies Config;

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
        ink: "#20142f",
        paper: "#f7ecd8",
        brass: "#d98b42",
        teal: "#257179",
        mint: "#9ed1b5",
        coral: "#da6a58",
        slate: "#40505f"
      },
      boxShadow: {
        pixel: "0 0 0 2px #20142f, 6px 6px 0 0 rgba(32, 20, 47, 0.22)",
        insetPixel: "inset 0 0 0 2px #20142f"
      },
      backgroundImage: {
        plaid:
          "linear-gradient(90deg, rgba(255,255,255,0.08) 50%, transparent 50%), linear-gradient(rgba(255,255,255,0.06) 50%, transparent 50%)"
      }
    }
  },
  plugins: []
} satisfies Config;

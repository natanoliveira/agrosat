import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { solo: "#f4efe4", tinta: "#1f2a1c", folha: "#3f6b2a", barro: "#8a5a2b" },
      fontFamily: { serif: ["Georgia", "Cambria", "serif"] },
    },
  },
  plugins: [],
};
export default config;

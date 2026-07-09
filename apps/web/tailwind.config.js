/** @type {import("tailwindcss").Config} */
export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
      },
      colors: {
        parchment: "var(--color-parchment)",
        surface: "var(--color-surface)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        clay: "var(--color-clay)",
        "clay-soft": "var(--color-clay-soft)",
        sage: "var(--color-sage)",
        "sage-soft": "var(--color-sage-soft)",
        line: "var(--color-line)",
        danger: "var(--color-danger)",
      },
    },
  },
  plugins: [],
};

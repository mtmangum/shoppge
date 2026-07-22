import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // UT Austin brand colors
        'ut-orange':  '#BF5700',
        'ut-charcoal': '#333F48',
      },
    },
  },
  plugins: [],
}

export default config

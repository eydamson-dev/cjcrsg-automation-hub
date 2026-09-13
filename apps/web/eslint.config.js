import { defineConfig } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    ignores: ['.next/**', 'next-env.d.ts', 'components/ui/**'],
  },
  {
    rules: {
      // Asset streams are served by the API proxy; next/image optimization does not apply.
      '@next/next/no-img-element': 'off',
    },
  },
])
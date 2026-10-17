import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Matikan aturan format yang bentrok dengan Prettier (format diurus Prettier).
  prettier,
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Hasil generate `npm run gen:api`.
    'src/types/api.d.ts',
    // Hasil build: service worker (scripts/build-sw.mjs) & laporan Playwright.
    'public/sw.js',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

export default eslintConfig;

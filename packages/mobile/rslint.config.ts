import { defineConfig, js, ts } from '@rslint/core'

export default defineConfig([
  {
    ignores: ['node_modules/**', 'dist/**', 'ios/**', 'android/**'],
  },
  js.configs.recommended,
  {
    ...ts.configs.recommended,
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
  },
])

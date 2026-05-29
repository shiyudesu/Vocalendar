import { defineConfig, js, reactHooksPlugin, reactPlugin, ts } from '@rslint/core'

export default defineConfig([
  // Rslint only owns correctness rules and TypeScript type-checking here.
  // Keep formatting, import sorting, and Tailwind class ordering in Oxfmt.
  {
    ignores: ['node_modules/**', '.output/**', 'dist/**', 'dist-ssr/**'],
  },
  js.configs.recommended,
  {
    ...ts.configs.recommended,
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
      },
    },
  },
  reactPlugin.configs.recommended,
  reactHooksPlugin.configs.recommended,
  {
    files: ['**/*.tsx'],
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
])

import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// Regras compartilhadas entre JS e TS. Mantidas idênticas às da configuração anterior à F0-15
// para que a linha de base de problemas continue comparável nos arquivos ainda não migrados.
const regrasComuns = {
  'react-hooks/set-state-in-effect': 'off',
  'react-hooks/exhaustive-deps': 'off',
  'react-hooks/purity': 'off',
  'no-useless-assignment': 'off'
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: regrasComuns
  },
  // F0-15: sem este bloco, todo arquivo migrado para .ts/.tsx sairia do lint em silêncio —
  // a cobertura cairia a cada etapa da migração sem que nenhuma métrica acusasse.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...regrasComuns,
      // no-unused-vars do core não entende sintaxe de tipos; a versão do typescript-eslint sim.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
])

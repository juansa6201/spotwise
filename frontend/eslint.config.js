import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Permite constantes en MAYÚSCULAS "sin usar" (mapas exportados, etc.).
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Patrón intencional: cerrar el estado de carga dentro del efecto cuando
      // no hay nada asíncrono que esperar (sin token / sin sesión).
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

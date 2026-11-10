import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfig from '@electron-toolkit/eslint-config'
import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from '@vue/eslint-config-prettier'

export default tseslint.config(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  eslintConfig,
  tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    },
    rules: {
      // ESLint 9 ships this rule in its recommended set, but it can't see
      // <script setup> bindings that are only referenced from the <template>.
      'no-useless-assignment': 'off'
    }
  },
  eslintConfigPrettier,
  {
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-template-shadow': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // The codebase doesn't annotate return types, so keep the rule off.
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
)

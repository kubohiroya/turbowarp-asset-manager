import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['dist/**', 'node_modules/**']},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: {
        Scratch: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^(_|args$)',
          varsIgnorePattern: '^(VerifiedRemoteCacheWarning|requestResult)$'
        }
      ],
      'no-control-regex': 'off',
      'no-var': 'off',
      'prefer-const': 'off'
    }
  }
);

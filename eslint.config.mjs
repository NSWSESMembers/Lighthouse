import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'build/**'] },
  { files: ['**/*.js', '**/*.ts'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 0,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Added to the recommended sets after typescript-eslint 5 / eslint 8.
      // Off for now so the toolchain upgrade doesn't change what we enforce.
      '@typescript-eslint/no-unused-expressions': 0,
      'no-useless-assignment': 0,
    },
  },
);

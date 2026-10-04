import eslintConfigPrettier from 'eslint-config-prettier';

const typeScriptFiles = ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'];

export default [
  {
    files: typeScriptFiles,
    languageOptions: { parserOptions: { experimentalDecorators: true, emitDecoratorMetadata: true } },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true,
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  eslintConfigPrettier,
];

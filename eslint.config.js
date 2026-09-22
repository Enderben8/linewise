const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    ignores: [
      'dist/*',
      'dist-check/*',
      'dist-web/*',
      'android/*',
      'node_modules/*',
      'coverage/*',
      '.expo/*',
    ],
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
  {
    files: ['scripts/**/*.js', 'plugins/**/*.js', '*.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
];

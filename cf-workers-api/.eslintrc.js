module.exports = {
  root: true,
  env: {
    es2022: true,
    worker: true
  },
  extends: [
    '@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn'
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'migrations/'
  ]
};
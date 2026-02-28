const { defineConfig } = require('eslint/config');
const nativeConfig = require('eslint-config-universe/flat/native');
const typescriptAnalysisConfig = require('eslint-config-universe/flat/shared/typescript-analysis');

module.exports = defineConfig([
  {
    ignores: ['supabase/functions/**/*'],
  },
  ...nativeConfig,
  ...typescriptAnalysisConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: process.cwd(),
      },
    },
  },
  {
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
]);

import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const configDir = dirname(filename);
const require = createRequire(import.meta.url);
const nextConfigDir = dirname(require.resolve('eslint-config-next'));

const compat = new FlatCompat({
  baseDirectory: configDir,
  // Next 15 still ships a legacy config. Resolve its bundled plugins from the
  // package itself so ESLint's Node API and CLI behave identically under pnpm.
  resolvePluginsRelativeTo: nextConfigDir,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const asWarnings = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([ruleId, value]) => {
      if (value === 'off' || value === 0) return [ruleId, value];
      if (Array.isArray(value)) return [ruleId, ['warn', ...value.slice(1)]];
      return [ruleId, 'warn'];
    }),
  );

const intentionalHookDependencyAllowlist = [
  'components/recommend/recommend-override.tsx', // Local storage hydration intentionally runs only on mount.
  'app/(app)/quiz/municipality/*/page.tsx', // URL recommendation inputs intentionally trigger the one-shot auto-start.
];

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'public/**',
      'reports/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.specify/**',
      'eslint.config.mjs',
      'next-env.d.ts',
    ],
  },
  ...compat.extends(
    'eslint:recommended',
    'next/core-web-vitals',
    'next/typescript',
  ),
  {
    linterOptions: {
      // Exceptions belong in the reasoned, file-scoped allowlists below.
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
    plugins: {
      security,
      sonarjs,
    },
    settings: sonarjs.configs.recommended.settings,
    rules: {
      // Full inventories start as warnings. The ratchet makes new findings
      // blocking without incentivizing blanket suppressions for existing debt.
      ...asWarnings(sonarjs.configs.recommended.rules),
      ...asWarnings(security.configs.recommended.rules),

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],

      'max-lines-per-function': [
        'warn',
        { max: 60, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ['warn', 20],
      'max-depth': ['warn', 4],
      'max-params': ['error', 6],
      'max-nested-callbacks': ['error', 4],

      // Existing inventories are empty, so regression turns the build red.
      'sonarjs/assertions-in-tests': 'error',
      'sonarjs/no-ignored-exceptions': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: configDir,
      },
    },
    rules: {
      // These type-aware bug detectors have zero existing debt. A dropped await,
      // unsafe JSON boundary, or async callback misuse fails immediately.
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
    rules: {
      // Test suite callbacks are structurally long and nested; logical
      // complexity, type safety, and assertion checks remain enabled.
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-unsafe-regex': 'off',
    },
  },
  {
    files: intentionalHookDependencyAllowlist,
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];

import eslint from '@eslint/js';
import 'eslint-plugin-only-warn';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(eslint.configs.recommended, tseslint.configs.recommended, {
  languageOptions: { parserOptions: { tsconfigRootDir: __dirname } },
  ignores: ['dist'],
});

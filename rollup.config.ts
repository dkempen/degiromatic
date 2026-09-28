import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/main.ts',
  output: { file: 'dist/bundle/main.cjs', format: 'cjs', inlineDynamicImports: true },
  plugins: [json(), commonjs(), nodeResolve(), typescript(), terser()],
};

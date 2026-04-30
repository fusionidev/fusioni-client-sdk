import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';
import dts from 'rollup-plugin-dts';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

export default [
  // Library builds (CJS + ESM) – for npm / import
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
      }),
      postcss({
        extract: true,
        minimize: true,
      }),
    ],
    external: ['react', 'react-dom'],
  },
  // Script-tag build – IIFE (bundles React, injects CSS). File name kept as *.umd.js for CDN URLs.
  // UMD was avoided: its CommonJS branch runs when outer `exports`/`module` exist, leaving
  // globalThis.Fusioni as `{}` while the API is only on the bundler's exports object.
  {
    input: 'src/browser.tsx',
    output: {
      file: 'dist/fusioni-sdk.umd.js',
      format: 'iife',
      name: 'Fusioni',
      sourcemap: true,
      exports: 'default',
    },
    plugins: [
      replace({
        preventAssignment: true,
        __FUSIONI_SDK_VERSION__: JSON.stringify(packageJson.version),
        // React and other deps reference process.env.NODE_ENV; browsers have no `process`.
        'process.env.NODE_ENV': JSON.stringify('production'),
      }),
      resolve({
        browser: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
      }),
      postcss({
        inject: true,
        extract: false,
        minimize: true,
      }),
    ],
  },
  // Type declarations
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'esm' }],
    plugins: [dts()],
    external: [/\.css$/],
  },
];

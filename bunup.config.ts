import { defineConfig } from 'bunup';

export default defineConfig([
  {
    name: 'index',
    entry: './src/index.ts',
    outDir: './dist',
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    minify: false,
    sourcemap: true,
    target: 'node',
  },
  {
    name: 'errors',
    entry: './src/errors.ts',
    outDir: './dist',
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    minify: false,
    sourcemap: true,
    target: 'node',
  },
]);

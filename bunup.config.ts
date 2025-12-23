import { defineConfig } from 'bunup';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    errors: './src/common/errors/index.ts',
  },
  outDir: './dist',
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true,
  external: [],
  target: 'node',
});

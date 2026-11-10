/**
 * Path aliases (@domain/*, @shared/*, ...) for the compiled build.
 *
 * tsconfig.json maps them under `src` (TypeScript sources), so
 * `node -r tsconfig-paths/register dist/index.js` failed in production with
 * "Cannot find module '@shared/types/express'". Same aliases, resolved in `dist`.
 */
const path = require('path');
const tsConfigPaths = require('tsconfig-paths');
const { compilerOptions } = require('./tsconfig.json');

tsConfigPaths.register({
  baseUrl: path.join(__dirname, 'dist'),
  paths: compilerOptions.paths,
});

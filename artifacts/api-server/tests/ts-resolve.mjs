// Lets node's built-in TypeScript stripping run the server sources, whose imports omit the
// ".ts" extension (esbuild resolves those for the real build).
// Used as: node --experimental-strip-types --import ./tests/ts-resolve.mjs --test tests/*.test.mjs
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try {
      return await next(specifier, context);
    } catch (err) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[mc]?[jt]s$/.test(specifier)) {
        return next(specifier + '.ts', context);
      }
      throw err;
    }
  }
`));

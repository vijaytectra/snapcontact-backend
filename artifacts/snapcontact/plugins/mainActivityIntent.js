const IMPORT = 'import android.content.Intent';

/**
 * MainActivity is `singleTask`, so an image shared while SnapContact is already open is delivered
 * to onNewIntent. Without this override the activity keeps the launch intent and the shared image
 * is never read.
 *
 * Returns the Kotlin source with the override added. Throws if the activity has an unexpected shape,
 * so a prebuild never silently ships without the fix.
 */
function addOnNewIntent(source) {
  if (/override\s+fun\s+onNewIntent\s*\(/.test(source)) return source;

  const classLine = /class\s+MainActivity\s*:\s*ReactActivity\(\)\s*\{/;
  if (!classLine.test(source)) {
    throw new Error('SnapContact MainActivity has an unexpected shape; onNewIntent could not be added.');
  }

  let out = source;
  if (!out.includes(IMPORT)) {
    const packageLine = /^package\s+[^\n]+\n/m;
    if (!packageLine.test(out)) throw new Error('SnapContact MainActivity has no package line.');
    out = out.replace(packageLine, match => `${match}\n${IMPORT}\n`);
  }

  const override = [
    '',
    '  // A share that arrives while the app is open is delivered here (singleTask).',
    '  override fun onNewIntent(intent: Intent) {',
    '    super.onNewIntent(intent)',
    '    setIntent(intent)',
    '  }',
  ].join('\n');
  return out.replace(classLine, match => `${match}\n${override}`);
}

module.exports = { addOnNewIntent };

const fs = require('node:fs');
const path = require('node:path');

// Inventory deployment files once. Requests select an approved reader, never
// supply a path to fs. Symlinks and hidden files are not public assets.
function createStaticReader(root) {
  const files = new Map();
  if (fs.existsSync(root)) {
    const rootPath = fs.realpathSync(root);
    function inventory(directory, prefix = '') {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
        const file = path.join(directory, entry.name);
        const key = prefix + entry.name;
        if (entry.isDirectory()) inventory(file, key + '/');
        else if (entry.isFile()) files.set(key, () => {
          // Refuse assets replaced with symlinks after inventory, including
          // symlinked parent directories. Deployment files are otherwise read-only.
          if (fs.realpathSync(file) !== file) {
            throw Object.assign(new Error('Changed asset path'), { code: 'FORBIDDEN' });
          }
          const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
          try { return fs.readFileSync(fd); }
          finally { fs.closeSync(fd); }
        });
      }
    }
    inventory(rootPath);
  }
  return function readStaticFile(requestPath) {
    let decoded;
    try { decoded = decodeURIComponent(requestPath); }
    catch { throw Object.assign(new Error('Invalid path'), { code: 'FORBIDDEN' }); }
    if (decoded.includes('\0') || decoded.includes('\\') ||
        decoded.split('/').some(segment => segment === '..' || segment === '.')) {
      throw Object.assign(new Error('Invalid path'), { code: 'FORBIDDEN' });
    }
    const read = files.get(decoded.replace(/^\/+/, ''));
    if (!read) throw Object.assign(new Error('Not a public file'), { code: 'ENOENT' });
    return read();
  };
}

module.exports = { createStaticReader };

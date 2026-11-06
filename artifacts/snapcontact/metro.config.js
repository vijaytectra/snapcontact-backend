const { getDefaultConfig } = require('expo/metro-config');
const { writeBuildInfo } = require('./scripts/write-build-info');

// Stamp the build time before the app is bundled (see scripts/write-build-info.js).
writeBuildInfo(__dirname);

module.exports = getDefaultConfig(__dirname);

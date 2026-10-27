const fs = require('node:fs');
const path = require('node:path');
const {
  withInfoPlist, withEntitlementsPlist, withAndroidManifest, withXcodeProject,
  createRunOncePlugin,
} = require('expo/config-plugins');
const { ensureTargetDependency } = require('./xcodeTargetDependency');

const TARGET = 'SnapContactShare';

function withSnapCapture(config) {
  const bundleId = config.ios?.bundleIdentifier;
  if (!bundleId) throw new Error('SnapContact requires an iOS bundleIdentifier.');
  const appGroup = `group.${bundleId}.share`;
  config = withInfoPlist(config, mod => {
    mod.modResults.SnapContactAppGroup = appGroup;
    mod.modResults.LSApplicationQueriesSchemes = [
      ...new Set([...(mod.modResults.LSApplicationQueriesSchemes ?? []), 'whatsapp', 'tel']),
    ];
    return mod;
  });
  config = withEntitlementsPlist(config, mod => {
    mod.modResults['com.apple.security.application-groups'] = [
      ...new Set([...(mod.modResults['com.apple.security.application-groups'] ?? []), appGroup]),
    ];
    return mod;
  });
  config = withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    const application = manifest.application[0];
    application.$['android:allowBackup'] = 'false';

    const permissions = manifest['uses-permission'] ?? [];
    const neededPermissions = [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.POST_NOTIFICATIONS',
    ];
    for (const name of neededPermissions) {
      if (!permissions.some(p => p.$['android:name'] === name)) {
        permissions.push({ $: { 'android:name': name } });
      }
    }
    manifest['uses-permission'] = permissions;

    const main = application.activity.find(item => item.$['android:name'] === '.MainActivity');
    if (!main) throw new Error('SnapContact Android MainActivity was not found.');
    main.$['android:launchMode'] = 'singleTask';
    main['intent-filter'] = (main['intent-filter'] ?? []).filter(filter =>
      !filter.action?.some(a => a.$['android:name'] === 'android.intent.action.SEND'),
    );
    main['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [{ $: { 'android:mimeType': 'image/*' } }],
    });

    application.service = application.service ?? [];
    if (!application.service.some(s => s.$['android:name'] === 'com.snapcontact.capture.QuickCaptureService')) {
      application.service.push({
        $: {
          'android:name': 'com.snapcontact.capture.QuickCaptureService',
          'android:foregroundServiceType': 'mediaProjection',
          'android:exported': 'false',
        },
      });
    }

    application.activity = application.activity ?? [];
    if (!application.activity.some(a => a.$['android:name'] === 'com.snapcontact.capture.MediaProjectionConsentActivity')) {
      application.activity.push({
        $: {
          'android:name': 'com.snapcontact.capture.MediaProjectionConsentActivity',
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
          'android:exported': 'false',
        },
      });
    }

    return mod;
  });

  return withXcodeProject(config, mod => {
    const project = mod.modResults;
    const root = mod.modRequest.platformProjectRoot;
    const folder = path.join(root, TARGET);
    fs.mkdirSync(folder, { recursive: true });
    fs.copyFileSync(
      path.join(mod.modRequest.projectRoot, 'native', 'ios', 'ShareViewController.swift'),
      path.join(folder, 'ShareViewController.swift'),
    );
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>SnapContact</string>
<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
<key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
<key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
<key>CFBundlePackageType</key><string>XPC!</string>
<key>CFBundleShortVersionString</key><string>${config.version ?? '1.0.0'}</string>
<key>CFBundleVersion</key><string>${config.ios?.buildNumber ?? '1'}</string>
<key>SnapContactAppGroup</key><string>${appGroup}</string>
<key>NSExtension</key><dict>
<key>NSExtensionPointIdentifier</key><string>com.apple.share-services</string>
<key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
<key>NSExtensionAttributes</key><dict>
<key>NSExtensionActivationRule</key><dict>
<key>NSExtensionActivationSupportsImageWithMaxCount</key><integer>1</integer>
</dict></dict></dict></dict></plist>`;
    fs.writeFileSync(path.join(folder, `${TARGET}-Info.plist`), plist);
    fs.writeFileSync(path.join(folder, `${TARGET}.entitlements`), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>${appGroup}</string></array></dict></plist>`);

    const host = project.getFirstTarget();
    const existing = Object.entries(project.pbxNativeTargetSection()).find(([key, target]) =>
      !key.endsWith('_comment') && target.name?.replaceAll('"', '') === TARGET,
    );
    if (existing) {
      ensureTargetDependency(project, host.uuid, existing[0]);
      return mod; // Idempotent prebuild: do not duplicate targets or phases.
    }
    const target = project.addTarget(TARGET, 'app_extension', TARGET, `${bundleId}.share`);
    ensureTargetDependency(project, host.uuid, target.uuid);
    // Add an actual Sources phase and compile file to the extension target, not the host.
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    const group = project.addPbxGroup([], TARGET, TARGET);
    project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
    project.addSourceFile('ShareViewController.swift', { target: target.uuid }, group.uuid);
    project.addFile(`${TARGET}-Info.plist`, group.uuid);
    project.addFile(`${TARGET}.entitlements`, group.uuid);
    const section = project.pbxXCBuildConfigurationSection();
    const configs = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
    for (const { value } of configs.buildConfigurations) {
      const settings = section[value].buildSettings;
      Object.assign(settings, {
        SWIFT_VERSION: '5.9',
        IPHONEOS_DEPLOYMENT_TARGET: '16.0',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        CODE_SIGN_ENTITLEMENTS: `"${TARGET}/${TARGET}.entitlements"`,
        CODE_SIGN_STYLE: 'Automatic',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        GENERATE_INFOPLIST_FILE: 'NO',
        CLANG_ENABLE_MODULES: 'YES',
        CURRENT_PROJECT_VERSION: config.ios?.buildNumber ?? '1',
        MARKETING_VERSION: config.version ?? '1.0.0',
      });
      if (config.ios?.appleTeamId) settings.DEVELOPMENT_TEAM = config.ios.appleTeamId;
    }
    // xcode's addTarget helper leaves optional fields undefined; omit them
    // rather than serializing the literal "undefined" into project.pbxproj.
    function clean(value) {
      if (!value || typeof value !== 'object') return;
      for (const key of Object.keys(value)) {
        if (value[key] === undefined) delete value[key];
        else clean(value[key]);
      }
    }
    clean(project.hash.project.objects);
    return mod;
  });
}
module.exports = createRunOncePlugin(withSnapCapture, 'with-snap-capture', '1.0.0');

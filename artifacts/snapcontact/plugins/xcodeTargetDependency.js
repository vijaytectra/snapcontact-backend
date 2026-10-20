function ensureTargetDependency(project, hostUuid, dependencyUuid) {
  const objects = project.hash.project.objects;
  // xcode's addTargetDependency silently skips creating links when these empty
  // sections are absent from a new Expo project.
  objects.PBXTargetDependency ??= {};
  objects.PBXContainerItemProxy ??= {};

  const host = project.pbxNativeTargetSection()[hostUuid];
  if (!host.dependencies?.some(dependency => dependency.value === dependencyUuid)) {
    project.addTargetDependency(hostUuid, [dependencyUuid]);
  }
}

module.exports = { ensureTargetDependency };

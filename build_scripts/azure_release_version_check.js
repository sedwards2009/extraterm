/*
 * Pass the Azure Pipelines `Build.SourceBranch` variable and if this build
 * is a tag, then this will check that the tag name matches the version in
 * the root `package.json`. If it doesn't then this script returns non-zero
 * back.
 */
const fs = require('fs');

const log = console.log.bind(console);

function checkReleaseVersion() {
  const gitRef = process.argv[2];
  if ( ! gitRef.startsWith("refs/tags/")) {
    log(`$Build.SourceBranch is '${gitRef}' and is not a tag build. All clear!`);
    return 0;
  }

  const tagVName = gitRef.slice("refs/tags/".length);
  if ( ! tagVName.startsWith("v")) {
    log(`Error: Tag name '${tagVName}' doesn't start with a 'v'.`);
    return 1;
  }
  const tagName = tagVName.slice(1);

  log(`Checking that '${tagName}' matches the version number in 'package.json'...`);

  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);
  packageVersion = packageData.version;
  if (packageVersion !== tagName) {
    log(`Error: Tag name '${tagName}' doesn't match the version '${packageVersion}' in package.json.`);
    return 1;
  }
  log("It matches. All clear!");
  return 0;
}

process.exit(checkReleaseVersion());

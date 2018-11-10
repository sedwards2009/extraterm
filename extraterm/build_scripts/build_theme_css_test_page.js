require('shelljs/global');
const path = require('path');

const packageRootPath = "" + pwd();

echo(packageRootPath);

const buildPath = path.join(packageRootPath, "build_css_test");

if (test('-d', buildPath)) {
  rm('-rf', buildPath);
}

exec(`node src/theme/ThemeManagerUtility.js -a -o ${buildPath}`);

const testPageHtmlPath = path.join(packageRootPath, "src/test/gui/gui_general_test_page.html");
for (const dir of ls(buildPath)) {
  cp(testPageHtmlPath, path.join(buildPath, dir));
}

const fs = require("fs");

const fileContents = fs.readFileSync("/home/sbe/fontawesome-free-5.15.3-web/metadata/icons.json", {encoding: "utf8"});
const iconData = JSON.parse(fileContents);
for (const key in iconData) {
  const item = iconData[key];
  console.log(`  "fa-${key}": {string: "\\u{${item.unicode}}", "set": "${item.free[0]}"},`);
}

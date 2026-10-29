# CircleCI's timing split reads `file` on <testcase>, and the reporter only
# writes it on <testsuite>
# shellcheck disable=SC2016 # ${suiteFile} is a JavaScript template literal
node -e '
const fs = require("fs");
const path = require("path");
const results = "junit/test-results.xml";
let suiteFile;
const xml = fs
  .readFileSync(results, "utf8")
  .replace(/<testsuite [^>]*>|<testcase /g, (tag) => {
    if (tag.startsWith("<testsuite ")) {
      const file = tag.match(/ file="([^"]*)"/)?.[1];
      suiteFile = file && path.relative(process.cwd(), file);
      return tag;
    }
    return suiteFile ? `<testcase file="${suiteFile}" ` : tag;
  });
fs.writeFileSync(results, xml);
'

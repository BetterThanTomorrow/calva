# CircleCI splits the e2e suites by the test case times in the JUnit file,
# which leave out the before/after hooks where suites jack in. Each suite
# file gets a test case carrying the rest of its wall time.
# shellcheck disable=SC2016 # ${...} are JavaScript template literals
node -e '
const fs = require("fs");
const path = process.argv[1];
const xml = fs.readFileSync(path, "utf8");
const attr = (s, name) => (s.match(new RegExp(` ${name}="([^"]*)"`)) || [])[1];
const suiteRe = /<testsuite( [^>]*)>([\s\S]*?)<\/testsuite>/g;
const files = new Map();
for (const [, attrs, body] of xml.matchAll(suiteRe)) {
  const file = attr(attrs, "file");
  if (!file) continue;
  // The reporter ends a nested suite when its parent ends, so the latest end is the file end
  const start = Date.parse(attr(attrs, "timestamp"));
  const end = start + 1000 * Number(attr(attrs, "time"));
  const cases = [...body.matchAll(/<testcase [^>]*?time="([^"]*)"/g)]
    .reduce((sum, [, t]) => sum + Number(t), 0);
  const f = files.get(file) ?? { start, end, cases: 0, firstSuite: attrs };
  files.set(file, { ...f, start: Math.min(f.start, start), end: Math.max(f.end, end), cases: f.cases + cases });
}
const hookCases = new Map();
for (const [file, { start, end, cases, firstSuite }] of files) {
  const hooks = (end - start) / 1000 - cases;
  if (hooks >= 0.5) {
    console.log(file.split("/").pop(), hooks.toFixed(1), "s of hooks");
    hookCases.set(firstSuite, `<testcase name="${attr(firstSuite, "name")} before and after hooks" time="${hooks.toFixed(4)}" classname="before and after hooks">\n    </testcase>\n  `);
  }
}
const out = xml
  .replace(suiteRe, (suite, attrs) => !hookCases.has(attrs) ? suite : suite
    .replace(/ tests="(\d+)"/, (_, n) => ` tests="${Number(n) + 1}"`)
    .replace(/<\/testsuite>$/, `${hookCases.get(attrs)}</testsuite>`))
  .replace(/(<testsuites [^>]*? tests=")(\d+)"/, (_, pre, n) => `${pre}${Number(n) + hookCases.size}"`);
fs.writeFileSync(path, out);
' "${1:-junit/test-results.xml}" || echo "Hook times not added"

import * as path from 'path';
import Mocha = require('mocha');

export async function run(): Promise<void> {
  const { glob } = await import('glob');
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    timeout: 160000,
    reporter: 'mocha-multi-reporters',
    reporterOptions: {
      reporterEnabled: 'mocha-junit-reporter, spec',
      mochaJunitReporterReporterOptions: {
        mochaFile: 'junit/test-results.xml',
      },
    },
  });

  const testsRoot = path.resolve(__dirname, '..');
  const filtersRaw = process.env.CALVA_INTEGRATION_SUITE_FILTER ?? '';
  const filters = filtersRaw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const files = await glob('**/**-test.js', { cwd: testsRoot });
  const filteredFiles =
    filters.length === 0
      ? files
      : files.filter((filePath) =>
          filters.some((filterToken) => filePath.toLowerCase().includes(filterToken.toLowerCase()))
        );

  filteredFiles.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  console.log('Integration suites selected:', filteredFiles);

  return new Promise((resolve, reject) => {
    try {
      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

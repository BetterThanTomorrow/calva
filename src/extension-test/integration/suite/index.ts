import * as path from 'path';
import * as Mocha from 'mocha';

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
  const files = await glob('**/**-test.js', { cwd: testsRoot });

  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  console.log(files);

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

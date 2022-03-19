import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
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

  return new Promise((c, e) => {
    glob('**/**-test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return e(err);
      }
      // Add files to the test suite
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

      console.log(files);
      try {
        // Run the mocha test
        mocha.run((failures) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        e(err);
      }
    });
  });
}

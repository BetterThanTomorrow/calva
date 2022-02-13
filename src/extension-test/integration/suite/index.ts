import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

// export function run2(testsRoot: string, cb: (error: any, failures?: number) => void): void {
// 	// Create the mocha test
//   const mocha = new Mocha({
//     ui: 'tdd',
//     reporter: 'mocha-multi-reporters',
//     reporterOptions: {
//       "reporterEnabled": "mocha-junit-reporter, spec",
//       "mochaJunitReporterReporterOptions": {
//         "mochaFile": "junit/test-results.xml"
//       }
//     },
//     timeout: 60000
//   });
//   console.log(testsRoot);

// 	glob('**/**-test.js', { cwd: testsRoot }, (err, files) => {
// 		if (err) {
// 			return cb(err);
// 		}
//     console.log(files);

// 		// Add files to the test suite
// 		files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

// 		try {
// 			// Run the mocha test
// 			mocha.run(failures => {
// 				cb(null, failures);
// 			});
// 		} catch (err) {
// 			console.error(err);
// 			cb(err);
// 		}
// 	});
// }

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        timeout: 560000,
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

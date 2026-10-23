import * as path from 'path';
import * as cp from 'child_process';
import * as globLib from 'glob';

import * as testElectron from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, ...['..', '..', '..']);

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, 'suite', 'index');
    const testWorkspace = path.resolve(__dirname, '../../../test-fixtures');
    const args = process.argv.slice(2);
    // Without --local the suite runs in a container, see run-containerized.sh
    const runLocally = args.includes('--local');
    const testFilters = args.filter((arg) => arg !== '--local' && arg.trim().length > 0);

    // Detect potentially incorrect usage patterns
    const hasSpacesInFilter = testFilters.some((arg) => arg.includes(' '));
    const looksLikeTestName = testFilters.some(
      (arg) => arg.charAt(0).toUpperCase() === arg.charAt(0) && arg.includes(' ')
    );

    if (hasSpacesInFilter || looksLikeTestName) {
      console.error('\n⚠️  Filter pattern looks incorrect\n');
      console.error('Usage: npm run e2e-test [-- [--local] filter]\n');
      console.error('The filter matches against test FILE NAMES, not test case names.\n');
      console.error('Examples:');
      console.error('  npm run e2e-test                      # Run all tests');
      console.error('  npm run e2e-test -- jack-in           # Run files matching "jack-in"');
      console.error('  npm run e2e-test -- cljc              # Run files matching "cljc"');
      console.error('  npm run e2e-test -- session           # Run files matching "session"');
      console.error(
        '  npm run e2e-test -- --local jack-in   # Run on this machine, not in a container\n'
      );
      console.error('Available test files are in src/extension-test/e2e/suite/\n');
      process.exit(1);
    }

    // Check if filter matches any files before launching VS Code
    if (testFilters.length > 0) {
      const testsRoot = path.resolve(__dirname, 'suite');
      const allFiles = await globLib.glob('**/**-test.js', { cwd: testsRoot });
      const matchingFiles = allFiles.filter((filePath) =>
        testFilters.some((filterToken) =>
          filePath.toLowerCase().includes(filterToken.toLowerCase())
        )
      );

      if (matchingFiles.length === 0) {
        console.error(`\n⚠️  No test files match filter: "${testFilters.join(', ')}"\n`);
        console.error('Available test files:');
        allFiles.forEach((file) => console.error(`  - ${file.replace(/-test\.js$/, '')}`));
        console.error('\nUsage: npm run e2e-test [-- [--local] filter]\n');
        console.error('Examples:');
        console.error('  npm run e2e-test -- jack-in');
        console.error('  npm run e2e-test -- session\n');
        process.exit(1);
      }

      console.log(
        `\nRunning ${matchingFiles.length} test file(s) matching: ${testFilters.join(', ')}\n`
      );
    }

    if (!runLocally) {
      const containerRunner = path.resolve(
        extensionDevelopmentPath,
        'src/extension-test/e2e/run-containerized.sh'
      );
      const { status } = cp.spawnSync(containerRunner, testFilters, { stdio: 'inherit' });
      process.exit(status ?? 1);
    }

    const extensionTestsEnv =
      testFilters.length > 0
        ? {
            CALVA_E2E_SUITE_FILTER: testFilters.join(','),
          }
        : undefined;

    const launchArgs = [testWorkspace, '--disable-workspace-trust'];

    // Download VS Code and install Joyride extension (needed for WebSocket tests)
    const vscodeExecutablePath = await testElectron.downloadAndUnzipVSCode('insiders');
    const [cliPath, ...cliArgs] =
      testElectron.resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
    cp.spawnSync(
      cliPath,
      [...cliArgs, '--install-extension', 'betterthantomorrow.joyride', '--force', ...launchArgs],
      { encoding: 'utf-8', stdio: 'inherit' }
    );

    // Run the e2e tests using the downloaded VS Code instance
    await testElectron.runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs,
      extensionTestsEnv,
    });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

void main();

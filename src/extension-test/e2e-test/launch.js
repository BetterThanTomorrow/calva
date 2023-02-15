const cp = require('child_process');
const path = require('path');
const process = require('process');
const os = require('os');
const fs = require('fs');
const {
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath,
  runTests,
} = require('@vscode/test-electron');

function init() {
  return new Promise((resolve, reject) => {
    try {
      const USER_CONFIG_PATH_KEY = 'VSCODE_JOYRIDE_USER_CONFIG_PATH';
      if (!process.env[USER_CONFIG_PATH_KEY]) {
        const tmpConfigPath = path.join(os.tmpdir(), 'vscode-test-runner-calva', 'user-config');
        if (fs.existsSync(tmpConfigPath)) {
          fs.rmSync(tmpConfigPath, { recursive: true });
        }
        fs.mkdirSync(tmpConfigPath, { recursive: true });
        process.env[USER_CONFIG_PATH_KEY] = tmpConfigPath;
        console.info(`USER_CONFIG_PATH: ${process.env[USER_CONFIG_PATH_KEY]}`);
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

async function main(calvaVSIXPathOrLabel, testWorkspace) {
  try {
    const extensionTestsPath = path.resolve(__dirname, 'runTests');
    const vscodeExecutablePath = await downloadAndUnzipVSCode('insiders');
    const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);

    const launchArgs = [
      testWorkspace,
      '--verbose',
      '--disable-workspace-trust',
      // When debugging tests, it can be good to use the development version of Joyride
      // If you do, comment out the install of the Joyride extension here
      // And set the `extensionDevelopmentPath` in the `runTests` call below
      // (And can't be used if you are testing the development version of Calva)
      '--install-extension',
      'betterthantomorrow.joyride',
      '--force',
    ];
    if (calvaVSIXPathOrLabel !== 'extension-development') {
      launchArgs.push('--install-extension', calvaVSIXPathOrLabel);
    }

    cp.spawnSync(cliPath, launchArgs, {
      encoding: 'utf-8',
      stdio: 'inherit',
    });

    const runOptions = {
      // When debugging tests, it can be good to use the development version Joyride
      // extensionDevelopmentPath: '/Users/pez/Projects/joyride',
      vscodeExecutablePath,
      reuseMachineInstall: true,
      extensionTestsPath,
      launchArgs: [testWorkspace],
    };
    if (calvaVSIXPathOrLabel === 'extension-development') {
      runOptions.extensionDevelopmentPath = path.resolve(__dirname, '..');
    }
    await runTests(runOptions)
      .then((_result) => {
        console.info('Tests finished');
      })
      .catch((err) => {
        console.error('Tests finished:', err);
        process.exit(1);
      });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

const args = require('minimist')(process.argv.slice(2));
const calvaVSIX = args['calva-vsix'] ? args['calva-vsix'] : 'extension-development';
const testWorkspace = args['test-workspace']
  ? path.resolve(args['test-workspace'])
  : path.resolve(__dirname);
console.info(`Using:\n  Calva: ${calvaVSIX}\n  Test workspace: ${testWorkspace}`);

void init()
  .then(() => main(calvaVSIX, testWorkspace))
  .catch((error) => {
    console.error('Failed to initialize test running environment:', error);
    process.exit(1);
  });

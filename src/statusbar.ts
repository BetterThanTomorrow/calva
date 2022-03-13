import * as vscode from 'vscode';
import * as state from './state';
import * as util from './utilities';
import * as config from './config';
import status from './status';
import { getStateValue } from '../out/cljs-lib/cljs-lib';
import { getSession, getReplSessionTypeFromState } from './nrepl/repl-session';

const connectionStatus = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1
);
const typeStatus = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1
);
const cljsBuildStatus = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1
);
const prettyPrintToggle = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1
);
const color = {
    active: 'white',
    inactive: '#b3b3b3',
};

// get theme kind once
//console.log(vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'light' : 'dark/hc');
// event
//vscode.window.onDidChangeActiveColorTheme(e => {
//	console.log(e.kind === ColorThemeKind.Light ? 'light' : 'dark/hc');
//});
function colorValue(
    section: string,
    currentConf: vscode.WorkspaceConfiguration
): string {
    const configSection = currentConf.inspect<string>(section);

    util.assertIsDefined(
        configSection,
        () => `Expected config section "${section}" to be defined!`
    );

    const { defaultValue, globalValue, workspaceFolderValue, workspaceValue } =
        configSection;

    const value =
        workspaceFolderValue || workspaceValue || globalValue || defaultValue;

    util.assertIsString(
        value,
        () =>
            `Expected color value to be a string! We got ${JSON.stringify(
                value
            )}`
    );

    return value;
}

function update(context = state.extensionContext) {
    const currentConf = vscode.workspace.getConfiguration(
        `calva.statusColor.${
            vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light
                ? 'light'
                : 'dark'
        }`
    );

    const doc = util.tryToGetDocument({}),
        fileType = util.getFileType(doc),
        cljsBuild = getStateValue('cljsBuild');

    const replTypeNames = {
        clj: 'Clojure',
        cljs: 'ClojureScript',
    };

    //let disconnectedColor = "rgb(192,192,192)";

    const pprint = config.getConfig().prettyPrintingOptions?.enabled;
    prettyPrintToggle.text = 'pprint';
    prettyPrintToggle.color = pprint ? undefined : color.inactive;
    prettyPrintToggle.tooltip = `Turn pretty printing ${pprint ? 'off' : 'on'}`;
    prettyPrintToggle.command = 'calva.togglePrettyPrint';

    typeStatus.command = undefined;
    typeStatus.text = 'Disconnected';
    typeStatus.tooltip = 'No active REPL session';
    typeStatus.color = colorValue('disconnectedColor', currentConf);

    connectionStatus.command = undefined;
    connectionStatus.tooltip = 'REPL connection status';

    cljsBuildStatus.text = '';
    cljsBuildStatus.command = 'calva.switchCljsBuild';
    cljsBuildStatus.tooltip = undefined;

    if (getStateValue('connected')) {
        connectionStatus.text = 'REPL $(zap)';
        connectionStatus.color = colorValue(
            'connectedStatusColor',
            currentConf
        );
        connectionStatus.tooltip = `nrepl://${getStateValue(
            'hostname'
        )}:${getStateValue('port')} (Click to reset connection)`;
        connectionStatus.command = 'calva.startOrConnectRepl';
        typeStatus.color = colorValue('typeStatusColor', currentConf);
        const replType = getReplSessionTypeFromState();
        if (replType !== null) {
            typeStatus.text = ['cljc', config.REPL_FILE_EXT].includes(fileType)
                ? `cljc/${replType}`
                : replType;
            if (getSession('clj') !== null && getSession('cljs') !== null) {
                typeStatus.command = 'calva.toggleCLJCSession';
                typeStatus.tooltip = `Click to use ${
                    replType === 'clj' ? 'cljs' : 'clj'
                } REPL for cljc`;
            } else {
                typeStatus.tooltip = `Connected to ${replTypeNames[replType]} REPL`;
            }
        }
        if (
            replType === 'cljs' &&
            state.extensionContext.workspaceState.get('cljsReplTypeHasBuilds')
        ) {
            if (cljsBuild !== null && replType === 'cljs') {
                cljsBuildStatus.text = cljsBuild;
                cljsBuildStatus.tooltip = 'Click to switch CLJS build REPL';
            } else if (cljsBuild === null) {
                cljsBuildStatus.text = 'No build connected';
                cljsBuildStatus.tooltip =
                    'Click to connect to a CLJS build REPL';
            }
        }
    } else if (util.getLaunchingState()) {
        connectionStatus.color = colorValue('launchingColor', currentConf);
        connectionStatus.text =
            'Launching REPL using ' + util.getLaunchingState();
        connectionStatus.tooltip =
            'Click to interrupt jack-in or Connect to REPL Server';
        connectionStatus.command = 'calva.disconnect';
    } else if (util.getConnectingState()) {
        connectionStatus.text = 'REPL - trying to connect';
        connectionStatus.tooltip =
            'Click to interrupt jack-in or Connect to REPL Server';
        connectionStatus.command = 'calva.disconnect';
    } else {
        connectionStatus.text = 'REPL $(zap)';
        connectionStatus.tooltip = 'Click to jack-in or Connect to REPL Server';
        connectionStatus.color = colorValue('disconnectedColor', currentConf);
        connectionStatus.command = 'calva.startOrConnectRepl';
    }
    if (status.shouldshowReplUi(context)) {
        connectionStatus.show();
        typeStatus.show();
        if (cljsBuildStatus.text) {
            cljsBuildStatus.show();
        } else {
            cljsBuildStatus.hide();
        }
        prettyPrintToggle.show();
    } else {
        connectionStatus.hide();
        typeStatus.hide();
        cljsBuildStatus.hide();
        prettyPrintToggle.hide();
    }
}

export default {
    update,
    color,
};

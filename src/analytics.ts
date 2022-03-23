import * as vscode from 'vscode';
import * as UA from 'universal-analytics';
import * as uuid from 'uuidv4';
import * as os from 'os';
import { isUndefined } from 'lodash';

// var debug = require('debug');
// debug.log = console.info.bind(console);

function userAllowsTelemetry(): boolean {
  const config = vscode.workspace.getConfiguration('telemetry');
  return config.get<boolean>('enableTelemetry', false);
}

export default class Analytics {
  private visitor: UA.Visitor;
  private extension: vscode.Extension<any>;
  private extensionVersion: string;
  private store: vscode.Memento;
  private GA_ID = (process.env.CALVA_DEV_GA
    ? process.env.CALVA_DEV_GA
    : 'FUBAR-69796730-3'
  ).replace(/^FUBAR/, 'UA');

  constructor(context: vscode.ExtensionContext) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.extension = vscode.extensions.getExtension('betterthantomorrow.calva')!;
    this.extensionVersion = this.extension.packageJSON.version;
    this.store = context.globalState;

    this.visitor = UA(this.GA_ID, this.userID());
    this.visitor.set('cd1', this.extensionVersion);
    this.visitor.set('cd2', vscode.version);
    this.visitor.set('cd3', this.extensionVersion);
    this.visitor.set('cd4', `${os.platform()}/${os.release()}`);
    this.visitor.set('cn', `calva-${this.extensionVersion}`);
    this.visitor.set(
      'ua',
      `Calva/${this.extensionVersion} (${os.platform()}; ${os.release()}; ${os.type}) VSCode/${
        vscode.version
      }`
    );
  }

  private userID(): string {
    const KEY = 'userLogID';
    const value = this.store.get<string>(KEY);
    if (isUndefined(value)) {
      const newID = uuid.uuid();
      void this.store.update(KEY, newID);
      return newID;
    } else {
      return value;
    }
  }

  logPath(path: string): Analytics {
    if (userAllowsTelemetry()) {
      this.visitor.pageview(path);
    }
    return this;
  }

  logEvent(category: string, action: string, label?: string, value?: string): Analytics {
    if (userAllowsTelemetry()) {
      this.visitor.event({
        ec: category,
        ea: action,
        el: label,
        ev: value,
      });
    }
    return this;
  }

  send() {
    if (userAllowsTelemetry()) {
      this.visitor.send();
    }
  }
}

import * as vscode from 'vscode';
import axios from 'axios';
import * as UA from 'universal-analytics';
import * as uuid from 'uuidv4';
import * as os from 'os';
import { isUndefined } from 'lodash';
import { CljsTypeConfig, CljsTypes } from './nrepl/connectSequence';

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
  private plausibleDomain = process.env.CALVA_DEV_GA ? 'calva-dev' : 'calva';
  private ipAddress: Promise<string>;

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
    this.ipAddress = getExternalIPAddress();
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

  async logPlausiblePageview(path: string, props: any = {}) {
    if (!userAllowsTelemetry()) {
      return;
    }
    const { cljsType: rawCljsType, ...otherProps } = props;
    const updatedProps = {
      ...(rawCljsType ? { cljsType: cljsType(rawCljsType) } : {}),
      ...otherProps,
    };
    const userAgent = `Mozilla/5.0 (${os.platform()}; ${os.release()}; ${
      os.type
    }) Code/1.67 Calva/2.0 (${hashUuid(this.userID())}; Clojure)`;
    axios
      .post(
        'https://plausible.io/api/event',
        {
          domain: this.plausibleDomain,
          name: 'pageview',
          url: `ext://calva/${path.replace(/^\//, '')}`,
          props: {
            ...updatedProps,
            'calva-version': this.extensionVersion,
            'vscode-version': vscode.version,
            'os-platform': os.platform(),
            'os-release': `${os.platform()}/${os.release()}`,
            'os-type': os.type,
          },
        },
        {
          headers: {
            'User-Agent': userAgent,
            'X-Forwarded-For': await this.ipAddress,
            'Content-Type': 'application/json',
          },
        }
      )
      .catch(function (error) {
        console.log(error);
      });
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

async function getExternalIPAddress() {
  try {
    const response = await axios.get('https://api.ipify.org');
    return response.data;
  } catch (error) {
    return '127.0.0.1';
  }
}

// Hashes a UUID to a string of numbers, separated by dots.
// Used to generate a serial-number-like ID for use in the user agent string.
// Lossy, but good enough for our purposes.
function hashUuid(uuid: string): string {
  const simpleHash = (s: string): number => {
    const modulo = s.length * 100;
    return s.split('').reduce((hash, char) => {
      return (hash * 31 + char.charCodeAt(0)) % modulo;
    }, 0);
  };
  return uuid.split('-').map(simpleHash).join('.');
}

function cljsType(type: CljsTypes | CljsTypeConfig) {
  return typeof type === 'string' ? type : type.dependsOn;
}

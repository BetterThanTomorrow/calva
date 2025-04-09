import * as vscode from 'vscode';
import axios from 'axios';
import * as uuid from 'uuidv4';
import { isUndefined } from 'lodash';

function userAllowsTelemetry(): boolean {
  const config = vscode.workspace.getConfiguration('telemetry');
  return config.get<string>('telemetryLevel', 'off') === 'all';
}

export default class Analytics {
  private store: vscode.Memento;
  private GA4_TOKEN = process.env.CALVA_DEV_GA4_TOKEN ?? 'GgrUWszmTo2FG538YCUGpw';
  private GA4_MEASUREMENT_ID = process.env.CALVA_DEV_GA4_ID ?? 'G-HYZ3MX6DL1';

  constructor(context: vscode.ExtensionContext) {
    this.store = context.globalState;
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

  async logGA4Pageview(path: string) {
    if (!userAllowsTelemetry()) {
      return;
    }
    try {
      return axios
        .post(
          `https://www.google-analytics.com/mp/collect?measurement_id=${this.GA4_MEASUREMENT_ID}&api_secret=${this.GA4_TOKEN}`,
          {
            client_id: this.userID(),
            user_id: this.userID(),
            events: [
              {
                name: 'page_view',
                params: {
                  page_location: path,
                  page_title: path.replace(/^\//, ''),
                  engagement_time_msec: 1,
                },
              },
            ],
          },
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 VSCode',
              'Content-Type': 'application/json',
            },
          }
        )
        .catch(function (error) {
          console.log(error);
        });
    } catch (error) {
      console.log(error);
    }
  }
}

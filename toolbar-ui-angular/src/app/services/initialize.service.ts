/**
 * Copyright © 2014-2019 Tick42 OOD
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs/index';

import {IApplication, IProvider} from '../app';

import {HelperService} from './helper.service';

@Injectable()
export class InitializeService {
  public providers: BehaviorSubject<IProvider[]> = new BehaviorSubject<IProvider[]>([]);
  public apps: BehaviorSubject<IApplication[]> = new BehaviorSubject<IApplication[]>([]);
  private internalProviders: IProvider[] = [];
  private internalApps: IApplication[] = [];

  constructor(private helperService: HelperService) {
  }

  public init(): void {
    this.subscribeForFdc3LauncherToolbarProviders();
    this.subscribeForLogStream();
  }

  /**
   * Update provider
   * On toggle provider, the "enabled" and "status" props are updated
   * @param providerName: provider.name
   * @param isChecked: whether it is enabled or not
   */
  public updateProviders(providerName: string, isChecked: boolean): void {
    this.internalProviders = this.internalProviders.map((provider: IProvider) => {
      if (provider.name === providerName) {
        provider.enabled = isChecked;
        provider.status = isChecked ? 'connecting' : 'disconnected';
      }
      return provider;
    });
    this.providers.next(this.internalProviders);
  }

  /**
   * Update apps
   * @param updatedApp: app to be updated
   * @param key: key by which it will be updated
   */
  public updateApps(updatedApp: IApplication, key: string): void {
    if (!updatedApp) {
      return;
    }
    this.internalApps = this.internalApps.map((app: IApplication) => {
      if (app.appId === updatedApp.appId) {
        app[key] = updatedApp[key];
      }
      return app;
    });
    this.apps.next(this.internalApps);
    this.updateLocalStorage();
  }

  /**
   * Filter displayed apps by title
   * @param filter: filter value
   */
  public filterDisplayedApps(filter: string): void {
    this.internalApps = this.internalApps.map((app: IApplication) => {
      if (app.title.toLowerCase().indexOf(filter.toLowerCase()) < 0) {
        app.showApp = false;
      } else {
        app.showApp = app.provider.enabled;
      }
      return app;
    });
    this.apps.next(this.internalApps);
  }

  /**
   * Set apps
   * Get apps from each provider and add the following props:
   * provider - app provider
   * iconPath - the path to the icon resource
   * showApp - show apps only if the provider is enabled
   * isFavourite - false by default, get favourites from local storage
   * If the provider successfully gets the apps, its status is updated to "connected". If not, its status is updated to "disconnected"
   */
  public setApps(): void {
    const localStorageFavApps: string = window.localStorage.getItem('favApps');
    const favAppsIds: string[] = localStorageFavApps ? localStorageFavApps.split(',') : [];
    const initialApps: IApplication[] = [];
    this.internalProviders.forEach((provider: IProvider) => {
      provider.getApps()
        .then((apps: IApplication[]) => {
          apps.forEach((app: IApplication) => {
            const iconPath: string = this.getAppIconPath(app);
            const application: IApplication = app;
            app.provider = provider;
            app.iconPath = iconPath;
            app.showApp = provider.enabled;
            app.isFavourite = favAppsIds.indexOf(app.appId) >= 0 && provider.enabled;
            initialApps.push(application);
          });
          provider.status = 'connected';
          this.internalApps = initialApps;
          this.apps.next(this.internalApps);
        })
        .catch(() => {
          (window as any).logStream.next([`Unable to connect app directory "${provider.name}"`, 'ERROR', 'Toolbar']);
          provider.status = 'disconnected';
        });
    });
  }

  /**
   * Update local storage with the favourite apps
   */
  private updateLocalStorage(): void {
    const favAppIds: string[] = this.internalApps
      .filter((app: IApplication) => app.isFavourite)
      .map((app: IApplication) => app.appId);
    window.localStorage.setItem('favApps', favAppIds.toString());
  }

  /**
   * Subscribe for Glue42 demo toolbar providers
   * Add the following props:
   * enabled - set to true by default
   * status - set to 'connecting' by default
   * Set apps after updating the providers
   */
  private subscribeForFdc3LauncherToolbarProviders(): void {
    (window as any).fdc3LauncherToolbar.providers.subscribe((providers: IProvider[]) => {
      providers = providers.map((provider: IProvider) => {
        this.addLogOnProviderAdded(provider);
        provider.enabled = true;
        provider.status = 'connecting';
        return provider;
      });
      this.internalProviders = providers;
      this.providers.next(this.internalProviders);
      this.setApps();
    });
  }

  /**
   * Add log on provider added
   * @param provider: provider
   */
  private addLogOnProviderAdded(provider: IProvider): void {
    const logMessage: string = `Will add provider "${provider.name}" with URL ${provider.apiUrl}`;
    this.helperService.addLog(Date.now(), 'INFO', 'Toolbar', logMessage);
  }

  /**
   * Get app icon path from resources
   * @param app: app
   * @returns string: path
   */
  private getAppIconPath(app: IApplication): string {
    const type: string = JSON.parse(app.manifest as string).type;
    let iconPath: string;
    switch (type) {
      case 'host':
        const hostType: string = JSON.parse(app.manifest as string).hostType;
        iconPath = hostType === 'Glue42' ? 'glue42.png' : 'fdc3.png.ico';
        break;
      case 'exe':
        iconPath = 'exe.svg';
        break;
      case 'browser':
        iconPath = 'browser.svg';
        break;
      default:
        iconPath = 'default.svg';
        break;
    }
    return `./assets/icons/${iconPath}`;
  }

  /**
   * Subscribe for log stream
   */
  private subscribeForLogStream(): void {
    (window as any).logStream.subscribe((log: string[]) => {
      if (log.length === 3) {
        this.helperService.addLog(Date.now(), log[1].toUpperCase(), log[2], log[0]);
      }
    });
  }
}

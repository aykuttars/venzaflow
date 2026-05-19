import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { registerLocaleData } from '@angular/common';
import localeTr from '@angular/common/locales/tr';
import localeEn from '@angular/common/locales/en';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { firstValueFrom } from 'rxjs';

export type AppLanguage = 'tr' | 'en';

/** UI language on login screen only (before tenant is known). */
const LOGIN_PREVIEW_KEY = 'bms.loginPreview';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);
  readonly currentLang = signal<AppLanguage>('tr');

  constructor() {
    registerLocaleData(localeTr);
    registerLocaleData(localeEn);
  }

  /** After login/me: UI and API follow tenant default (falls back to Turkish). */
  initFromTenant(tenantLang: string | undefined): void {
    void this.apply(this.normalize(tenantLang || 'tr'));
  }

  /** Tenant admin saved a new default_language in settings. */
  applyTenantLanguage(lang: AppLanguage): void {
    void this.apply(lang);
  }

  /** Login page: TR/EN toggle (saved for next visit to login; does not override tenant after sign-in). */
  setLoginPreviewLanguage(lang: AppLanguage): void {
    sessionStorage.setItem(LOGIN_PREVIEW_KEY, lang);
    void this.apply(lang);
  }

  restoreLoginPreviewLanguage(): void {
    const stored = sessionStorage.getItem(LOGIN_PREVIEW_KEY) as AppLanguage | null;
    const lang = stored === 'en' || stored === 'tr' ? stored : 'tr';
    void this.apply(lang);
  }

  /** After logout: show login UI in last login-page language (or Turkish). */
  resetOnLogout(): void {
    this.restoreLoginPreviewLanguage();
  }

  getLanguage(): AppLanguage {
    return this.currentLang();
  }

  getAcceptLanguageHeader(): string {
    return this.currentLang();
  }

  private normalize(value: string): AppLanguage {
    return value?.toLowerCase().startsWith('en') ? 'en' : 'tr';
  }

  private async apply(lang: AppLanguage): Promise<void> {
    this.currentLang.set(lang);
    document.documentElement.lang = lang;
    await firstValueFrom(this.translate.use(lang));
  }
}

export function matDateLocaleFactory(lang: LanguageService): string {
  return lang.getLanguage() === 'tr' ? 'tr-TR' : 'en-US';
}

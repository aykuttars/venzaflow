import {
  ApplicationConfig,
  importProvidersFrom,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { APP_ROUTES } from './app.routes';
import { AppTranslateLoader } from './core/app-translate-loader';
import { authInterceptor } from './core/auth.interceptor';
import { languageInterceptor } from './core/language.interceptor';
import { moduleAccessInterceptor } from './core/module-access.interceptor';
import { platformAuthInterceptor } from './core/platform-auth.interceptor';
import { i18nInitializerProvider } from './core/i18n.initializer';
import { authReducer } from './core/state/auth.reducer';
import { AuthEffects } from './core/state/auth.effects';
import { LanguageService, matDateLocaleFactory } from './core/language.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(
      withInterceptors([
        languageInterceptor,
        moduleAccessInterceptor,
        platformAuthInterceptor,
        authInterceptor,
      ])
    ),
    i18nInitializerProvider,
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'tr',
        loader: {
          provide: TranslateLoader,
          useClass: AppTranslateLoader,
        },
      })
    ),
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useFactory: matDateLocaleFactory, deps: [LanguageService] },
    provideStore({ auth: authReducer }),
    provideEffects([AuthEffects]),
    provideCharts(withDefaultRegisterables()),
  ],
};

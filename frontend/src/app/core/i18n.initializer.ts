import { APP_INITIALIZER, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export function initTranslations(): () => Promise<unknown> {
  const translate = inject(TranslateService);
  translate.setDefaultLang('tr');
  translate.addLangs(['tr', 'en']);
  return () => firstValueFrom(translate.use('tr'));
}

export const i18nInitializerProvider = {
  provide: APP_INITIALIZER,
  useFactory: initTranslations,
  multi: true,
};

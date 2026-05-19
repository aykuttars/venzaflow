import { TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import en from '../../../public/assets/i18n/en.json';
import tr from '../../../public/assets/i18n/tr.json';

const CATALOG: Record<string, object> = { tr, en };

/** Bundled translations — no HTTP race on first paint. */
export class AppTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<object> {
    return of(CATALOG[lang] ?? CATALOG['tr']);
  }
}

import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { AuthService } from './auth.service';

/** ngx-translate nav keys when slug differs from nav.* path segment. */
const NAV_I18N_KEY: Record<string, string> = {
  audit: 'nav.auditLogs',
  settings: 'nav.settings',
};

@Injectable({ providedIn: 'root' })
export class ModuleLabelService {
  private auth = inject(AuthService);
  private translate = inject(TranslateService);

  label(slug: string): string {
    const custom = this.auth.me()?.module_labels?.[slug]?.trim();
    if (custom) return custom;
    return this.i18nLabel(slug);
  }

  /** i18n default without tenant override (hints, reset preview). */
  i18nLabel(slug: string): string {
    const navKey = NAV_I18N_KEY[slug] ?? `nav.${slug}`;
    const navText = this.translate.instant(navKey);
    if (navText !== navKey) return navText;

    const modKey = `modules.${slug}`;
    const modText = this.translate.instant(modKey);
    if (modText !== modKey) return modText;

    return slug;
  }
}

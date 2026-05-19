import { Component, Input, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ModuleLabelService } from '../core/module-label.service';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [MatIconModule, TranslateModule],
  template: `
    <div class="page-header">
      <mat-icon>{{ icon }}</mat-icon>
      <h1>{{ heading }}</h1>
      <span class="spacer"></span>
      <ng-content></ng-content>
    </div>
  `,
})
export class PageHeaderComponent {
  private moduleLabels = inject(ModuleLabelService);
  private translate = inject(TranslateService);

  @Input() title = '';
  @Input() titleKey = '';
  /** When set, title uses tenant module_labels override, then i18n nav/modules. */
  @Input() moduleSlug = '';
  @Input() icon = 'dashboard';

  get heading(): string {
    if (this.moduleSlug) {
      return this.moduleLabels.label(this.moduleSlug);
    }
    if (this.titleKey) {
      return this.translate.instant(this.titleKey);
    }
    return this.title;
  }
}

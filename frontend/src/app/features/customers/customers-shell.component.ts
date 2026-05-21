import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ModuleNavService } from '../../core/module-nav.service';
import { ModuleLabelService } from '../../core/module-label.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-customers-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    PageHeaderComponent,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="customers" icon="people" />
      @if (hasNestedChildren) {
      <nav class="module-host__tabs">
        <a routerLink="/customers" routerLinkActive="active-link" [routerLinkActiveOptions]="{ exact: true }">
          {{ 'nav.customers' | translate }}
        </a>
        @for (child of nestedChildren; track child) {
        <a [routerLink]="['/customers', child]" routerLinkActive="active-link">
          {{ childLabel(child) }}
        </a>
        }
      </nav>
      }
      <router-outlet />
    </div>
  `,
  styles: [
    `
      .module-host__tabs {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        padding-bottom: 8px;
      }
      .module-host__tabs a {
        text-decoration: none;
        color: rgba(0, 0, 0, 0.6);
        padding: 4px 0;
      }
      .module-host__tabs a.active-link {
        color: #3f51b5;
        border-bottom: 2px solid #3f51b5;
      }
    `,
  ],
})
export class CustomersShellComponent {
  private nav = inject(ModuleNavService);
  private labels = inject(ModuleLabelService);

  get nestedChildren(): string[] {
    return this.nav.nestedChildren('customers');
  }

  get hasNestedChildren(): boolean {
    return this.nestedChildren.length > 0;
  }

  childLabel(slug: string): string {
    return this.labels.label(slug);
  }
}

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { API_BASE } from '../core/api';

interface PermissionItem {
  id: number;
  codename: string;
  name: string;
}

interface PermissionGroup {
  module: string;
  items: PermissionItem[];
}

@Component({
  selector: 'app-permission-picker',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="perm-picker" [class.perm-picker--loading]="loading">
      @if (loading) {
      <div class="perm-picker__state">
        <mat-spinner diameter="32"></mat-spinner>
        <span>Yetkiler yükleniyor…</span>
      </div>
      } @else if (error) {
      <div class="perm-picker__state perm-picker__state--error">{{ error }}</div>
      } @else if (groups.length === 0) {
      <div class="perm-picker__state">Yetki listesi boş.</div>
      } @else {
      @for (g of groups; track g.module) {
      <section class="perm-group">
        <h4 class="perm-group__title">
          {{ moduleLabel(g.module) }}
          <span class="perm-group__count">{{ g.items.length }}</span>
        </h4>
        <ul class="perm-list">
          @for (p of g.items; track p.codename) {
          <li class="perm-list__item">
            <mat-checkbox
              [checked]="isChecked(p.codename)"
              (change)="toggle(p.codename, $event.checked)"
              color="primary"
            >
              <span class="perm-list__label">
                <span class="perm-list__code">{{ p.codename }}</span>
                <span class="perm-list__name">{{ p.name }}</span>
              </span>
            </mat-checkbox>
          </li>
          }
        </ul>
      </section>
      }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .perm-picker {
        width: 100%;
        max-height: min(320px, 45vh);
        overflow-x: hidden;
        overflow-y: auto;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
        background: #fafafa;
        padding: 4px 0;
        box-sizing: border-box;
      }

      .perm-picker--loading {
        min-height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .perm-picker__state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 24px 16px;
        color: rgba(0, 0, 0, 0.6);
        font-size: 14px;
        text-align: center;
      }

      .perm-picker__state--error {
        color: #b00020;
      }

      .perm-group {
        margin: 0;
        padding: 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }

      .perm-group:last-child {
        border-bottom: none;
      }

      .perm-group__title {
        margin: 0;
        padding: 10px 16px 6px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 0, 0, 0.03);
        position: sticky;
        top: 0;
        z-index: 1;
      }

      .perm-group__count {
        font-weight: 500;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 10px;
        background: rgba(63, 81, 181, 0.12);
        color: #3f51b5;
      }

      .perm-list {
        list-style: none;
        margin: 0;
        padding: 4px 8px 8px;
      }

      .perm-list__item {
        margin: 0;
        padding: 0;
      }

      .perm-list__item ::ng-deep .mdc-form-field {
        width: 100%;
        align-items: flex-start;
      }

      .perm-list__item ::ng-deep .mdc-checkbox {
        margin-top: 2px;
      }

      .perm-list__item ::ng-deep .mdc-label {
        width: 100%;
        padding: 6px 4px;
        white-space: normal;
        line-height: 1.35;
        color: rgba(0, 0, 0, 0.87);
      }

      .perm-list__label {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .perm-list__code {
        font-family: 'Roboto Mono', ui-monospace, monospace;
        font-size: 12px;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.87);
        word-break: break-all;
      }

      .perm-list__name {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.55);
      }
    `,
  ],
})
export class PermissionPickerComponent implements OnInit {
  @Input({ required: true }) control!: FormControl<string[]>;

  private http = inject(HttpClient);
  groups: PermissionGroup[] = [];
  loading = true;
  error = '';

  private static readonly MODULE_LABELS: Record<string, string> = {
    settings: 'Ayarlar',
    employees: 'Çalışanlar',
    products: 'Ürünler',
    inventory: 'Envanter',
    customers: 'Müşteriler',
    patients: 'Hastalar',
    appointments: 'Randevular',
    billing: 'Faturalama',
    accounting: 'Muhasebe',
    dashboard: 'Panel',
    audit: 'Denetim',
  };

  ngOnInit(): void {
    this.http.get<PermissionItem[] | { results: PermissionItem[] }>(`${API_BASE}/permissions/`).subscribe({
      next: (data) => {
        const items = Array.isArray(data) ? data : data?.results ?? [];
        const map = new Map<string, PermissionItem[]>();
        for (const p of items) {
          const mod = p.codename.split('.')[0] || 'other';
          if (!map.has(mod)) map.set(mod, []);
          map.get(mod)!.push(p);
        }
        this.groups = [...map.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([module, groupItems]) => ({
            module,
            items: groupItems.sort((a, b) => a.codename.localeCompare(b.codename)),
          }));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Yetkiler yüklenemedi.';
      },
    });
  }

  moduleLabel(module: string): string {
    return PermissionPickerComponent.MODULE_LABELS[module] ?? module;
  }

  isChecked(codename: string): boolean {
    return (this.control.value || []).includes(codename);
  }

  toggle(codename: string, checked: boolean): void {
    const cur = new Set(this.control.value || []);
    if (checked) cur.add(codename);
    else cur.delete(codename);
    this.control.setValue([...cur].sort());
    this.control.markAsDirty();
  }
}

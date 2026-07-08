import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';
import { TariffSection, TariffService, TenantTariffItem } from '../../core/tariff.service';

@Component({
  selector: 'app-oral-tariff-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div style="margin-top:16px">
      @if (tariffYear()) {
      <p style="font-size:13px;opacity:0.75;margin:0 0 12px">
        {{ 'oral.activeTariffYear' | translate:{ year: tariffYear() } }}
      </p>
      }
      @if (!configured()) {
      <p>{{ 'oral.tariffNotConfigured' | translate }}</p>
      } @else {
      @if (bumpedCount() > 0) {
      <div class="bump-banner">
        <mat-icon>report_problem</mat-icon>
        <span>{{ 'oral.bumpBanner' | translate:{ count: bumpedCount(), year: tariffYear() } }}</span>
        <button mat-stroked-button type="button" (click)="toggleOnlyBumped()">
          {{ (onlyBumped() ? 'oral.showAll' : 'oral.showBumpedOnly') | translate }}
        </button>
      </div>
      }
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:220px">
          <mat-label>{{ 'oral.sectionFilter' | translate }}</mat-label>
          <mat-select [formControl]="sectionControl">
            <mat-option [value]="null">{{ 'common.all' | translate }}</mat-option>
            @for (s of sections(); track s.section_no) {
            <mat-option [value]="s.section_no">{{ s.section_no }}. {{ s.section_name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:280px">
          <mat-label>{{ 'common.search' | translate }}</mat-label>
          <input matInput [formControl]="searchControl" />
        </mat-form-field>
        @if (canWrite()) {
        <button mat-stroked-button type="button" (click)="syncProcedures()">
          <mat-icon>sync</mat-icon> {{ 'oral.syncProcedures' | translate }}
        </button>
        }
      </div>

      <p style="font-size:12px;opacity:0.7;margin:0 0 8px">
        {{ 'oral.vatNote' | translate:{ rate: vatRate() } }}
      </p>
      <table class="bms-table">
        <thead>
          <tr>
            <th>{{ 'oral.procCode' | translate }}</th>
            <th>{{ 'products.name' | translate }}</th>
            <th>{{ 'oral.referenceIncl' | translate }}</th>
            <th>{{ 'oral.clinicIncl' | translate }}</th>
            <th>{{ 'oral.clinicExcl' | translate }}</th>
            @if (canWrite()) { <th></th> }
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item.id) {
          <tr [class.bumped-row]="item.floor_bumped">
            <td>
              {{ item.code }}
              @if (item.floor_bumped) {
              <mat-icon
                class="bump-icon"
                [title]="'oral.bumpRowHint' | translate:{ floor: formatPrice(item.clinic_incl), year: tariffYear() }"
                >report_problem</mat-icon
              >
              }
            </td>
            <td>{{ item.name }}</td>
            <td>{{ formatPrice(item.reference_incl) }} ₺</td>
            @if (editingId() === item.id) {
            <td>
              <input
                type="number"
                step="0.01"
                class="price-input"
                [value]="editIncl()"
                (input)="editIncl.set($any($event.target).value)"
              />
            </td>
            <td class="derived">{{ formatPrice(exclFrom(editIncl())) }} ₺</td>
            @if (canWrite()) {
            <td style="white-space:nowrap">
              <button mat-icon-button type="button" (click)="saveEdit(item)" [title]="'common.save' | translate">
                <mat-icon>check</mat-icon>
              </button>
              <button mat-icon-button type="button" (click)="cancelEdit()" [title]="'common.cancel' | translate">
                <mat-icon>close</mat-icon>
              </button>
            </td>
            }
            } @else {
            <td [class.bump-cell]="item.floor_bumped">{{ formatPrice(item.clinic_incl) }} ₺</td>
            <td class="derived">{{ formatPrice(exclFrom(item.clinic_incl)) }} ₺</td>
            @if (canWrite()) {
            <td style="white-space:nowrap">
              <button mat-icon-button type="button" (click)="startEdit(item)" [title]="'common.edit' | translate">
                <mat-icon>edit</mat-icon>
              </button>
              @if (item.floor_bumped) {
              <button
                mat-icon-button
                type="button"
                (click)="acceptBumped(item)"
                [title]="'oral.acceptTariffPrice' | translate"
              >
                <mat-icon>check_circle</mat-icon>
              </button>
              }
            </td>
            }
            }
          </tr>
          } @empty {
          <tr><td [attr.colspan]="canWrite() ? 6 : 5">{{ 'common.noRecords' | translate }}</td></tr>
          }
        </tbody>
      </table>

      <div style="display:flex;gap:8px;align-items:center;margin-top:12px">
        <button mat-button type="button" [disabled]="page() <= 1" (click)="goPage(page() - 1)">
          {{ 'common.prev' | translate }}
        </button>
        <span style="font-size:13px">{{ page() }} / {{ totalPages() }}</span>
        <button mat-button type="button" [disabled]="page() >= totalPages()" (click)="goPage(page() + 1)">
          {{ 'common.next' | translate }}
        </button>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .price-input {
        width: 100px;
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      .bump-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #fdecea;
        border: 1px solid #f5c6cb;
        color: #b71c1c;
        padding: 10px 14px;
        border-radius: 6px;
        margin-bottom: 14px;
        font-size: 13px;
      }
      .bump-banner mat-icon {
        color: #d32f2f;
      }
      .bumped-row .bump-cell {
        color: #d32f2f;
        font-weight: 600;
      }
      .bump-icon {
        color: #d32f2f;
        font-size: 18px;
        width: 18px;
        height: 18px;
        vertical-align: middle;
        cursor: help;
      }
      .derived {
        color: #6b6b6b;
      }
    `,
  ],
})
export class OralTariffListComponent implements OnInit {
  private tariffService = inject(TariffService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);

  configured = signal(false);
  tariffYear = signal<number | null>(null);
  sections = signal<TariffSection[]>([]);
  items = signal<TenantTariffItem[]>([]);
  count = signal(0);
  bumpedCount = signal(0);
  onlyBumped = signal(false);
  vatRate = signal('10');
  page = signal(1);
  pageSize = 50;
  editingId = signal<number | null>(null);
  editIncl = signal('');

  sectionControl = this.fb.control<number | null>(null);
  searchControl = this.fb.control('', { nonNullable: true });

  totalPages = () => Math.max(1, Math.ceil(this.count() / this.pageSize));

  ngOnInit(): void {
    this.tariffService.getActive().subscribe((res) => {
      this.configured.set(res.configured);
      this.sections.set(res.sections || []);
      if (res.tariff?.year) this.tariffYear.set(res.tariff.year);
      if (res.configured) this.reload();
    });
    this.sectionControl.valueChanges.subscribe(() => {
      this.page.set(1);
      this.reload();
    });
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.page.set(1);
      this.reload();
    });
  }

  canWrite(): boolean {
    return this.auth.hasPermission('oral.write');
  }

  reload(): void {
    if (!this.configured()) return;
    this.tariffService
      .listItems({
        q: this.searchControl.value.trim(),
        section: this.sectionControl.value ?? undefined,
        page: this.page(),
        page_size: this.pageSize,
        only_bumped: this.onlyBumped(),
      })
      .subscribe((res) => {
        this.items.set(res.results);
        this.count.set(res.count);
        this.bumpedCount.set(res.bumped_count ?? 0);
        if (res.vat_rate != null) this.vatRate.set(String(res.vat_rate));
      });
  }

  exclFrom(incl: string | number | null | undefined): number {
    const n = typeof incl === 'string' ? parseFloat(incl) : incl ?? 0;
    const rate = parseFloat(this.vatRate()) || 0;
    if (!n) return 0;
    return n / (1 + rate / 100);
  }

  goPage(p: number): void {
    this.page.set(p);
    this.reload();
  }

  toggleOnlyBumped(): void {
    this.onlyBumped.update((v) => !v);
    this.page.set(1);
    this.reload();
  }

  acceptBumped(item: TenantTariffItem): void {
    this.tariffService
      .updateClinicPrice(item.id, { clinic_price_incl_vat: item.clinic_incl })
      .subscribe({
        next: (updated) => {
          this.items.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
          this.bumpedCount.update((c) => Math.max(0, c - 1));
          this.snack.open(this.translate.instant('common.saved'), undefined, { duration: 2000 });
        },
        error: (err) => {
          this.snack.open(apiErrorMessage(err, undefined, 'Error'), undefined, { duration: 4000 });
        },
      });
  }

  startEdit(item: TenantTariffItem): void {
    this.editingId.set(item.id);
    this.editIncl.set(item.clinic_incl);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(item: TenantTariffItem): void {
    this.tariffService
      .updateClinicPrice(item.id, { clinic_price_incl_vat: this.editIncl() })
      .subscribe({
        next: (updated) => {
          if (item.floor_bumped && !updated.floor_bumped) {
            this.bumpedCount.update((c) => Math.max(0, c - 1));
          }
          this.items.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
          this.editingId.set(null);
          this.snack.open(this.translate.instant('common.saved'), undefined, { duration: 2000 });
        },
        error: (err) => {
          this.snack.open(
            apiErrorMessage(err, 'clinic_price_incl_vat', this.translate.instant('common.error')),
            undefined,
            { duration: 4000 }
          );
        },
      });
  }

  syncProcedures(): void {
    this.tariffService.syncProcedures().subscribe({
      next: (stats) => {
        this.snack.open(
          this.translate.instant('oral.syncProceduresDone', { count: stats.synced }),
          undefined,
          { duration: 3000 }
        );
      },
    });
  }

  formatPrice(v: string | number | null | undefined): string {
    if (v == null || v === '') return '0,00';
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

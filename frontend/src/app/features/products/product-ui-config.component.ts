import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { API_BASE } from '../../core/api';
import { CrudService } from '../../shared/crud.service';
import {
  DetailFieldConfig,
  FormFieldConfig,
  ListColumnConfig,
} from '../../shared/dynamic-fields/models';
import { ProductConfigService, unwrapList } from '../../shared/dynamic-fields/product-config.service';

@Component({
  selector: 'app-product-ui-config',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatSnackBarModule,
    MatTabsModule,
    TranslateModule,
  ],
  template: `
    <div style="margin-top:16px">
      <p class="hint">{{ 'products.uiConfigHint' | translate }}</p>
      @if (canWrite()) {
      <button mat-stroked-button (click)="reseed()">
        <mat-icon>refresh</mat-icon> {{ 'products.reseedUi' | translate }}
      </button>
      }
      <mat-tab-group style="margin-top:12px">
        <mat-tab [label]="'products.listConfig' | translate">
          <table class="bms-table" style="margin-top:12px">
            <thead>
              <tr>
                <th>{{ 'products.fieldKey' | translate }}</th>
                <th>{{ 'products.source' | translate }}</th>
                <th>{{ 'products.visible' | translate }}</th>
                <th>{{ 'products.order' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of listCols(); track c.id) {
              <tr>
                <td>{{ c.field_key }}</td>
                <td>{{ c.field_source }}</td>
                <td>
                  <mat-checkbox
                    [checked]="c.is_visible"
                    [disabled]="!canWrite()"
                    (change)="patchList(c, { is_visible: $event.checked })"
                  />
                </td>
                <td>{{ c.order }}</td>
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab [label]="'products.formConfig' | translate">
          <table class="bms-table" style="margin-top:12px">
            <thead>
              <tr>
                <th>{{ 'products.fieldKey' | translate }}</th>
                <th>{{ 'products.section' | translate }}</th>
                <th>{{ 'products.visible' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of formCols(); track c.id) {
              <tr>
                <td>{{ c.field_key }}</td>
                <td>{{ c.section }}</td>
                <td>
                  <mat-checkbox
                    [checked]="c.is_visible"
                    [disabled]="!canWrite()"
                    (change)="patchForm(c, { is_visible: $event.checked })"
                  />
                </td>
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
        <mat-tab [label]="'products.detailConfig' | translate">
          <table class="bms-table" style="margin-top:12px">
            <thead>
              <tr>
                <th>{{ 'products.fieldKey' | translate }}</th>
                <th>{{ 'products.section' | translate }}</th>
                <th>{{ 'products.visible' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of detailCols(); track c.id) {
              <tr>
                <td>{{ c.field_key }}</td>
                <td>{{ c.section }}</td>
                <td>
                  <mat-checkbox
                    [checked]="c.is_visible"
                    [disabled]="!canWrite()"
                    (change)="patchDetail(c, { is_visible: $event.checked })"
                  />
                </td>
              </tr>
              }
            </tbody>
          </table>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [
    `
      .hint {
        opacity: 0.75;
        font-size: 13px;
        margin: 0 0 8px;
      }
    `,
  ],
})
export class ProductUiConfigComponent implements OnInit {
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private configService = inject(ProductConfigService);
  protected auth = inject(AuthService);

  private listCrud = new CrudService<ListColumnConfig & { id: number }>(
    this.http,
    'products/list-config',
    this.auth,
    'products'
  );
  private formCrud = new CrudService<FormFieldConfig & { id: number }>(
    this.http,
    'products/form-config',
    this.auth,
    'products'
  );
  private detailCrud = new CrudService<DetailFieldConfig & { id: number }>(
    this.http,
    'products/detail-config',
    this.auth,
    'products'
  );

  listCols = signal<(ListColumnConfig & { id: number })[]>([]);
  formCols = signal<(FormFieldConfig & { id: number })[]>([]);
  detailCols = signal<(DetailFieldConfig & { id: number })[]>([]);

  ngOnInit(): void {
    this.reload();
  }

  canWrite = () => this.auth.hasPermission('products.write');

  reload(): void {
    this.configService.listColumnConfig().subscribe((d) => this.listCols.set(unwrapList(d) as any));
    this.configService.formConfig().subscribe((d) => this.formCols.set(unwrapList(d) as any));
    this.configService.detailConfig().subscribe((d) => this.detailCols.set(unwrapList(d) as any));
  }

  patchList(c: ListColumnConfig & { id: number }, patch: Partial<ListColumnConfig>): void {
    this.listCrud.update(c.id, patch).subscribe(() => this.reload());
  }

  patchForm(c: FormFieldConfig & { id: number }, patch: Partial<FormFieldConfig>): void {
    this.formCrud.update(c.id, patch).subscribe(() => this.reload());
  }

  patchDetail(c: DetailFieldConfig & { id: number }, patch: Partial<DetailFieldConfig>): void {
    this.detailCrud.update(c.id, patch).subscribe(() => this.reload());
  }

  reseed(): void {
    this.http.post(`${API_BASE}/products/list-config/reseed/`, {}).subscribe({
      next: () => {
        this.reload();
        this.snack.open(this.translate.instant('products.reseeded'), 'OK', { duration: 2000 });
      },
      error: () => this.snack.open(this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }
}

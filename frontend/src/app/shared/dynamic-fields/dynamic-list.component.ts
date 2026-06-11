import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ListColumnConfig, ProductRow } from './models';

@Component({
  selector: 'app-dynamic-product-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <table class="bms-table">
      <thead>
        <tr>
          @for (col of visibleColumns; track col.field_key + col.field_source) {
          <th [style.width]="col.width || null">{{ col.label || col.field_key }}</th>
          }
          @if (showActions) {
          <th></th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows; track row.id) {
        <tr>
          @for (col of visibleColumns; track col.field_key + col.field_source) {
          <td>{{ cellValue(row, col) }}</td>
          }
          @if (showActions) {
          <td style="text-align:right">
            @if (onView) {
            <button mat-icon-button type="button" (click)="onView(row)"><mat-icon>visibility</mat-icon></button>
            }
            @if (onEdit) {
            <button mat-icon-button type="button" (click)="onEdit(row)"><mat-icon>edit</mat-icon></button>
            }
            @if (onDelete) {
            <button mat-icon-button type="button" (click)="onDelete(row)"><mat-icon>delete</mat-icon></button>
            }
          </td>
          }
        </tr>
        } @empty {
        <tr>
          <td [attr.colspan]="visibleColumns.length + (showActions ? 1 : 0)" class="empty-row">
            {{ emptyMessage }}
          </td>
        </tr>
        }
      </tbody>
    </table>
  `,
  styles: [
    `
      .empty-row {
        text-align: center;
        opacity: 0.65;
        padding: 24px;
      }
    `,
  ],
})
export class DynamicProductListComponent {
  @Input() columns: ListColumnConfig[] = [];
  @Input() rows: ProductRow[] = [];
  @Input() showActions = true;
  @Input() emptyMessage = '—';
  @Input() onView?: (row: ProductRow) => void;
  @Input() onEdit?: (row: ProductRow) => void;
  @Input() onDelete?: (row: ProductRow) => void;

  get visibleColumns(): ListColumnConfig[] {
    return [...this.columns]
      .filter((c) => c.is_visible)
      .sort((a, b) => a.order - b.order);
  }

  cellValue(row: ProductRow, col: ListColumnConfig): string {
    const key = col.field_key;
    if (col.field_source === 'DYNAMIC') {
      const v = row.dynamic_fields?.[key];
      return v == null ? '—' : String(v);
    }
    if (col.field_source === 'COMPUTED') {
      const v = row[key];
      return v == null ? '—' : String(v);
    }
    const v = row[key];
    if (key === 'is_active') return v ? '✓' : '—';
    if (key === 'unit_price' || key === 'cost_price') return v != null ? String(v) : '—';
    return v == null || v === '' ? '—' : String(v);
  }
}

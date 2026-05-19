import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';

export interface ColumnDef<T = unknown> {
  key: string;
  header: string;
  cell?: (row: T) => string | number | null;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
  ],
  template: `
    <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="flex:0 0 280px">
        <mat-label>Search</mat-label>
        <input matInput [(ngModel)]="searchText" (ngModelChange)="onSearch($event)" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
      <span style="flex:1"></span>
      <ng-content select="[toolbar]"></ng-content>
    </div>

    <table mat-table [dataSource]="rows" matSort (matSortChange)="onSort($event)" class="bms-table">
      @for (c of columns; track c.key) {
        <ng-container [matColumnDef]="c.key">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ c.header }}</th>
          <td mat-cell *matCellDef="let row">
            {{ c.cell ? c.cell(row) : row[c.key] }}
          </td>
        </ng-container>
      }
      <ng-container matColumnDef="__actions__">
        <th mat-header-cell *matHeaderCellDef style="width:100px"></th>
        <td mat-cell *matCellDef="let row">
          <ng-container *ngTemplateOutlet="actionsTpl || empty; context: { $implicit: row }"></ng-container>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayColumns"></tr>
    </table>

    <ng-template #empty></ng-template>

    <mat-paginator
      [length]="total"
      [pageSize]="pageSize"
      [pageSizeOptions]="[10, 25, 50, 100]"
      (page)="onPage($event)"
    ></mat-paginator>
  `,
})
export class DataTableComponent {
  @Input() columns: ColumnDef[] = [];
  @Input() rows: unknown[] = [];
  @Input() total = 0;
  @Input() pageSize = 25;
  @Input() actionsTpl: unknown = null;
  @Output() pageChange = new EventEmitter<{ offset: number; limit: number }>();
  @Output() sortChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();

  searchText = '';
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  get displayColumns(): string[] {
    return [...this.columns.map((c) => c.key), '__actions__'];
  }

  onPage(e: PageEvent) {
    this.pageChange.emit({ offset: e.pageIndex * e.pageSize, limit: e.pageSize });
  }
  onSort(s: Sort) {
    if (!s.active || !s.direction) {
      this.sortChange.emit('');
      return;
    }
    this.sortChange.emit(s.direction === 'desc' ? `-${s.active}` : s.active);
  }
  onSearch(v: string) {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.searchChange.emit(v), 250);
  }
}

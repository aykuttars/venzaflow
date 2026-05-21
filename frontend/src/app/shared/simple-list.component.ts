import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { CrudService, Page } from './crud.service';
import { PageHeaderComponent } from './page-header.component';
import { AuthService } from '../core/auth.service';

export interface SimpleColumn {
  key: string;
  header: string;
  format?: (v: unknown) => string;
}

@Component({
  selector: 'app-simple-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header [title]="title" [icon]="icon">
        <ng-content select="[toolbar]"></ng-content>
      </app-page-header>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:280px">
        <mat-label>Search</mat-label>
        <input matInput (input)="onSearch($any($event.target).value)" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <table class="bms-table">
        <thead>
          <tr>
            @for (c of columns; track c.key) {
              <th>{{ c.header }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of items(); track row['id']) {
          <tr>
            @for (c of columns; track c.key) {
              <td>{{ format(row, c) }}</td>
            }
          </tr>
          }
          @if (items().length === 0) {
          <tr>
            <td [attr.colspan]="columns.length" style="text-align:center; padding:24px">
              No records.
            </td>
          </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
      table.bms-table th, table.bms-table td { padding: 10px 12px; }
      table.bms-table thead { background: rgba(0,0,0,.04); }
    `,
  ],
})
export class SimpleListComponent implements OnInit {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) path!: string;
  @Input({ required: true }) columns: SimpleColumn[] = [];

  private http = inject(HttpClient);
  private auth = inject(AuthService);
  items = signal<Record<string, unknown>[]>([]);
  private search = '';

  ngOnInit() { this.reload(); }

  protected onSearch(v: string) { this.search = v; this.reload(); }

  protected format(row: Record<string, unknown>, c: SimpleColumn) {
    const v = row[c.key];
    return c.format ? c.format(v) : v == null ? '' : String(v);
  }

  private reload() {
    const crud = new CrudService<Record<string, unknown>>(this.http, this.path, this.auth);
    crud
      .list({ limit: 100, search: this.search })
      .subscribe((p: Page<Record<string, unknown>>) => this.items.set(p.results));
  }
}

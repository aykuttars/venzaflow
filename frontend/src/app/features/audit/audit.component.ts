import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

import { API_BASE } from '../../core/api';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header title="Denetim kayıtları" icon="history"></app-page-header>
      <p style="color:rgba(0,0,0,.6);margin-bottom:12px">Salt okuma — son 200 kayıt</p>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:280px">
        <mat-label>Ara</mat-label>
        <input matInput (input)="filter.set($any($event.target).value)" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <table class="bms-table">
        <thead>
          <tr><th>Tarih</th><th>Kullanıcı</th><th>İşlem</th><th>Nesne</th><th>Değişiklik</th></tr>
        </thead>
        <tbody>
          @for (row of filtered(); track row.id) {
          <tr>
            <td>{{ row.timestamp }}</td>
            <td>{{ row.actor_email }}</td>
            <td>{{ row.action }}</td>
            <td>{{ row.object_repr }}</td>
            <td>{{ row.changes }}</td>
          </tr>
          }
          @if (filtered().length === 0) {
          <tr><td colspan="5" style="text-align:center;padding:24px">Kayıt yok.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `table.bms-table th, table.bms-table td { padding: 10px 12px; }
     table.bms-table thead { background: rgba(0,0,0,.04); }`,
  ],
})
export class AuditComponent implements OnInit {
  private http = inject(HttpClient);
  items = signal<any[]>([]);
  filter = signal('');

  filtered = () => {
    const q = this.filter().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (r) =>
        String(r.actor_email || '').toLowerCase().includes(q) ||
        String(r.object_repr || '').toLowerCase().includes(q) ||
        String(r.action || '').toLowerCase().includes(q)
    );
  };

  ngOnInit(): void {
    this.http.get<any>(`${API_BASE}/audit/`).subscribe({
      next: (data) =>
        this.items.set(Array.isArray(data) ? data : data?.results ?? []),
    });
  }
}

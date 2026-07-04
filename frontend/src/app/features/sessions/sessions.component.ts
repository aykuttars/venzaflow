import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

interface UserSession {
  id: number;
  user: number;
  user_email: string;
  user_name: string;
  client: 'web' | 'eimza' | 'ebarcode' | 'unknown';
  client_version: string;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
  last_seen_at: string | null;
  revoked: boolean;
  is_current: boolean;
}

// A session is considered "online" if seen within this window.
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    TranslateModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header titleKey="sessions.title" icon="devices">
        <button mat-stroked-button (click)="reload()">
          <mat-icon>refresh</mat-icon>
          {{ 'common.refresh' | translate }}
        </button>
      </app-page-header>
      <p class="subtitle">{{ 'sessions.subtitle' | translate }}</p>

      <table class="bms-table">
        <thead>
          <tr>
            <th>{{ 'sessions.user' | translate }}</th>
            <th>{{ 'sessions.client' | translate }}</th>
            <th>{{ 'sessions.status' | translate }}</th>
            <th>{{ 'sessions.ip' | translate }}</th>
            <th>{{ 'sessions.lastSeen' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (s of sessions(); track s.id) {
          <tr>
            <td>
              <strong>{{ s.user_name || s.user_email }}</strong>
              <div class="muted">{{ s.user_email }}</div>
            </td>
            <td>
              <span class="client-badge" [class.client-badge--eimza]="s.client === 'eimza'" [class.client-badge--ebarcode]="s.client === 'ebarcode'">
                <mat-icon>{{ s.client === 'eimza' ? 'draw' : s.client === 'ebarcode' ? 'qr_code_scanner' : 'public' }}</mat-icon>
                {{ ('sessions.clientType.' + s.client) | translate }}
                @if (s.client_version) { <small>v{{ s.client_version }}</small> }
              </span>
            </td>
            <td>
              <span class="dot" [class.dot--online]="isOnline(s)"></span>
              {{ (isOnline(s) ? 'sessions.online' : 'sessions.offline') | translate }}
              @if (s.is_current) { <em class="current">({{ 'sessions.current' | translate }})</em> }
            </td>
            <td>{{ s.ip_address || '—' }}</td>
            <td>{{ s.last_seen_at ? (s.last_seen_at | date: 'short') : '—' }}</td>
            <td style="text-align:right">
              <button
                mat-icon-button
                color="warn"
                [disabled]="s.is_current"
                [attr.aria-label]="'sessions.revoke' | translate"
                (click)="revoke(s)"
              >
                <mat-icon>logout</mat-icon>
              </button>
            </td>
          </tr>
          }
          @if (sessions().length === 0) {
          <tr>
            <td colspan="6" style="text-align:center;padding:24px">
              {{ 'common.noRecords' | translate }}
            </td>
          </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
      .subtitle {
        color: rgba(0, 0, 0, 0.6);
        margin: 0 0 16px;
      }
      table.bms-table th,
      table.bms-table td {
        padding: 10px 12px;
        vertical-align: middle;
      }
      table.bms-table thead {
        background: rgba(0, 0, 0, 0.04);
      }
      .muted {
        color: rgba(0, 0, 0, 0.5);
        font-size: 12px;
      }
      .client-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 14px;
        background: rgba(0, 0, 0, 0.06);
        font-size: 13px;
      }
      .client-badge mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .client-badge--eimza {
        background: rgba(37, 99, 235, 0.12);
        color: #1d4ed8;
      }
      .client-badge--ebarcode {
        background: rgba(13, 148, 136, 0.12);
        color: #0f766e;
      }
      .client-badge small {
        opacity: 0.7;
      }
      .dot {
        display: inline-block;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #9ca3af;
        margin-right: 6px;
      }
      .dot--online {
        background: #059669;
      }
      .current {
        color: rgba(0, 0, 0, 0.5);
        font-style: normal;
        font-size: 12px;
      }
    `,
  ],
})
export class SessionsComponent implements OnInit {
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private confirmDialog = inject(ConfirmDialogService);
  protected auth = inject(AuthService);

  sessions = signal<UserSession[]>([]);
  canRevoke = computed(() => this.auth.hasPermission('settings.write'));

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.http.get<UserSession[]>(`${API_BASE}/auth/sessions/`).subscribe({
      next: (rows) => this.sessions.set(rows),
      error: () => this.sessions.set([]),
    });
  }

  isOnline(s: UserSession): boolean {
    if (!s.last_seen_at) return false;
    return Date.now() - new Date(s.last_seen_at).getTime() < ONLINE_WINDOW_MS;
  }

  revoke(s: UserSession): void {
    this.confirmDialog
      .confirmDelete(s.user_email)
      .then((ok) => {
        if (!ok) return;
        this.http
          .post(`${API_BASE}/auth/sessions/${s.id}/revoke/`, {})
          .subscribe({
            next: () => {
              this.reload();
              this.snack.open(this.translate.instant('common.saved'), 'OK', {
                duration: 1500,
              });
            },
            error: (e) =>
              this.snack.open(
                e?.error?.detail || this.translate.instant('common.error'),
                'OK',
                { duration: 2500 }
              ),
          });
      });
  }
}

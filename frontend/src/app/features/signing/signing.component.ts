import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { EimzaDownloadDialogComponent } from './eimza-download-dialog.component';

type DocumentType = 'erecete' | 'earsiv' | 'efatura';

interface SignTask {
  id: number;
  document_type: DocumentType;
  title: string;
  description: string;
  status: 'pending' | 'prepared' | 'signed' | 'submitted' | 'failed';
  created_at: string;
  signer_email: string | null;
  signer_name: string;
  signed_at: string | null;
  submitted_at: string | null;
  external_reference: string;
  error_message: string;
}

interface Page<T> {
  results?: T[];
}

const TABS: DocumentType[] = ['erecete', 'earsiv', 'efatura'];

@Component({
  selector: 'app-signing',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="signing" icon="draw">
        <button mat-stroked-button type="button" (click)="openDownloadDialog()">
          <mat-icon>download</mat-icon>
          {{ 'eimzaDownload.button' | translate }}
        </button>
        @if (canConfigure()) {
        <a mat-stroked-button routerLink="/signing/integration">
          <mat-icon>hub</mat-icon>
          {{ 'signingIntegration.title' | translate }}
        </a>
        }
        <button mat-stroked-button (click)="loadTasks()">
          <mat-icon>refresh</mat-icon>
          {{ 'common.refresh' | translate }}
        </button>
      </app-page-header>

      <p class="subtitle">{{ 'signing.subtitle' | translate }}</p>

      <nav class="tabs">
        @for (t of tabs; track t) {
        <button [class.active]="activeTab() === t" (click)="setTab(t)">
          {{ ('signing.docType.' + t) | translate }}
        </button>
        }
      </nav>

      <table class="bms-table">
        <thead>
          <tr>
            <th>{{ 'signing.document' | translate }}</th>
            <th>{{ 'signing.status' | translate }}</th>
            <th>{{ 'signing.signer' | translate }}</th>
            <th>{{ 'signing.signedAt' | translate }}</th>
            <th>{{ 'signing.reference' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (t of tasks(); track t.id) {
          <tr>
            <td>
              <strong>{{ t.title }}</strong>
              @if (t.description) { <div class="muted">{{ t.description }}</div> }
            </td>
            <td>
              <span class="status status--{{ t.status }}">
                {{ ('signing.statusType.' + t.status) | translate }}
              </span>
              @if (t.status === 'failed' && t.error_message) {
              <div class="muted">{{ t.error_message }}</div>
              }
            </td>
            <td>
              @if (t.signer_email) {
              <strong>{{ t.signer_name || t.signer_email }}</strong>
              <div class="muted">{{ t.signer_email }}</div>
              } @else { — }
            </td>
            <td>{{ t.signed_at ? (t.signed_at | date: 'short') : '—' }}</td>
            <td>{{ t.external_reference || '—' }}</td>
          </tr>
          }
          @if (tasks().length === 0) {
          <tr>
            <td colspan="5" style="text-align:center;padding:24px">
              {{ loading() ? ('common.loading' | translate) : ('common.noRecords' | translate) }}
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
      .tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }
      .tabs button {
        border: none;
        background: none;
        padding: 10px 18px;
        cursor: pointer;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
        border-bottom: 2px solid transparent;
      }
      .tabs button.active {
        color: #1d4ed8;
        border-bottom-color: #1d4ed8;
        font-weight: 600;
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
      .status {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        background: rgba(0, 0, 0, 0.08);
      }
      .status--signed,
      .status--submitted {
        background: rgba(5, 150, 105, 0.14);
        color: #047857;
      }
      .status--failed {
        background: rgba(220, 38, 38, 0.14);
        color: #b91c1c;
      }
      .status--prepared {
        background: rgba(217, 119, 6, 0.14);
        color: #b45309;
      }
    `,
  ],
})
export class SigningComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);

  readonly tabs = TABS;
  activeTab = signal<DocumentType>('erecete');
  tasks = signal<SignTask[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    const doc = this.route.snapshot.queryParamMap.get('document_type');
    if (doc === 'erecete' || doc === 'earsiv' || doc === 'efatura') {
      this.activeTab.set(doc);
    }
    this.loadTasks();
  }

  canConfigure(): boolean {
    return this.auth.hasPermission('signing.write');
  }

  openDownloadDialog(): void {
    this.dialog.open(EimzaDownloadDialogComponent, {
      width: '760px',
      maxWidth: '95vw',
      autoFocus: false,
      disableClose: true,
    });
  }

  setTab(tab: DocumentType): void {
    this.activeTab.set(tab);
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.set(true);
    this.http
      .get<Page<SignTask> | SignTask[]>(
        `${API_BASE}/sign/tasks/?document_type=${this.activeTab()}&limit=200`
      )
      .subscribe({
        next: (data) => {
          const rows = Array.isArray(data) ? data : data.results ?? [];
          this.tasks.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.tasks.set([]);
          this.loading.set(false);
        },
      });
  }
}

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';

interface EbarcodePlatform {
  slug: string;
  label: string;
  hint: string;
  filename: string;
  download_url: string;
  published_at?: string | null;
}

type EbarcodeReleaseStatus = 'ok' | 'preview' | 'unavailable' | 'not_configured';

interface EbarcodeReleases {
  configured: boolean;
  status: EbarcodeReleaseStatus;
  version: string | null;
  platforms: EbarcodePlatform[];
}

@Component({
  selector: 'app-ebarcode-download',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    TranslateModule,
  ],
  template: `
    @if (embedded) {
      @if (releases()?.version) {
        <p class="version-line">
          {{ 'ebarcodeDownload.version' | translate: { version: releases()!.version } }}
        </p>
      } @else {
        <p class="version-line muted">{{ 'ebarcodeDownload.subtitle' | translate }}</p>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <ng-container *ngTemplateOutlet="body"></ng-container>
    } @else {
      <mat-card class="download-card" [class.download-card--standalone]="standalone">
        <mat-card-header>
          <mat-icon mat-card-avatar>qr_code_scanner</mat-icon>
          <mat-card-title>{{ 'ebarcodeDownload.title' | translate }}</mat-card-title>
          <mat-card-subtitle>
            @if (releases()?.version) {
              {{ 'ebarcodeDownload.version' | translate: { version: releases()!.version } }}
            } @else {
              {{ 'ebarcodeDownload.subtitle' | translate }}
            }
          </mat-card-subtitle>
        </mat-card-header>

        @if (loading()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }

        <mat-card-content>
          <ng-container *ngTemplateOutlet="body"></ng-container>
        </mat-card-content>
      </mat-card>
    }

    <ng-template #body>
      @if (errorKey()) {
        <p class="notice notice--error">{{ errorKey() | translate }}</p>
      } @else if (emptyKey()) {
        <p class="notice">{{ emptyKey() | translate }}</p>
      } @else {
        <div class="platform-grid">
          @for (p of releases()?.platforms ?? []; track p.slug) {
          <div class="platform-row">
            <div>
              <strong>{{ p.label }}</strong>
              <div class="muted">{{ p.hint }}</div>
              <div class="filename">{{ p.filename }}</div>
              @if (p.published_at) {
                <div class="published-at">
                  {{ 'ebarcodeDownload.publishedAt' | translate: { date: formatPublishedAt(p.published_at) } }}
                </div>
              }
            </div>
            <a mat-flat-button color="primary" [href]="p.download_url">
              <mat-icon>download</mat-icon>
              {{ 'ebarcodeDownload.download' | translate }}
            </a>
          </div>
          }
        </div>
      }
    </ng-template>
  `,
  styles: [
    `
      .download-card {
        margin-bottom: 20px;
      }
      .download-card--standalone {
        max-width: 720px;
        margin: 0 auto;
      }
      .version-line {
        margin: 0 0 12px;
        font-size: 14px;
      }
      .platform-grid {
        display: grid;
        gap: 12px;
      }
      .platform-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }
      .platform-row:last-child {
        border-bottom: none;
      }
      .muted {
        color: rgba(0, 0, 0, 0.55);
        font-size: 13px;
      }
      .filename {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
        margin-top: 2px;
        word-break: break-all;
      }
      .published-at {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.45);
        margin-top: 4px;
      }
      .notice {
        margin: 0;
        color: rgba(0, 0, 0, 0.65);
        line-height: 1.5;
      }
      .notice--error {
        color: #b00020;
      }
    `,
  ],
})
export class EbarcodeDownloadComponent implements OnInit {
  @Input() standalone = false;
  @Input() embedded = false;

  private http = inject(HttpClient);
  private translate = inject(TranslateService);

  loading = signal(true);
  errorKey = signal('');
  releases = signal<EbarcodeReleases | null>(null);

  emptyKey = computed(() => {
    const data = this.releases();
    if (!data || data.platforms.length > 0) {
      return '';
    }
    if (data.status === 'not_configured') {
      return 'ebarcodeDownload.notConfigured';
    }
    return 'ebarcodeDownload.unavailable';
  });

  formatPublishedAt(iso: string): string {
    const locale = this.translate.currentLang === 'en' ? 'en-GB' : 'tr-TR';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso));
  }

  ngOnInit(): void {
    this.http.get<EbarcodeReleases>(`${API_BASE}/barcode/ebarcode/releases/`).subscribe({
      next: (data) => {
        this.releases.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorKey.set('ebarcodeDownload.loadError');
        this.loading.set(false);
      },
    });
  }
}

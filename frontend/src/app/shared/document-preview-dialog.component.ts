import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

import { API_BASE } from '../core/api';

export interface DocumentPreviewDialogData {
  title: string;
  path: string;
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-document-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content class="preview-content">
      @if (loading()) {
      <div class="preview-loading">
        <mat-spinner diameter="36" />
        <span>{{ 'documentPreview.loading' | translate }}</span>
      </div>
      } @else if (error()) {
      <p class="preview-error">{{ error() }}</p>
      } @else {
      <iframe
        class="preview-frame"
        [attr.title]="data.title"
        sandbox=""
        [attr.srcdoc]="html() ?? ''"
      ></iframe>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close()">{{ 'common.close' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .preview-content {
        width: min(920px, 92vw);
        max-width: 100%;
        padding-top: 0;
      }
      .preview-frame {
        width: 100%;
        min-height: 420px;
        height: min(62vh, 680px);
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
        background: #fff;
      }
      .preview-loading {
        display: grid;
        place-items: center;
        gap: 12px;
        min-height: 240px;
        color: rgba(0, 0, 0, 0.6);
      }
      .preview-error {
        color: #b91c1c;
        margin: 0;
      }
    `,
  ],
})
export class DocumentPreviewDialogComponent {
  private http = inject(HttpClient);
  private dialogRef = inject(MatDialogRef<DocumentPreviewDialogComponent>);
  data = inject<DocumentPreviewDialogData>(MAT_DIALOG_DATA);

  loading = signal(true);
  error = signal<string | null>(null);
  html = signal<string | null>(null);

  constructor() {
    const params = new URLSearchParams(this.data.queryParams ?? {});
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const url = `${API_BASE}/${this.data.path.replace(/^\/+/, '')}${suffix}`;

    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (content) => {
        this.html.set(content);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Preview could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}

export function openDocumentPreview(dialog: MatDialog, data: DocumentPreviewDialogData): void {
  dialog.open(DocumentPreviewDialogComponent, {
    width: '960px',
    maxWidth: '96vw',
    autoFocus: false,
    data,
  });
}

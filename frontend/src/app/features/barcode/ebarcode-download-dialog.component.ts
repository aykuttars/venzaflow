import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { EbarcodeDownloadComponent } from './ebarcode-download.component';

@Component({
  selector: 'app-ebarcode-download-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TranslateModule,
    EbarcodeDownloadComponent,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>qr_code_scanner</mat-icon>
      <span>{{ 'ebarcodeDownload.title' | translate }}</span>
    </h2>

    <mat-dialog-content>
      <app-ebarcode-download [embedded]="true"></app-ebarcode-download>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.close' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
      }
      mat-dialog-content {
        padding-top: 8px;
        min-width: min(680px, 90vw);
      }
    `,
  ],
})
export class EbarcodeDownloadDialogComponent {}

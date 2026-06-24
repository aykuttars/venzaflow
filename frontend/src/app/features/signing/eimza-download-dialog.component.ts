import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { EimzaDownloadComponent } from './eimza-download.component';

@Component({
  selector: 'app-eimza-download-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TranslateModule,
    EimzaDownloadComponent,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon>download_for_offline</mat-icon>
      <span>{{ 'eimzaDownload.title' | translate }}</span>
    </h2>

    <mat-dialog-content>
      <app-eimza-download [embedded]="true"></app-eimza-download>
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
export class EimzaDownloadDialogComponent {}

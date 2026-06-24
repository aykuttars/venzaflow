import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { EimzaDownloadComponent } from './eimza-download.component';

@Component({
  selector: 'app-eimza-download-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    EimzaDownloadComponent,
  ],
  template: `
    <div class="page">
      <header class="header">
        <a mat-button routerLink="/login">
          <mat-icon>arrow_back</mat-icon>
          {{ 'auth.signIn' | translate }}
        </a>
      </header>
      <app-eimza-download [standalone]="true"></app-eimza-download>
    </div>
  `,
  styles: [
    `
      .page {
        min-height: 100vh;
        padding: 24px 16px 48px;
        background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
      }
      .header {
        max-width: 720px;
        margin: 0 auto 16px;
      }
    `,
  ],
})
export class EimzaDownloadPageComponent {}

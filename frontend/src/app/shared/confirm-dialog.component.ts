import { Component, HostListener, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { ConfirmDialogService } from './confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslateModule],
  template: `
    @if (confirm.state(); as cfg) {
    <div class="confirm-overlay" (click)="onCancel()"></div>
    <div
      class="confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      [attr.aria-labelledby]="'confirm-dialog-title'"
      (click)="$event.stopPropagation()"
    >
      <div class="confirm-dialog__icon-wrap">
        <mat-icon color="warn">delete_outline</mat-icon>
      </div>
      <h2 id="confirm-dialog-title" class="confirm-dialog__title">
        {{ cfg.title || ('common.delete' | translate) }}
      </h2>
      <p class="confirm-dialog__message">{{ cfg.message || ('common.confirmDelete' | translate) }}</p>
      @if (cfg.detail) {
      <p class="confirm-dialog__detail">{{ cfg.detail }}</p>
      }
      <div class="confirm-dialog__actions">
        <button mat-button type="button" (click)="onCancel()">
          {{ cfg.cancelLabel || ('common.cancel' | translate) }}
        </button>
        <button mat-flat-button color="warn" type="button" (click)="onConfirm()">
          {{ cfg.confirmLabel || ('common.delete' | translate) }}
        </button>
      </div>
    </div>
    }
  `,
  styles: [
    `
      .confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
        z-index: 100;
      }

      .confirm-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 101;
        width: min(400px, 92vw);
        padding: 24px;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        box-sizing: border-box;
        text-align: center;
      }

      .confirm-dialog__icon-wrap {
        display: flex;
        justify-content: center;
        margin-bottom: 8px;
      }

      .confirm-dialog__icon-wrap mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
      }

      .confirm-dialog__title {
        margin: 0 0 8px;
        font-size: 18px;
        font-weight: 500;
        line-height: 1.3;
        color: rgba(0, 0, 0, 0.87);
      }

      .confirm-dialog__message {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        color: rgba(0, 0, 0, 0.72);
      }

      .confirm-dialog__detail {
        margin: 10px 0 0;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.4;
        color: rgba(0, 0, 0, 0.87);
        word-break: break-word;
      }

      .confirm-dialog__actions {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-top: 20px;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  confirm = inject(ConfirmDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirm.state()) {
      this.onCancel();
    }
  }

  onConfirm(): void {
    this.confirm.close(true);
  }

  onCancel(): void {
    this.confirm.close(false);
  }
}

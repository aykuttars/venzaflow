import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface ConfirmDialogOptions {
  title?: string;
  message?: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmDialogState = ConfirmDialogOptions & { open: true };

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private translate = inject(TranslateService);
  private _state = signal<ConfirmDialogState | null>(null);
  private resolveFn: ((value: boolean) => void) | null = null;

  readonly state = this._state.asReadonly();

  open(options: ConfirmDialogOptions = {}): Promise<boolean> {
    if (this._state()) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      this.resolveFn = resolve;
      this._state.set({ open: true, ...options });
    });
  }

  confirmDelete(detail?: string): Promise<boolean> {
    return this.open({
      title: this.translate.instant('common.confirmDeleteTitle'),
      message: this.translate.instant('common.confirmDelete'),
      detail: detail?.trim() || undefined,
      confirmLabel: this.translate.instant('common.delete'),
      cancelLabel: this.translate.instant('common.cancel'),
    });
  }

  close(result: boolean): void {
    this._state.set(null);
    const resolve = this.resolveFn;
    this.resolveFn = null;
    resolve?.(result);
  }
}

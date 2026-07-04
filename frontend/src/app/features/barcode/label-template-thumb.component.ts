import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { BarcodeService, LabelTemplate } from './barcode.service';

@Component({
  selector: 'app-label-template-thumb',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="thumb" [class.thumb--loading]="loading()">
      @if (imageUrl()) {
      <img [src]="imageUrl()!" [alt]="template.name" />
      } @else if (loading()) {
      <div class="thumb__skeleton"></div>
      } @else {
      <mat-icon>label</mat-icon>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .thumb {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #fff;
        overflow: hidden;
      }
      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .thumb mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        opacity: 0.35;
        color: #546e7a;
      }
      .thumb__skeleton {
        width: 72%;
        height: 72%;
        border-radius: 4px;
        background: linear-gradient(90deg, #eceff1 25%, #f5f7fa 50%, #eceff1 75%);
        background-size: 200% 100%;
        animation: shimmer 1.2s infinite;
      }
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `,
  ],
})
export class LabelTemplateThumbComponent implements OnChanges, OnDestroy {
  private barcode = inject(BarcodeService);

  @Input({ required: true }) template!: LabelTemplate;

  imageUrl = signal<string | null>(null);
  loading = signal(false);

  private objectUrl: string | null = null;
  private requestKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['template']) {
      this.loadPreview();
    }
  }

  ngOnDestroy(): void {
    this.revokeUrl();
  }

  private loadPreview(): void {
    if (!this.template?.id || this.template.id <= 0) {
      this.revokeUrl();
      this.imageUrl.set(null);
      this.loading.set(false);
      return;
    }

    const key = `${this.template.id}:${this.layoutFingerprint()}`;
    if (key === this.requestKey && this.imageUrl()) return;

    this.requestKey = key;
    this.revokeUrl();
    this.imageUrl.set(null);
    this.loading.set(true);

    this.barcode.previewTemplate(this.template.id).subscribe({
      next: (blob) => {
        if (`${this.template.id}:${this.layoutFingerprint()}` !== key) return;
        this.objectUrl = URL.createObjectURL(blob);
        this.imageUrl.set(this.objectUrl);
        this.loading.set(false);
      },
      error: () => {
        if (`${this.template.id}:${this.layoutFingerprint()}` !== key) return;
        this.loading.set(false);
      },
    });
  }

  private layoutFingerprint(): string {
    const layout = this.template.layout_json || [];
    return layout.map((el) => `${el.id}:${el.x},${el.y},${el.width},${el.height}`).join('|');
  }

  private revokeUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

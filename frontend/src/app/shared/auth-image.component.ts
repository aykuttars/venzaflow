import { HttpClient } from '@angular/common/http';
import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';

import { API_BASE } from '../core/api';

@Component({
  selector: 'app-auth-image',
  standalone: true,
  template: `
    @if (src()) {
      <img [src]="src()!" [alt]="alt" [class]="className" [style]="style" />
    } @else if (placeholder) {
      <span [class]="className" [style]="style" class="auth-image__placeholder">{{ placeholder }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      img,
      .auth-image__placeholder {
        object-fit: cover;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.06);
      }
    `,
  ],
})
export class AuthImageComponent implements OnInit, OnDestroy {
  @Input({ required: true }) url = '';
  @Input() alt = '';
  @Input() className = '';
  @Input() style = '';
  @Input() placeholder = '';

  private http = inject(HttpClient);
  src = signal<string | null>(null);
  private objectUrl: string | null = null;

  ngOnInit(): void {
    if (!this.url) return;
    this.http.get(this.url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.revoke();
        this.objectUrl = URL.createObjectURL(blob);
        this.src.set(this.objectUrl);
      },
      error: () => this.src.set(null),
    });
  }

  ngOnDestroy(): void {
    this.revoke();
  }

  private revoke(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

export function patientPhotoUrl(patientId: number | string): string {
  return `${API_BASE}/patients/${patientId}/photo/`;
}

import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DetailFieldConfig, ProductRow } from './models';

@Component({
  selector: 'app-dynamic-product-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    @for (section of sections; track section) {
    <section class="detail-section">
      <h3 class="detail-section__title">{{ section }}</h3>
      <div class="detail-grid">
        @for (field of fieldsForSection(section); track field.field_key) {
        <div class="detail-field">
          <span class="detail-field__label">{{ field.label || field.field_key }}</span>
          <span class="detail-field__value">{{ displayValue(field) }}</span>
        </div>
        }
      </div>
    </section>
    }
  `,
  styles: [
    `
      .detail-section {
        margin-bottom: 20px;
      }
      .detail-section__title {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.65;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px 16px;
      }
      .detail-field {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .detail-field__label {
        font-size: 11px;
        opacity: 0.65;
      }
      .detail-field__value {
        font-size: 14px;
      }
    `,
  ],
})
export class DynamicProductDetailComponent {
  @Input() config: DetailFieldConfig[] = [];
  @Input() product!: ProductRow;

  get sections(): string[] {
    const set = new Set(
      this.config.filter((c) => c.is_visible).map((c) => c.section || 'Genel Bilgiler')
    );
    return [...set];
  }

  fieldsForSection(section: string): DetailFieldConfig[] {
    return this.config
      .filter((c) => c.is_visible && (c.section || 'Genel Bilgiler') === section)
      .sort((a, b) => a.order - b.order);
  }

  displayValue(field: DetailFieldConfig): string {
    const key = field.field_key;
    if (field.field_source === 'DYNAMIC') {
      const v = this.product.dynamic_fields?.[key];
      return v == null ? '—' : String(v);
    }
    const v = this.product[key];
    if (key === 'is_active') return v ? '✓' : '—';
    return v == null || v === '' ? '—' : String(v);
  }
}

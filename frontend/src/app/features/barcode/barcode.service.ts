import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE } from '../../core/api';

export interface LabelElement {
  id: string;
  type: 'text' | 'barcode_1d' | 'qr' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  font_size?: number;
  font_bold?: boolean;
  align?: string;
  data_binding?: string;
  static_text?: string;
  symbology?: string;
  show_text?: boolean;
  qr_mode?: string;
}

export interface LabelTemplate {
  id: number;
  name: string;
  description: string;
  width_mm: string;
  height_mm: string;
  gap_mm: string;
  dpi: number;
  layout_json: LabelElement[];
  source: string;
  default_key: string;
  is_active: boolean;
}

export interface BarcodeLookupResult {
  product: {
    id: number;
    sku: string;
    name: string;
    barcode: string;
    unit_price: string;
    category: string;
    marka: string;
    fields: Record<string, string>;
  };
  stock: {
    depo_quantity: number;
    magaza_quantity: number;
    total_quantity: number;
    breakdown: Array<{
      warehouse_code: string;
      warehouse_name: string;
      location_code: string | null;
      quantity: number;
    }>;
  };
  suggest_transfer: boolean;
}

export interface PrintJob {
  id: number;
  template: number;
  template_name: string;
  product_ids: number[];
  status: string;
  copies: number;
}

@Injectable({ providedIn: 'root' })
export class BarcodeService {
  private http = inject(HttpClient);
  private base = `${API_BASE}/barcode`;

  lookup(code: string): Observable<BarcodeLookupResult> {
    return this.http.get<BarcodeLookupResult>(`${this.base}/lookup/`, {
      params: { code },
    });
  }

  listTemplates(): Observable<LabelTemplate[]> {
    return this.http.get<{ results: LabelTemplate[] } | LabelTemplate[]>(`${this.base}/templates/`).pipe(
      // handle paginated or plain list
    ) as Observable<LabelTemplate[]>;
  }

  getTemplates(): Observable<LabelTemplate[]> {
    return new Observable((sub) => {
      this.http
        .get<{ results?: LabelTemplate[] } | LabelTemplate[]>(`${this.base}/templates/`)
        .subscribe({
          next: (res) => {
            const list = Array.isArray(res) ? res : (res.results ?? []);
            sub.next(list);
            sub.complete();
          },
          error: (e) => sub.error(e),
        });
    });
  }

  saveTemplate(t: Partial<LabelTemplate> & { id?: number }): Observable<LabelTemplate> {
    if (t.id) {
      return this.http.patch<LabelTemplate>(`${this.base}/templates/${t.id}/`, t);
    }
    return this.http.post<LabelTemplate>(`${this.base}/templates/`, t);
  }

  duplicateTemplate(id: number, name?: string): Observable<LabelTemplate> {
    return this.http.post<LabelTemplate>(`${this.base}/templates/${id}/duplicate/`, { name: name ?? '' });
  }

  seedDefaults(): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.base}/templates/seed-defaults/`, {});
  }

  previewTemplate(id: number, productId?: number): Observable<Blob> {
    return this.http.post(
      `${this.base}/templates/${id}/preview/`,
      { product_id: productId ?? null },
      { responseType: 'blob' }
    );
  }

  createPrintJob(templateId: number, productIds: number[], copies = 1): Observable<PrintJob> {
    return this.http.post<PrintJob>(`${this.base}/print-jobs/`, {
      template_id: templateId,
      product_ids: productIds,
      copies,
    });
  }

  getPrintJobTspl(jobId: number): Observable<{ tspl: string }> {
    return this.http.get<{ tspl: string }>(`${this.base}/print-jobs/${jobId}/tspl/`);
  }

  transfer(items: Array<{ product_id: number; quantity: number }>, note = ''): Observable<{ transfers?: unknown[]; errors?: unknown[] }> {
    return this.http.post<{ transfers?: unknown[]; errors?: unknown[] }>(`${this.base}/transfers/`, {
      source_warehouse_code: 'DEPO',
      target_warehouse_code: 'MAGAZA',
      note,
      items,
    });
  }

  generateMissing(limit = 100): Observable<{ generated: number }> {
    return this.http.post<{ generated: number }>(`${this.base}/generate/`, { limit });
  }
}

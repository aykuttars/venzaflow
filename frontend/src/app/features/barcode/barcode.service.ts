import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { API_BASE } from '../../core/api';

export interface LabelElement {
  id: string;
  type: 'text' | 'barcode_1d' | 'qr' | 'line' | 'image';
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
  allowed_department_keys?: string[];
  is_active: boolean;
  layout_warnings?: string[];
}

export interface LabelBindingField {
  binding: string;
  label: string;
  group: 'core' | 'dynamic' | 'label';
  element_type: 'text' | 'barcode_1d';
}

export interface BarcodeSettings {
  scan_miss_action: string;
  normalize_tr_scan: boolean;
  qr_content_mode: string;
  qr_max_length: number;
  ean_prefix: string;
  auto_generate_on_create: boolean;
  operation_flags: Record<string, boolean>;
  stock_deduction_mode: string;
  print_mode: string;
  default_copies: number;
  default_transfer_qty: number;
  default_label_template?: number | null;
  service_intake_shop_template?: number | null;
  service_intake_customer_template?: number | null;
  printer_model: string;
  printer_profile_json: Record<string, unknown>;
  label_logo_url?: string | null;
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
  suggested_template?: { id: number; name: string; width_mm: string; height_mm: string } | null;
  template_source?: string;
}

export interface ResolvedLabelTemplate {
  template: { id: number; name: string; width_mm: string; height_mm: string } | null;
  source: string;
}

export interface BarcodeLookupMiss {
  detail: string;
  found: false;
  code: string;
  scan_miss_action: string;
}

export interface PrintJob {
  id: number;
  template: number;
  template_name: string;
  product_ids: number[];
  status: string;
  copies: number;
  error_message?: string;
}

export interface PrintBatchItem {
  product_id: number;
  sku: string;
  name: string;
  barcode: string;
  copies: number;
}

@Injectable({ providedIn: 'root' })
export class BarcodeService {
  private http = inject(HttpClient);
  private base = `${API_BASE}/barcode`;

  lookup(code: string, opts?: { warehouse_id?: number; location_id?: number }): Observable<BarcodeLookupResult> {
    const params: Record<string, string> = { code };
    if (opts?.warehouse_id != null) params['warehouse_id'] = String(opts.warehouse_id);
    if (opts?.location_id != null) params['location_id'] = String(opts.location_id);
    return this.http.get<BarcodeLookupResult>(`${this.base}/lookup/`, { params });
  }

  resolveTemplate(opts: {
    product_id?: number;
    warehouse_id?: number;
    location_id?: number;
  }): Observable<ResolvedLabelTemplate> {
    const params: Record<string, string> = {};
    if (opts.product_id != null) params['product_id'] = String(opts.product_id);
    if (opts.warehouse_id != null) params['warehouse_id'] = String(opts.warehouse_id);
    if (opts.location_id != null) params['location_id'] = String(opts.location_id);
    return this.http.get<ResolvedLabelTemplate>(`${this.base}/templates/resolve/`, { params });
  }

  getSettings(): Observable<BarcodeSettings> {
    return this.http.get<BarcodeSettings>(`${this.base}/settings/`);
  }

  getEffectiveSettings(): Observable<BarcodeSettings & { printer_profile?: Record<string, unknown> }> {
    return this.http.get<BarcodeSettings & { printer_profile?: Record<string, unknown> }>(
      `${this.base}/settings/effective/`
    );
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

  getBindingFields(): Observable<LabelBindingField[]> {
    return this.http.get<LabelBindingField[]>(`${this.base}/templates/binding-fields/`);
  }

  saveTemplate(t: Partial<LabelTemplate> & { id?: number }): Observable<LabelTemplate> {
    if (t.id) {
      return this.http.patch<LabelTemplate>(`${this.base}/templates/${t.id}/`, t);
    }
    return this.http.post<LabelTemplate>(`${this.base}/templates/`, t);
  }

  deleteTemplate(id: number): Observable<{ detail: string; cancelled_jobs?: number; archived?: boolean }> {
    return this.http.delete<{ detail: string; cancelled_jobs?: number; archived?: boolean }>(
      `${this.base}/templates/${id}/`
    );
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

  createPrintBatch(
    templateId: number,
    items: Array<{ product_id: number; copies: number }>,
    immediate = false
  ): Observable<PrintJob[]> {
    return this.http.post<PrintJob[]>(`${this.base}/print-jobs/batch/`, {
      template_id: templateId,
      items,
      immediate,
    });
  }

  uploadLogo(file: File): Observable<BarcodeSettings> {
    const fd = new FormData();
    fd.append('label_logo', file);
    return this.http.patch<BarcodeSettings>(`${this.base}/settings/`, fd);
  }

  listPrintJobs(): Observable<PrintJob[]> {
    return new Observable((sub) => {
      this.http.get<{ results?: PrintJob[] } | PrintJob[]>(`${this.base}/print-jobs/`).subscribe({
        next: (res) => {
          sub.next(Array.isArray(res) ? res : (res.results ?? []));
          sub.complete();
        },
        error: (e) => sub.error(e),
      });
    });
  }

  cancelPrintJob(id: number, reason?: string): Observable<PrintJob> {
    return this.http.post<PrintJob>(`${this.base}/print-jobs/${id}/cancel/`, { reason: reason ?? '' });
  }

  getPrintJobTspl(jobId: number): Observable<{ tspl: string }> {
    return this.http.get<{ tspl: string }>(`${this.base}/print-jobs/${jobId}/tspl/`);
  }

  downloadTspl(jobId: number): Observable<Blob> {
    return this.getPrintJobTspl(jobId).pipe(map((r) => new Blob([r.tspl], { type: 'text/plain' })));
  }

  transfer(items: Array<{ product_id: number; quantity: number }>, note = ''): Observable<{ transfers?: unknown[]; errors?: unknown[] }> {
    return this.http.post<{ transfers?: unknown[]; errors?: unknown[] }>(`${this.base}/transfers/`, {
      source_warehouse_code: 'DEPO',
      target_warehouse_code: 'MAGAZA',
      note,
      items,
    });
  }

  generateMissing(limit = 100, productId?: number): Observable<{ generated: number; remaining?: number }> {
    return this.http.post<{ generated: number; remaining?: number }>(`${this.base}/generate/`, {
      limit,
      product_id: productId ?? null,
    });
  }

  scanMissAssign(code: string, productId: number): Observable<BarcodeLookupResult> {
    return this.http.post<BarcodeLookupResult>(`${this.base}/scan-miss/assign/`, {
      code,
      product_id: productId,
    });
  }

  scanMissCreateStep1(code: string, name: string): Observable<{ product_id: number; barcode: string }> {
    return this.http.post<{ product_id: number; barcode: string }>(`${this.base}/scan-miss/create/`, {
      step: 1,
      code,
      name,
    });
  }

  scanMissCreateStep2(
    productId: number,
    extra: { unit_price?: number | null; cost_price?: number | null }
  ): Observable<{ product: BarcodeLookupResult }> {
    return this.http.post<{ product: BarcodeLookupResult }>(`${this.base}/scan-miss/create/`, {
      step: 2,
      product_id: productId,
      ...extra,
    });
  }

  manualStockDeduction(productId: number, quantity = 1): Observable<{ movement_id: number }> {
    return this.http.post<{ movement_id: number }>(`${this.base}/stock/manual-deduct/`, {
      product_id: productId,
      quantity,
    });
  }
}

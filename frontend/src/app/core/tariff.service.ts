import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from './api';

export interface DentalTariff {
  id: number;
  year: number;
  title: string;
  is_active: boolean;
}

export interface TariffSection {
  section_no: number;
  section_name: string;
}

export interface TenantTariffItem {
  id: number;
  section_no: number;
  section_name: string;
  code: string;
  name: string;
  reference_incl: string;
  floor_incl: string;
  clinic_incl: string;
  is_customizable: boolean;
  floor_bumped: boolean;
}

export interface TariffItemPage {
  count: number;
  page: number;
  page_size: number;
  vat_rate: string;
  bumped_count: number;
  results: TenantTariffItem[];
}

export interface TariffViolation {
  procedure_id: number;
  procedure_code: string;
  procedure_name: string;
  current_price: string;
  floor_price: string;
  tariff_code: string;
  tariff_item_name: string;
  tariff_year: number;
}

@Injectable({ providedIn: 'root' })
export class TariffService {
  private http = inject(HttpClient);

  getActive(): Observable<{
    configured: boolean;
    tariff: DentalTariff | null;
    sections: TariffSection[];
  }> {
    return this.http.get<{
      configured: boolean;
      tariff: DentalTariff | null;
      sections: TariffSection[];
    }>(`${API_BASE}/tariff/`);
  }

  listItems(opts: {
    q?: string;
    section?: number;
    page?: number;
    page_size?: number;
    only_bumped?: boolean;
  } = {}): Observable<TariffItemPage> {
    let params = new HttpParams();
    if (opts.q) params = params.set('q', opts.q);
    if (opts.section != null) params = params.set('section', String(opts.section));
    if (opts.page != null) params = params.set('page', String(opts.page));
    if (opts.page_size != null) params = params.set('page_size', String(opts.page_size));
    if (opts.only_bumped) params = params.set('only_bumped', 'true');
    return this.http.get<TariffItemPage>(`${API_BASE}/tariff/items/`, { params });
  }

  /** Legacy autocomplete helper */
  searchItems(q: string, section?: number): Observable<{ count: number; results: TenantTariffItem[] }> {
    return this.listItems({ q, section, page: 1, page_size: 50 });
  }

  updateClinicPrice(
    itemId: number,
    body: { clinic_price_incl_vat: string }
  ): Observable<TenantTariffItem> {
    return this.http.patch<TenantTariffItem>(`${API_BASE}/tariff/items/${itemId}/clinic-price/`, body);
  }

  syncProcedures(): Observable<{ synced: number; created: number; updated: number }> {
    return this.http.post<{ synced: number; created: number; updated: number }>(
      `${API_BASE}/tariff/sync-procedures/`,
      {}
    );
  }

  getViolations(): Observable<{ tariff_year: number | null; count: number; violations: TariffViolation[] }> {
    return this.http.get<{ tariff_year: number | null; count: number; violations: TariffViolation[] }>(
      `${API_BASE}/tariff/violations/`
    );
  }
}

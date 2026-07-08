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

export interface DentalTariffItem {
  id: number;
  section_no: number;
  section_name: string;
  code: string;
  name: string;
  price_excl_vat: string;
  price_incl_vat: string;
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

  getActive(): Observable<{ configured: boolean; tariff: DentalTariff | null }> {
    return this.http.get<{ configured: boolean; tariff: DentalTariff | null }>(`${API_BASE}/tariff/`);
  }

  searchItems(q: string, section?: number): Observable<{ count: number; results: DentalTariffItem[] }> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (section != null) params = params.set('section', String(section));
    return this.http.get<{ count: number; results: DentalTariffItem[] }>(`${API_BASE}/tariff/items/`, {
      params,
    });
  }

  getViolations(): Observable<{ tariff_year: number | null; count: number; violations: TariffViolation[] }> {
    return this.http.get<{ tariff_year: number | null; count: number; violations: TariffViolation[] }>(
      `${API_BASE}/tariff/violations/`
    );
  }
}

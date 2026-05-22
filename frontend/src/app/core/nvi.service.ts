import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from './api';

export interface NviListItem {
  code: number;
  name: string;
}

export interface NviIdentityVerifyPayload {
  nationality: 'tc' | 'foreign';
  first_name: string;
  last_name: string;
  birth_date: string;
  tckn?: string;
  foreign_id?: string;
}

export interface NviIdentityVerifyResult {
  verified: boolean;
  reference: string;
  normalized_first_name: string;
  normalized_last_name: string;
  verified_at: string;
}

export interface NviOpenAddress {
  address_code: number;
  full_address: string;
  building_no: string;
  apartment_no: string;
  block_name: string;
  resolved_at?: 'unit' | 'building';
}

@Injectable({ providedIn: 'root' })
export class NviService {
  private http = inject(HttpClient);

  listProvinces(): Observable<NviListItem[]> {
    return this.http.get<NviListItem[]>(`${API_BASE}/nvi/address/provinces/`);
  }

  listDistricts(il: number): Observable<NviListItem[]> {
    return this.http.get<NviListItem[]>(`${API_BASE}/nvi/address/districts/`, {
      params: { il: String(il) },
    });
  }

  listNeighborhoods(ilce: number): Observable<NviListItem[]> {
    return this.http.get<NviListItem[]>(`${API_BASE}/nvi/address/neighborhoods/`, {
      params: { ilce: String(ilce) },
    });
  }

  listStreets(mahalle: number): Observable<NviListItem[]> {
    return this.http.get<NviListItem[]>(`${API_BASE}/nvi/address/streets/`, {
      params: { mahalle: String(mahalle) },
    });
  }

  listBuildings(mahalle: number, yol: number): Observable<NviListItem[]> {
    return this.http.get<NviListItem[]>(`${API_BASE}/nvi/address/buildings/`, {
      params: { mahalle: String(mahalle), yol: String(yol) },
    });
  }

  listUnits(mahalle: number, bina: number): Observable<NviListItem[]> {
    return this.http.get<NviListItem[]>(`${API_BASE}/nvi/address/units/`, {
      params: { mahalle: String(mahalle), bina: String(bina) },
    });
  }

  getOpenAddress(
    mahalle: number,
    opts: { unit?: number; bina?: number }
  ): Observable<NviOpenAddress> {
    const params: Record<string, string> = { mahalle: String(mahalle) };
    if (opts.unit != null) params['unit'] = String(opts.unit);
    if (opts.bina != null) params['bina'] = String(opts.bina);
    return this.http.get<NviOpenAddress>(`${API_BASE}/nvi/address/open/`, { params });
  }

  verifyIdentity(payload: NviIdentityVerifyPayload): Observable<NviIdentityVerifyResult> {
    return this.http.post<NviIdentityVerifyResult>(`${API_BASE}/nvi/identity/verify/`, payload);
  }
}

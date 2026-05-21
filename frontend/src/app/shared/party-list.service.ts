import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';

import { API_BASE } from '../core/api';
import { AuthService } from '../core/auth.service';

export interface PartyRow {
  id: number;
  first_name: string;
  last_name: string;
  full_name?: string;
  phone?: string;
  email?: string;
  kind?: 'customer' | 'patient';
}

interface Page<T> {
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class PartyListService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  /** Customers and/or patients for cross-module pickers (appointments, billing). */
  listParties(limit = 200): Observable<PartyRow[]> {
    const requests: Observable<PartyRow[]>[] = [];
    if (this.auth.hasModule('customers') && this.auth.canAccessApiPath('customers/')) {
      requests.push(this.fetchResource('customers', 'customer', limit));
    }
    if (this.auth.hasModule('patients') && this.auth.canAccessApiPath('patients/')) {
      requests.push(this.fetchResource('patients', 'patient', limit));
    }
    if (requests.length === 0) {
      return of([]);
    }
    return forkJoin(requests).pipe(
      map((groups) => {
        const merged: PartyRow[] = [];
        const seen = new Set<number>();
        for (const group of groups) {
          for (const row of group) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            merged.push(row);
          }
        }
        return merged.sort((a, b) =>
          (a.last_name || '').localeCompare(b.last_name || '', undefined, { sensitivity: 'base' })
        );
      })
    );
  }

  hasAnyPartyModule(): boolean {
    return this.auth.hasModule('customers') || this.auth.hasModule('patients');
  }

  private fetchResource(
    resource: string,
    kind: 'customer' | 'patient',
    limit: number
  ): Observable<PartyRow[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<Page<PartyRow>>(`${API_BASE}/${resource}/`, { params }).pipe(
      map((page) =>
        page.results.map((row) => ({
          ...row,
          kind,
          full_name: row.full_name || `${row.first_name} ${row.last_name}`.trim(),
        }))
      )
    );
  }
}

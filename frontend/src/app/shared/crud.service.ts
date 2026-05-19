import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE } from '../core/api';

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class CrudService<T extends { id?: number | string }> {
  constructor(
    protected http: HttpClient,
    protected path: string,
  ) {}

  list(params: {
    offset?: number;
    limit?: number;
    search?: string;
    ordering?: string;
    extra?: Record<string, string | number | undefined>;
  } = {}): Observable<Page<T>> {
    let p = new HttpParams();
    if (params.offset != null) p = p.set('offset', String(params.offset));
    if (params.limit != null) p = p.set('limit', String(params.limit));
    if (params.search) p = p.set('search', params.search);
    if (params.ordering) p = p.set('ordering', params.ordering);
    for (const [k, v] of Object.entries(params.extra || {})) {
      if (v != null && v !== '') p = p.set(k, String(v));
    }
    return this.http.get<Page<T>>(`${API_BASE}/${this.path}/`, { params: p });
  }

  get(id: number | string): Observable<T> {
    return this.http.get<T>(`${API_BASE}/${this.path}/${id}/`);
  }
  create(body: Partial<T>): Observable<T> {
    return this.http.post<T>(`${API_BASE}/${this.path}/`, body);
  }
  update(id: number | string, body: Partial<T>): Observable<T> {
    return this.http.patch<T>(`${API_BASE}/${this.path}/${id}/`, body);
  }
  remove(id: number | string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/${this.path}/${id}/`);
  }
}

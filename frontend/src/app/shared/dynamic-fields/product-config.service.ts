import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../../core/api';
import {
  DetailFieldConfig,
  FormFieldConfig,
  ListColumnConfig,
  ProductFieldDefinition,
} from './models';

@Injectable({ providedIn: 'root' })
export class ProductConfigService {
  private http = inject(HttpClient);
  private base = `${API_BASE}/products`;

  listFieldDefinitions(): Observable<ProductFieldDefinition[]> {
    return this.http.get<ProductFieldDefinition[] | { results: ProductFieldDefinition[] }>(
      `${this.base}/field-definitions/`,
      { params: { limit: '500' } }
    ) as Observable<ProductFieldDefinition[]>;
  }

  listColumnConfig(): Observable<ListColumnConfig[]> {
    return this.http.get<ListColumnConfig[] | { results: ListColumnConfig[] }>(
      `${this.base}/list-config/`,
      { params: { limit: '200' } }
    ) as Observable<ListColumnConfig[]>;
  }

  formConfig(): Observable<FormFieldConfig[]> {
    return this.http.get<FormFieldConfig[] | { results: FormFieldConfig[] }>(
      `${this.base}/form-config/`,
      { params: { limit: '200' } }
    ) as Observable<FormFieldConfig[]>;
  }

  detailConfig(): Observable<DetailFieldConfig[]> {
    return this.http.get<DetailFieldConfig[] | { results: DetailFieldConfig[] }>(
      `${this.base}/detail-config/`,
      { params: { limit: '200' } }
    ) as Observable<DetailFieldConfig[]>;
  }
}

/** Normalize paginated or plain array API responses. */
export function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

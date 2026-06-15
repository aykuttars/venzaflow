import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from './api';
import { Page } from '../shared/crud.service';

export interface DrugCatalogItem {
  id: number;
  barkod: string;
  name: string;
  form: string;
  strength: string;
  unit: string;
}

export interface PrescriptionLine {
  id?: number;
  drug?: number | null;
  drug_barkod?: string;
  drug_name: string;
  box_count: number;
  quantity_per_box: number;
  dose: string;
  frequency: string;
  period_days: number;
  route: string;
  usage_instruction: string;
  sort_order?: number;
}

export interface Prescription {
  id: number;
  prescription_no: string;
  patient: number;
  patient_name: string;
  doctor: number | null;
  doctor_name: string;
  diagnosis_code: string;
  diagnosis_text: string;
  prescription_type: string;
  provision_type: string;
  status: 'draft' | 'ready' | 'submitted' | 'cancelled';
  medula_reference: string;
  notes: string;
  finalized_at: string | null;
  submitted_at: string | null;
  line_count: number;
  lines: PrescriptionLine[];
}

@Injectable({ providedIn: 'root' })
export class PrescriptionService {
  private http = inject(HttpClient);

  list(patientId: number): Observable<Page<Prescription>> {
    return this.http.get<Page<Prescription>>(`${API_BASE}/prescriptions/`, {
      params: { patient: String(patientId), limit: '100' },
    });
  }

  get(id: number): Observable<Prescription> {
    return this.http.get<Prescription>(`${API_BASE}/prescriptions/${id}/`);
  }

  create(body: Partial<Prescription> & { lines: PrescriptionLine[] }): Observable<Prescription> {
    return this.http.post<Prescription>(`${API_BASE}/prescriptions/`, body);
  }

  update(id: number, body: Partial<Prescription> & { lines?: PrescriptionLine[] }): Observable<Prescription> {
    return this.http.patch<Prescription>(`${API_BASE}/prescriptions/${id}/`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/prescriptions/${id}/`);
  }

  finalize(id: number): Observable<Prescription> {
    return this.http.post<Prescription>(`${API_BASE}/prescriptions/${id}/finalize/`, {});
  }

  cancel(id: number): Observable<Prescription> {
    return this.http.post<Prescription>(`${API_BASE}/prescriptions/${id}/cancel/`, {});
  }

  fetchPreviewHtml(id: number): Observable<string> {
    return this.http.get(`${API_BASE}/prescriptions/${id}/preview/`, {
      responseType: 'text',
    });
  }
}

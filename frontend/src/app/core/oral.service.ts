import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../core/api';
import { Page } from '../shared/crud.service';

export interface ProcedureCatalog {
  id: number;
  code: string;
  name: string;
  category: 'diagnosis' | 'planning' | 'treatment';
  default_price: string;
  is_frequent: boolean;
  default_tooth_condition?: string;
}

export interface OralTreatment {
  id: number;
  patient: number;
  procedure: number;
  procedure_name: string;
  tooth_numbers: number[];
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  phase: string;
  unit_price: string;
  session_date: string | null;
  performed_at: string | null;
  notes: string;
  doctor_name?: string;
}

export interface PatientOralChart {
  id: number;
  patient: number;
  jaw_type: 'permanent' | 'primary' | 'mixed';
  teeth_state: Record<string, { condition?: string; notes?: string }>;
}

@Injectable({ providedIn: 'root' })
export class OralService {
  private http = inject(HttpClient);

  listProcedures(params: {
    category?: string;
    search?: string;
    is_frequent?: boolean;
  } = {}): Observable<Page<ProcedureCatalog>> {
    let p = new HttpParams().set('limit', '200');
    if (params.category) p = p.set('category', params.category);
    if (params.search) p = p.set('search', params.search);
    if (params.is_frequent) p = p.set('is_frequent', 'true');
    return this.http.get<Page<ProcedureCatalog>>(`${API_BASE}/oral/procedures/`, { params: p });
  }

  listTreatments(patientId: number): Observable<Page<OralTreatment>> {
    const params = new HttpParams().set('patient', String(patientId)).set('limit', '500');
    return this.http.get<Page<OralTreatment>>(`${API_BASE}/oral/treatments/`, { params });
  }

  bulkCreate(payload: {
    patient: number;
    procedure: number;
    tooth_numbers: number[];
    status?: string;
    notes?: string;
  }): Observable<OralTreatment[]> {
    return this.http.post<OralTreatment[]>(`${API_BASE}/oral/treatments/bulk/`, payload);
  }

  updateTreatment(id: number, body: Partial<OralTreatment>): Observable<OralTreatment> {
    return this.http.patch<OralTreatment>(`${API_BASE}/oral/treatments/${id}/`, body);
  }

  deleteTreatment(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/oral/treatments/${id}/`);
  }

  getChart(patientId: number): Observable<PatientOralChart> {
    return this.http.get<PatientOralChart>(`${API_BASE}/oral/charts/${patientId}/`);
  }

  patchChart(patientId: number, body: Partial<PatientOralChart>): Observable<PatientOralChart> {
    return this.http.patch<PatientOralChart>(`${API_BASE}/oral/charts/${patientId}/`, body);
  }
}

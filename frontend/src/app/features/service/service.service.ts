import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { API_BASE } from '../../core/api';

export type ServiceTicketStatus =
  | 'received'
  | 'diagnosing'
  | 'awaiting_approval'
  | 'in_repair'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export interface ServiceTicketEvent {
  id: number;
  from_status: string;
  to_status: string;
  note: string;
  created_by_email: string;
  created_at: string;
}

export interface ServiceTicket {
  id: number;
  ticket_number: string;
  customer: number | null;
  customer_name: string;
  customer_phone: string;
  customer_display: string;
  device_brand: string;
  device_model: string;
  device_serial: string;
  device_summary: string;
  complaint: string;
  diagnosis: string;
  estimated_price: string | null;
  final_price: string | null;
  payment_method: string;
  payment_received_at: string | null;
  status: ServiceTicketStatus;
  assigned_to: number | null;
  received_at: string;
  diagnosed_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  notes: string;
  events: ServiceTicketEvent[];
}

export interface ServiceDashboard {
  open_count: number;
  awaiting_approval: number;
  ready_count: number;
  delivered_today: number;
}

export interface ServiceTicketLookup {
  found: boolean;
  count?: number;
  tickets?: Pick<
    ServiceTicket,
    | 'id'
    | 'ticket_number'
    | 'customer_name'
    | 'customer_phone'
    | 'device_summary'
    | 'status'
    | 'estimated_price'
    | 'final_price'
    | 'received_at'
  >[];
  ticket?: Pick<
    ServiceTicket,
    | 'id'
    | 'ticket_number'
    | 'customer_name'
    | 'customer_phone'
    | 'device_summary'
    | 'status'
    | 'estimated_price'
    | 'final_price'
    | 'received_at'
  >;
}

@Injectable({ providedIn: 'root' })
export class ServiceDeskService {
  private http = inject(HttpClient);
  private base = `${API_BASE}/service/tickets`;

  list(params?: Record<string, string>): Observable<ServiceTicket[]> {
    return this.http
      .get<{ results?: ServiceTicket[] } | ServiceTicket[]>(this.base + '/', { params })
      .pipe(map((r) => (Array.isArray(r) ? r : r.results ?? [])));
  }

  get(id: number): Observable<ServiceTicket> {
    return this.http.get<ServiceTicket>(`${this.base}/${id}/`);
  }

  dashboard(): Observable<ServiceDashboard> {
    return this.http.get<ServiceDashboard>(`${this.base}/dashboard/`);
  }

  create(payload: Record<string, unknown>): Observable<ServiceTicket> {
    return this.http.post<ServiceTicket>(this.base + '/', payload);
  }

  transition(id: number, status: ServiceTicketStatus, note = ''): Observable<ServiceTicket> {
    return this.http.post<ServiceTicket>(`${this.base}/${id}/transition/`, { status, note });
  }

  submitDiagnosis(
    id: number,
    diagnosis: string,
    estimated_price: number,
    note = ''
  ): Observable<ServiceTicket> {
    return this.http.post<ServiceTicket>(`${this.base}/${id}/submit-diagnosis/`, {
      diagnosis,
      estimated_price,
      note,
    });
  }

  approveQuote(id: number, note = ''): Observable<ServiceTicket> {
    return this.http.post<ServiceTicket>(`${this.base}/${id}/approve-quote/`, { note });
  }

  deliver(id: number, final_price: number, payment_method: string, note = ''): Observable<ServiceTicket> {
    return this.http.post<ServiceTicket>(`${this.base}/${id}/deliver/`, {
      final_price,
      payment_method,
      note,
    });
  }

  printIntake(id: number): Observable<{ jobs_created: number }> {
    return this.http.post<{ jobs_created: number }>(`${this.base}/${id}/print-intake/`, {});
  }

  lookup(q: string): Observable<ServiceTicketLookup> {
    return this.http.get<ServiceTicketLookup>(`${API_BASE}/service/tickets/lookup/`, {
      params: { q },
    });
  }
}

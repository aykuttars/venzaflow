import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { API_BASE } from './api';
import { decodeJwt, isExpired, JwtClaims } from './jwt';

const ACCESS_KEY = 'bms.admin.access';
const REFRESH_KEY = 'bms.admin.refresh';
const ME_KEY = 'bms.admin.me';

export interface PlatformUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  tenant_code: string | null;
  tenant_name: string | null;
}

export interface PlatformLoginResponse {
  access: string;
  refresh: string;
  user: PlatformUser;
  permissions: string[];
  is_platform: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlatformAuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly access = signal<string | null>(localStorage.getItem(ACCESS_KEY));
  readonly refresh = signal<string | null>(localStorage.getItem(REFRESH_KEY));
  readonly me = signal<{
    user: PlatformUser;
    permissions: string[];
    is_platform: boolean;
  } | null>(this.readMe());

  readonly claims = computed<JwtClaims | null>(() => decodeJwt(this.access()));
  readonly isAuthenticated = computed(() => {
    const c = this.claims();
    return !!c && !isExpired(c) && c['is_platform'] === true;
  });

  private readMe() {
    const raw = localStorage.getItem(ME_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  login(payload: { email: string; password: string }): Observable<PlatformLoginResponse> {
    return this.http
      .post<PlatformLoginResponse>(`${API_BASE}/platform/auth/login/`, payload)
      .pipe(tap((res) => this.persist(res)));
  }

  loadMe(): Observable<{
    user: PlatformUser;
    permissions: string[];
    is_platform: boolean;
  }> {
    return this.http
      .get<{
        user: PlatformUser;
        permissions: string[];
        is_platform: boolean;
      }>(`${API_BASE}/platform/auth/me/`)
      .pipe(
        tap((res) => {
          this.me.set(res);
          localStorage.setItem(ME_KEY, JSON.stringify(res));
        })
      );
  }

  refreshAccess(): Observable<{ access: string }> {
    return this.http
      .post<{ access: string }>(`${API_BASE}/platform/auth/refresh/`, {
        refresh: this.refresh(),
      })
      .pipe(
        tap((res) => {
          this.access.set(res.access);
          localStorage.setItem(ACCESS_KEY, res.access);
        })
      );
  }

  logout(navigate = true): void {
    const refresh = this.refresh();
    if (refresh) {
      this.http
        .post(`${API_BASE}/platform/auth/logout/`, { refresh })
        .subscribe({ error: () => undefined });
    }
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ME_KEY);
    this.access.set(null);
    this.refresh.set(null);
    this.me.set(null);
    if (navigate) this.router.navigate(['/admin/login']);
  }

  private persist(res: PlatformLoginResponse) {
    localStorage.setItem(ACCESS_KEY, res.access);
    localStorage.setItem(REFRESH_KEY, res.refresh);
    localStorage.setItem(
      ME_KEY,
      JSON.stringify({
        user: res.user,
        permissions: res.permissions,
        is_platform: res.is_platform,
      })
    );
    this.access.set(res.access);
    this.refresh.set(res.refresh);
    this.me.set({
      user: res.user,
      permissions: res.permissions,
      is_platform: res.is_platform,
    });
  }
}

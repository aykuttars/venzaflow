import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { API_BASE } from './api';
import { decodeJwt, isExpired, JwtClaims } from './jwt';

const ACCESS_KEY = 'bms.access';
const REFRESH_KEY = 'bms.refresh';
const ME_KEY = 'bms.me';

export interface MeUser {
  id: number;
  email: string;
  tenant_code: string;
  tenant_name?: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  department: { id: number; key: string; name: string } | null;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: MeUser;
  permissions: string[];
  enabled_modules: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly access = signal<string | null>(localStorage.getItem(ACCESS_KEY));
  readonly refresh = signal<string | null>(localStorage.getItem(REFRESH_KEY));
  readonly me = signal<{
    user: MeUser;
    permissions: string[];
    enabled_modules: string[];
  } | null>(this.readMe());

  readonly claims = computed<JwtClaims | null>(() => decodeJwt(this.access()));
  readonly isAuthenticated = computed(() => {
    const c = this.claims();
    return !!c && !isExpired(c);
  });

  private readMe() {
    const raw = localStorage.getItem(ME_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  login(payload: {
    customer_code: string;
    email: string;
    password: string;
  }): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE}/auth/login/`, payload)
      .pipe(
        tap((res) => {
          this.persist(res);
        })
      );
  }

  refreshMe(): Observable<{
    user: MeUser;
    permissions: string[];
    enabled_modules: string[];
  }> {
    return this.loadMe();
  }

  loadMe(): Observable<{
    user: MeUser;
    permissions: string[];
    enabled_modules: string[];
  }> {
    return this.http
      .get<{
        user: MeUser;
        permissions: string[];
        enabled_modules: string[];
      }>(`${API_BASE}/auth/me/`)
      .pipe(
        tap((res) => {
          this.me.set(res);
          localStorage.setItem(ME_KEY, JSON.stringify(res));
        })
      );
  }

  refreshAccess(): Observable<{ access: string }> {
    return this.http
      .post<{ access: string }>(`${API_BASE}/auth/refresh/`, {
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
        .post(`${API_BASE}/auth/logout/`, { refresh })
        .subscribe({ error: () => undefined });
    }
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ME_KEY);
    this.access.set(null);
    this.refresh.set(null);
    this.me.set(null);
    if (navigate) this.router.navigate(['/login']);
  }

  hasPermission(code: string): boolean {
    if (!code) return true;
    const me = this.me();
    return !!me?.permissions.includes(code);
  }

  hasModule(slug: string): boolean {
    if (!slug) return true;
    const me = this.me();
    return !!me?.enabled_modules.includes(slug);
  }

  private persist(res: LoginResponse) {
    localStorage.setItem(ACCESS_KEY, res.access);
    localStorage.setItem(REFRESH_KEY, res.refresh);
    localStorage.setItem(
      ME_KEY,
      JSON.stringify({
        user: res.user,
        permissions: res.permissions,
        enabled_modules: res.enabled_modules,
      })
    );
    this.access.set(res.access);
    this.refresh.set(res.refresh);
    this.me.set({
      user: res.user,
      permissions: res.permissions,
      enabled_modules: res.enabled_modules,
    });
  }
}

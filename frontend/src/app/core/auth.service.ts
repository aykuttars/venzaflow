import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { API_BASE } from './api';
import { decodeJwt, isExpired, JwtClaims } from './jwt';
import { AppLanguage, LanguageService } from './language.service';

const ACCESS_KEY = 'bms.access';
const REFRESH_KEY = 'bms.refresh';
const ME_KEY = 'bms.me';

export interface MeUser {
  id: number;
  email: string;
  tenant_code: string;
  tenant_name?: string;
  tenant_default_language?: AppLanguage;
  first_name: string;
  last_name: string;
  is_active: boolean;
  department: { id: number; key: string; name: string } | null;
}

export interface TenantSubscription {
  max_users: number;
  active_users: number;
  subscribed_modules: string[];
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: MeUser;
  permissions: string[];
  enabled_modules: string[];
  default_language?: AppLanguage;
  module_labels?: Record<string, string>;
  subscription?: TenantSubscription;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private language = inject(LanguageService);

  readonly access = signal<string | null>(localStorage.getItem(ACCESS_KEY));
  readonly refresh = signal<string | null>(localStorage.getItem(REFRESH_KEY));
  readonly me = signal<{
    user: MeUser;
    permissions: string[];
    enabled_modules: string[];
    default_language?: AppLanguage;
    module_labels?: Record<string, string>;
    subscription?: TenantSubscription;
  } | null>(this.readMe());

  readonly subscription = computed(() => this.me()?.subscription ?? null);

  canAddUser(): boolean {
    const sub = this.subscription();
    if (!sub) return true;
    return sub.active_users < sub.max_users;
  }

  userUsageLabel(): string {
    const sub = this.subscription();
    if (!sub) return '';
    return `${sub.active_users}/${sub.max_users}`;
  }

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
    module_labels?: Record<string, string>;
    subscription?: TenantSubscription;
  }> {
    return this.loadMe();
  }

  loadMe(): Observable<{
    user: MeUser;
    permissions: string[];
    enabled_modules: string[];
    default_language?: AppLanguage;
    module_labels?: Record<string, string>;
    subscription?: TenantSubscription;
  }> {
    return this.http
      .get<{
        user: MeUser;
        permissions: string[];
        enabled_modules: string[];
        default_language?: AppLanguage;
        module_labels?: Record<string, string>;
        subscription?: TenantSubscription;
      }>(`${API_BASE}/auth/me/`)
      .pipe(
        tap((res) => {
          this.me.set(res);
          localStorage.setItem(ME_KEY, JSON.stringify(res));
          this.language.initFromTenant(
            res.default_language || res.user.tenant_default_language
          );
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
    this.language.resetOnLogout();
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
        default_language: res.default_language,
        module_labels: res.module_labels ?? {},
        subscription: res.subscription,
      })
    );
    this.access.set(res.access);
    this.refresh.set(res.refresh);
    this.me.set({
      user: res.user,
      permissions: res.permissions,
      enabled_modules: res.enabled_modules,
      default_language: res.default_language,
      module_labels: res.module_labels ?? {},
      subscription: res.subscription,
    });
    this.language.initFromTenant(
      res.default_language || res.user.tenant_default_language
    );
  }
}

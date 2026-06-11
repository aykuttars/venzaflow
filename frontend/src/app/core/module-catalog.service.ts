import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';

import { API_BASE } from './api';
import type { components } from '../shared/api-schema';

export type ModuleCatalogEntry = components['schemas']['PlatformModuleCatalog'];

/**
 * Runtime source of truth for the assignable module list. The catalog is served
 * by the backend (`GET /platform/modules/`), so adding a module backend-side
 * automatically surfaces it in the platform admin UI — no hardcoded slug list.
 */
@Injectable({ providedIn: 'root' })
export class ModuleCatalogService {
  private http = inject(HttpClient);
  private readonly _catalog = signal<ModuleCatalogEntry[]>([]);
  private request$?: Observable<ModuleCatalogEntry[]>;

  readonly catalog = this._catalog.asReadonly();
  readonly allSlugs = computed(() => this._catalog().map((m) => m.slug));
  readonly billableSlugs = computed(() =>
    this._catalog()
      .filter((m) => m.is_billable)
      .map((m) => m.slug)
  );
  readonly nonBillableDefaultSlugs = computed(() =>
    this._catalog()
      .filter((m) => m.is_default_non_billable)
      .map((m) => m.slug)
  );

  /** Fetch the catalog once; subsequent callers share the cached result. */
  load(): Observable<ModuleCatalogEntry[]> {
    if (!this.request$) {
      this.request$ = this.http
        .get<ModuleCatalogEntry[]>(`${API_BASE}/platform/modules/`)
        .pipe(
          tap((rows) => this._catalog.set(rows)),
          shareReplay(1)
        );
    }
    return this.request$;
  }

  private find(slug: string): ModuleCatalogEntry | undefined {
    return this._catalog().find((m) => m.slug === slug);
  }

  isBillable(slug: string): boolean {
    return this.find(slug)?.is_billable ?? false;
  }

  isNonBillableDefault(slug: string): boolean {
    return this.find(slug)?.is_default_non_billable ?? false;
  }

  defaultPrice(slug: string): string | null {
    return this.find(slug)?.default_price_per_user_monthly ?? null;
  }

  label(slug: string): string {
    return this.find(slug)?.label ?? slug;
  }

  /** Mirror of backend merge_tenant_modules: non-billable defaults always included. */
  mergeTenantModules(modules: string[]): string[] {
    const merged = [...this.nonBillableDefaultSlugs()];
    const all = new Set(this.allSlugs());
    for (const slug of modules) {
      if (all.has(slug) && !merged.includes(slug)) {
        merged.push(slug);
      }
    }
    return merged;
  }
}

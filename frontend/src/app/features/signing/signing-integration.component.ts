import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

interface ProviderField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  secret: boolean;
}
interface Provider {
  key: string;
  display_name: string;
  kind: string;
  supported_families: string[];
  environments: string[];
  signing_modes: string[];
  auth_fields: ProviderField[];
}
interface SecretHint {
  set: boolean;
  hint: string;
}
interface Connection {
  id: number;
  display_name: string;
  provider_key: string;
  provider_display: string;
  environment: string;
  signing_mode: string;
  is_active: boolean;
  status: 'untested' | 'ok' | 'error';
  status_message: string;
  last_checked_at: string | null;
  credentials: Record<string, SecretHint | string>;
}
interface Profile {
  supplier_vkn: string;
  supplier_title: string;
  supplier_tax_office: string;
  supplier_city: string;
  supplier_district: string;
  supplier_street: string;
  supplier_country: string;
  certificate_type: 'mali_muhur' | 'personal';
}
interface Routing {
  document_family: string;
  connection: number;
}
interface IntegrationPayload {
  providers: Provider[];
  profile: Profile;
  connections: Connection[];
  routing: Routing[];
}

interface ConnectionDraft {
  id: number | null;
  display_name: string;
  provider_key: string;
  environment: string;
  signing_mode: string;
  is_active: boolean;
  credentials: Record<string, string>;
}

const FAMILIES = ['efatura', 'earsiv', 'erecete'];

@Component({
  selector: 'app-signing-integration',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    PageHeaderComponent,
  ],
  template: `
    <div class="page">
      <app-page-header titleKey="signingIntegration.title" icon="hub">
        @if (!isPlatform()) {
        <a mat-stroked-button routerLink="/signing">
          <mat-icon>arrow_back</mat-icon>
          {{ 'signingIntegration.backToTasks' | translate }}
        </a>
        }
      </app-page-header>
      <p class="subtitle">{{ 'signingIntegration.subtitle' | translate }}</p>

      <!-- Sender profile -->
      <section class="card">
        <h2>{{ 'signingIntegration.profile.title' | translate }}</h2>
        <p class="muted">{{ 'signingIntegration.profile.hint' | translate }}</p>
        <div class="grid">
          <label>{{ 'signingIntegration.profile.vkn' | translate }}
            <input [(ngModel)]="profile.supplier_vkn" maxlength="11" [disabled]="!canWrite()" /></label>
          <label>{{ 'signingIntegration.profile.companyTitle' | translate }}
            <input [(ngModel)]="profile.supplier_title" [disabled]="!canWrite()" /></label>
          <label>{{ 'signingIntegration.profile.taxOffice' | translate }}
            <input [(ngModel)]="profile.supplier_tax_office" [disabled]="!canWrite()" /></label>
          <label>{{ 'signingIntegration.profile.city' | translate }}
            <input [(ngModel)]="profile.supplier_city" [disabled]="!canWrite()" /></label>
          <label>{{ 'signingIntegration.profile.district' | translate }}
            <input [(ngModel)]="profile.supplier_district" [disabled]="!canWrite()" /></label>
          <label>{{ 'signingIntegration.profile.street' | translate }}
            <input [(ngModel)]="profile.supplier_street" [disabled]="!canWrite()" /></label>
          <label>{{ 'signingIntegration.profile.certType' | translate }}
            <select [(ngModel)]="profile.certificate_type" [disabled]="!canWrite()">
              <option value="personal">{{ 'signingIntegration.certType.personal' | translate }}</option>
              <option value="mali_muhur">{{ 'signingIntegration.certType.mali_muhur' | translate }}</option>
            </select></label>
        </div>
        @if (canWrite()) {
        <button mat-flat-button color="primary" (click)="saveProfile()">
          {{ 'common.save' | translate }}
        </button>
        }
      </section>

      <!-- Connections -->
      <section class="card">
        <div class="row-between">
          <h2>{{ 'signingIntegration.connections.title' | translate }}</h2>
          @if (canWrite()) {
          <button mat-stroked-button (click)="startCreate()">
            <mat-icon>add</mat-icon>{{ 'signingIntegration.connections.add' | translate }}
          </button>
          }
        </div>

        <table class="bms-table">
          <thead>
            <tr>
              <th>{{ 'signingIntegration.connections.name' | translate }}</th>
              <th>{{ 'signingIntegration.connections.provider' | translate }}</th>
              <th>{{ 'signingIntegration.connections.env' | translate }}</th>
              <th>{{ 'signingIntegration.connections.signingMode' | translate }}</th>
              <th>{{ 'signingIntegration.connections.status' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of payload()?.connections ?? []; track c.id) {
            <tr>
              <td>
                <strong>{{ c.display_name || c.provider_display }}</strong>
                @if (!c.is_active) { <span class="muted"> ({{ 'signingIntegration.connections.inactive' | translate }})</span> }
              </td>
              <td>{{ c.provider_display }}</td>
              <td>{{ ('signingIntegration.env.' + c.environment) | translate }}</td>
              <td>{{ ('signingIntegration.mode.' + c.signing_mode) | translate }}</td>
              <td>
                <span class="status status--{{ c.status }}">{{ ('signingIntegration.connStatus.' + c.status) | translate }}</span>
                @if (c.status_message) { <div class="muted">{{ c.status_message }}</div> }
              </td>
              <td class="actions">
                @if (canWrite()) {
                <button mat-icon-button (click)="testConnection(c)" [title]="'signingIntegration.connections.test' | translate"><mat-icon>wifi_tethering</mat-icon></button>
                <button mat-icon-button (click)="startEdit(c)" [title]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="remove(c)" [title]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                }
              </td>
            </tr>
            }
            @if ((payload()?.connections ?? []).length === 0) {
            <tr><td colspan="6" class="empty">{{ 'signingIntegration.connections.none' | translate }}</td></tr>
            }
          </tbody>
        </table>

        @if (draft(); as d) {
        <div class="editor">
          <h3>{{ d.id ? ('signingIntegration.connections.editTitle' | translate) : ('signingIntegration.connections.addTitle' | translate) }}</h3>
          <div class="grid">
            <label>{{ 'signingIntegration.connections.name' | translate }}
              <input [(ngModel)]="d.display_name" /></label>
            <label>{{ 'signingIntegration.connections.provider' | translate }}
              <select [(ngModel)]="d.provider_key" (ngModelChange)="onProviderChange(d)" [disabled]="!!d.id">
                @for (p of payload()?.providers ?? []; track p.key) {
                <option [value]="p.key">{{ p.display_name }}</option>
                }
              </select></label>
            <label>{{ 'signingIntegration.connections.env' | translate }}
              <select [(ngModel)]="d.environment">
                @for (e of selectedProvider(d)?.environments ?? []; track e) {
                <option [value]="e">{{ ('signingIntegration.env.' + e) | translate }}</option>
                }
              </select></label>
            <label>{{ 'signingIntegration.connections.signingMode' | translate }}
              <select [(ngModel)]="d.signing_mode">
                @for (m of selectedProvider(d)?.signing_modes ?? []; track m) {
                <option [value]="m">{{ ('signingIntegration.mode.' + m) | translate }}</option>
                }
              </select></label>
            <label class="checkbox">
              <input type="checkbox" [(ngModel)]="d.is_active" />
              {{ 'signingIntegration.connections.active' | translate }}
            </label>
          </div>

          <h4>{{ 'signingIntegration.connections.credentials' | translate }}</h4>
          <div class="grid">
            @for (f of selectedProvider(d)?.auth_fields ?? []; track f.name) {
            <label>{{ f.label }}@if (f.required) { <span class="req">*</span> }
              <input
                [type]="f.type === 'password' ? 'password' : 'text'"
                [(ngModel)]="d.credentials[f.name]"
                [placeholder]="credentialPlaceholder(d, f)" />
            </label>
            }
          </div>

          <div class="editor-actions">
            <button mat-flat-button color="primary" (click)="saveConnection(d)">{{ 'common.save' | translate }}</button>
            <button mat-stroked-button (click)="cancelEdit()">{{ 'common.cancel' | translate }}</button>
          </div>
        </div>
        }
      </section>

      <!-- Routing -->
      <section class="card">
        <h2>{{ 'signingIntegration.routing.title' | translate }}</h2>
        <p class="muted">{{ 'signingIntegration.routing.hint' | translate }}</p>
        <div class="grid">
          @for (fam of families; track fam) {
          <label>{{ ('signing.docType.' + fam) | translate }}
            <select [ngModel]="routeValue(fam)" (ngModelChange)="setRoute(fam, $event)" [disabled]="!canWrite()">
              <option [ngValue]="null">{{ 'signingIntegration.routing.none' | translate }}</option>
              @for (c of connectionsForFamily(fam); track c.id) {
              <option [ngValue]="c.id">{{ c.display_name || c.provider_display }} ({{ ('signingIntegration.env.' + c.environment) | translate }})</option>
              }
            </select></label>
          }
        </div>
        @if (canWrite()) {
        <button mat-flat-button color="primary" (click)="saveRouting()">{{ 'common.save' | translate }}</button>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .subtitle { color: rgba(0,0,0,.6); margin: 0 0 16px; }
      .card { background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:12px; padding:20px; margin-bottom:20px; }
      .card h2 { margin:0 0 4px; font-size:18px; }
      .row-between { display:flex; justify-content:space-between; align-items:center; }
      .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; margin:14px 0; }
      label { display:flex; flex-direction:column; font-size:13px; color:rgba(0,0,0,.7); gap:6px; }
      label.checkbox { flex-direction:row; align-items:center; gap:8px; }
      input, select { padding:8px 10px; border:1px solid rgba(0,0,0,.2); border-radius:8px; font-size:14px; }
      .req { color:#dc2626; }
      .muted { color:rgba(0,0,0,.5); font-size:12px; }
      .empty { text-align:center; padding:20px; color:rgba(0,0,0,.5); }
      table.bms-table { width:100%; border-collapse:collapse; margin-top:8px; }
      table.bms-table th, table.bms-table td { padding:10px 12px; text-align:left; border-bottom:1px solid rgba(0,0,0,.06); }
      .actions { white-space:nowrap; text-align:right; }
      .editor { border-top:1px dashed rgba(0,0,0,.15); margin-top:16px; padding-top:16px; }
      .editor-actions { display:flex; gap:10px; }
      .status { display:inline-block; padding:2px 10px; border-radius:12px; font-size:12px; background:rgba(0,0,0,.08); }
      .status--ok { background:rgba(5,150,105,.14); color:#047857; }
      .status--error { background:rgba(220,38,38,.14); color:#b91c1c; }
    `,
  ],
})
export class SigningIntegrationComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute);

  readonly families = FAMILIES;
  payload = signal<IntegrationPayload | null>(null);
  draft = signal<ConnectionDraft | null>(null);
  profile: Profile = this.emptyProfile();

  /** Platform-admin mode targets a specific tenant via its own endpoints. */
  private tenantId: string | null = null;
  private get base(): string {
    return this.tenantId
      ? `${API_BASE}/platform/tenants/${this.tenantId}/integration`
      : `${API_BASE}/sign/integration`;
  }

  routingMap = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const r of this.payload()?.routing ?? []) map[r.document_family] = r.connection;
    return map;
  });

  canWrite(): boolean {
    return this.tenantId ? true : this.auth.hasPermission('signing.write');
  }

  isPlatform(): boolean {
    return !!this.tenantId;
  }

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId');
    this.reload();
  }

  reload(): void {
    this.http.get<IntegrationPayload>(`${this.base}/`).subscribe({
      next: (data) => {
        this.payload.set(data);
        this.profile = { ...this.emptyProfile(), ...data.profile };
      },
      error: () => this.toast('common.error'),
    });
  }

  selectedProvider(d: ConnectionDraft): Provider | undefined {
    return (this.payload()?.providers ?? []).find((p) => p.key === d.provider_key);
  }

  connectionsForFamily(fam: string): Connection[] {
    return (this.payload()?.connections ?? []).filter((c) => {
      const p = (this.payload()?.providers ?? []).find((x) => x.key === c.provider_key);
      return p?.supported_families.includes(fam);
    });
  }

  credentialPlaceholder(d: ConnectionDraft, f: ProviderField): string {
    if (!d.id) return '';
    const stored = this.payload()?.connections.find((c) => c.id === d.id)?.credentials[f.name];
    if (f.secret && stored && typeof stored === 'object' && stored.set) {
      return stored.hint || '••••';
    }
    return '';
  }

  startCreate(): void {
    const providers = this.payload()?.providers ?? [];
    const p = providers[0];
    this.draft.set({
      id: null,
      display_name: '',
      provider_key: p?.key ?? '',
      environment: p?.environments[0] ?? 'test',
      signing_mode: p?.signing_modes[0] ?? 'client_xades',
      is_active: true,
      credentials: {},
    });
  }

  startEdit(c: Connection): void {
    this.draft.set({
      id: c.id,
      display_name: c.display_name,
      provider_key: c.provider_key,
      environment: c.environment,
      signing_mode: c.signing_mode,
      is_active: c.is_active,
      credentials: {},
    });
  }

  onProviderChange(d: ConnectionDraft): void {
    const p = this.selectedProvider(d);
    if (p) {
      if (!p.environments.includes(d.environment)) d.environment = p.environments[0];
      if (!p.signing_modes.includes(d.signing_mode)) d.signing_mode = p.signing_modes[0];
    }
    d.credentials = {};
  }

  cancelEdit(): void {
    this.draft.set(null);
  }

  private cleanCredentials(d: ConnectionDraft): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.credentials)) {
      if (v !== null && v !== undefined && `${v}`.trim() !== '') out[k] = v;
    }
    return out;
  }

  saveConnection(d: ConnectionDraft): void {
    const body = {
      display_name: d.display_name,
      provider_key: d.provider_key,
      environment: d.environment,
      signing_mode: d.signing_mode,
      is_active: d.is_active,
      credentials: this.cleanCredentials(d),
    };
    const req = d.id
      ? this.http.put(`${this.base}/connections/${d.id}/`, body)
      : this.http.post(`${this.base}/connections/`, body);
    req.subscribe({
      next: () => {
        this.toast('common.saved');
        this.draft.set(null);
        this.reload();
      },
      error: () => this.toast('common.error'),
    });
  }

  testConnection(c: Connection): void {
    this.http
      .post<{ ok: boolean; message: string }>(
        `${this.base}/connections/${c.id}/test/`,
        {}
      )
      .subscribe({
        next: (res) => {
          this.snack.open(res.message, '', { duration: 4000 });
          this.reload();
        },
        error: () => this.toast('common.error'),
      });
  }

  remove(c: Connection): void {
    this.http.delete(`${this.base}/connections/${c.id}/`).subscribe({
      next: () => {
        this.toast('common.deleted');
        this.reload();
      },
      error: () => this.toast('common.error'),
    });
  }

  saveProfile(): void {
    this.http.put(`${this.base}/`, this.profile).subscribe({
      next: () => this.toast('common.saved'),
      error: () => this.toast('common.error'),
    });
  }

  private pendingRouting: Record<string, number | null> = {};

  routeValue(fam: string): number | null {
    return this.routingMap()[fam] ?? null;
  }

  setRoute(fam: string, connectionId: number | null): void {
    this.pendingRouting[fam] = connectionId;
  }

  saveRouting(): void {
    const current = this.routingMap();
    const merged: Record<string, number | null> = { ...current, ...this.pendingRouting };
    const routings = Object.entries(merged)
      .filter(([, id]) => id != null)
      .map(([document_family, connection]) => ({ document_family, connection }));
    this.http
      .put(`${this.base}/routing/`, { routings })
      .subscribe({
        next: () => {
          this.toast('common.saved');
          this.pendingRouting = {};
          this.reload();
        },
        error: () => this.toast('common.error'),
      });
  }

  private toast(key: string): void {
    this.snack.open(this.translate.instant(key), '', { duration: 3000 });
  }

  private emptyProfile(): Profile {
    return {
      supplier_vkn: '',
      supplier_title: '',
      supplier_tax_office: '',
      supplier_city: '',
      supplier_district: '',
      supplier_street: '',
      supplier_country: 'Türkiye',
      certificate_type: 'personal',
    };
  }
}

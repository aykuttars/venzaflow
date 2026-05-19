import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { AppLanguage, LanguageService } from '../../core/language.service';
import { ModuleLabelService } from '../../core/module-label.service';
import { PageHeaderComponent } from '../../shared/page-header.component';

interface TenantProfile {
  id: number;
  customer_code: string;
  name: string;
  default_language: AppLanguage;
  enabled_modules: string[];
  module_labels: Record<string, string>;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslateModule,
    PageHeaderComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);
  protected language = inject(LanguageService);
  protected moduleLabels = inject(ModuleLabelService);
  tenant: TenantProfile | null = null;
  moduleLabelRows: string[] = [];
  moduleLabelsForm: FormGroup = this.fb.group({});

  tenantForm = this.fb.group({
    name: ['', Validators.required],
    default_language: this.fb.control<AppLanguage>('tr', Validators.required),
  });

  ngOnInit(): void {
    this.http.get<TenantProfile>(`${API_BASE}/tenant/`).subscribe({
      next: (t) => {
        this.tenant = t;
        this.tenantForm.patchValue({ name: t.name, default_language: t.default_language || 'tr' });
        this.buildModuleLabelsForm(t);
      },
    });
  }

  canEditTenant(): boolean {
    const dept = this.auth.me()?.user?.department?.key;
    return dept === 'admin' || this.auth.hasPermission('settings.write');
  }

  defaultLabel(slug: string): string {
    return this.moduleLabels.i18nLabel(slug);
  }

  resetModuleName(slug: string): void {
    this.moduleLabelsForm.get(slug)?.setValue('');
    this.moduleLabelsForm.get(slug)?.markAsDirty();
  }

  saveTenant(): void {
    if (this.tenantForm.invalid) return;
    const v = this.tenantForm.getRawValue();
    this.http.patch<TenantProfile>(`${API_BASE}/tenant/`, v).subscribe({
      next: (t) => {
        this.tenant = t;
        this.language.applyTenantLanguage(t.default_language);
        this.snack.open(this.translate.instant('settings.tenantNameUpdated'), 'OK', { duration: 2000 });
        this.auth.refreshMe().subscribe();
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 3000 }),
    });
  }

  saveModuleLabels(): void {
    const labels: Record<string, string> = { ...(this.tenant?.module_labels ?? {}) };
    for (const slug of this.moduleLabelRows) {
      const raw = (this.moduleLabelsForm.get(slug)?.value as string)?.trim() ?? '';
      if (raw) labels[slug] = raw;
      else delete labels[slug];
    }
    this.http.patch<TenantProfile>(`${API_BASE}/tenant/`, { module_labels: labels }).subscribe({
      next: (t) => {
        this.tenant = t;
        this.buildModuleLabelsForm(t);
        this.snack.open(this.translate.instant('settings.moduleLabelsUpdated'), 'OK', { duration: 2000 });
        this.auth.refreshMe().subscribe();
      },
      error: (e) =>
        this.snack.open(
          e?.error?.detail || JSON.stringify(e?.error) || this.translate.instant('common.error'),
          'OK',
          { duration: 4000 }
        ),
    });
  }

  private buildModuleLabelsForm(t: TenantProfile): void {
    const slugs = [...(t.enabled_modules || [])].sort();
    this.moduleLabelRows = slugs;
    const controls: Record<string, ReturnType<typeof this.fb.control>> = {};
    for (const slug of slugs) {
      controls[slug] = this.fb.control(t.module_labels?.[slug] ?? '');
    }
    this.moduleLabelsForm = this.fb.group(controls);
  }
}

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthService } from '../../core/auth.service';
import { OralService, OralTreatment, ProcedureCatalog } from '../../core/oral.service';
import { AuthImageComponent, patientPhotoUrl } from '../../shared/auth-image.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { CrudService } from '../../shared/crud.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { OdontogramComponent } from './odontogram.component';
import { Oral3dViewerComponent } from './oral-3d-viewer.component';
import { cursorClassForProcedure, TOOTH_SURFACES, ToothSurface } from './tooth-surfaces';

@Component({
  selector: 'app-oral-chart',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTooltipModule,
    MatCheckboxModule,
    RouterLink,
    TranslateModule,
    PageHeaderComponent,
    AuthImageComponent,
    OdontogramComponent,
    Oral3dViewerComponent,
  ],
  templateUrl: './oral-chart.component.html',
  styles: [
    `
      .page--embedded { padding-top: 0; }
      .patient-header {
        display: flex; align-items: center; gap: 16px; margin-bottom: 12px;
        padding: 12px 16px; border-radius: 12px; background: linear-gradient(135deg, #f5f7fa, #eef2ff);
      }
      .patient-header__info h2 { margin: 0 0 4px; font-size: 18px; }
      .patient-header__meta { font-size: 13px; opacity: 0.75; }
      .patient-photo { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; background: #ddd; }
      .oral-workspace {
        display: grid;
        grid-template-columns: 1fr 380px;
        gap: 16px;
        align-items: start;
      }
      .oral-workspace__chart { min-width: 0; }
      .oral-workspace__panel { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 12px; }
      .oral-stack { display: flex; flex-direction: column; gap: 16px; }
      .chart-toolbar {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;
      }
      .chart-toolbar h3 { margin: 0; font-size: 16px; }
      .view-toggle { display: flex; gap: 6px; }
      .selected-tooth-banner {
        display: flex; align-items: center; gap: 8px; margin-top: 12px;
        padding: 8px 12px; border-radius: 8px; background: rgba(63, 81, 181, 0.08);
        font-size: 14px;
      }
      .surface-picker { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
      .surface-picker button { min-width: 36px; }
      .catalog { max-height: 220px; overflow: auto; }
      .catalog--frequent { max-height: 140px; }
      .catalog-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 6px;
        margin-top: 8px;
      }
      .catalog-grid .catalog-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        padding: 8px 10px;
        min-height: 52px;
      }
      .catalog-item {
        display: flex; justify-content: space-between; align-items: center; width: 100%;
        text-align: left; padding: 10px 12px; border: none; background: transparent; cursor: pointer;
        border-radius: 8px;
      }
      .catalog-item:hover { background: rgba(63,81,181,0.08); }
      .catalog-item__price { font-size: 12px; opacity: 0.7; white-space: nowrap; margin-left: 8px; }
      .treatment-item { height: auto !important; padding: 8px 0 !important; }
      .treatment-item__meta { font-size: 12px; opacity: 0.7; }
      .status-badge {
        font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #e3f2fd;
        white-space: nowrap;
      }
      .status-badge.completed { background: #e8f5e9; }
      .status-badge.in_progress { background: #fff3e0; }
      .status-badge.planned { background: #e3f2fd; }
      .treatments-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .treatments-table th, .treatments-table td {
        padding: 8px; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.08);
      }
      .footer-bar {
        display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
        margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.08);
      }
      .picker-row { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; max-width: 480px; }
      @media (max-width: 1100px) {
        .oral-workspace { grid-template-columns: 1fr; }
        .oral-workspace__panel { position: static; }
      }
    `,
  ],
})
export class OralChartComponent implements OnInit {
  @Input() embedded = false;
  @Input() dialogMode = false;
  @Input() shellMode = false;
  @Input() inputPatientId: number | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private oral = inject(OralService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private confirmDialog = inject(ConfirmDialogService);
  protected auth = inject(AuthService);

  patientId = signal<number | null>(null);
  patient = signal<any | null>(null);
  chart = signal<Record<string, { condition?: string }>>({});
  procedures = signal<ProcedureCatalog[]>([]);
  treatments = signal<OralTreatment[]>([]);
  selectedTeeth = signal<number[]>([]);
  highlightTooth = signal<number | null>(null);
  categoryTab = signal(0);
  searchControl = new FormControl('', { nonNullable: true });
  invoiceDiscountControl = new FormControl('0', { nonNullable: true });
  eDocumentControl = new FormControl<'auto' | 'efatura' | 'earsiv' | 'none'>('auto', { nonNullable: true });
  loading = signal(false);
  unbilledTreatments = signal<OralTreatment[]>([]);
  selectedForInvoice = signal<Set<number>>(new Set());
  lastInvoiceId = signal<number | null>(null);
  chartViewMode = signal<'2d' | '3d'>('2d');
  selectedSurfaces = signal<string[]>([]);
  activeToolProcedure = signal<ProcedureCatalog | null>(null);
  surfaceSelectEnabled = signal(false);

  patientPhotoUrl = patientPhotoUrl;

  toolCursorClass = computed(() => {
    const p = this.activeToolProcedure();
    if (!p) return '';
    return cursorClassForProcedure(p.category, p.default_tooth_condition);
  });

  treatmentHints = computed(() => {
    const hints: Record<string, string> = {};
    for (const t of this.treatments()) {
      for (const tooth of t.tooth_numbers) {
        const key = String(tooth);
        const surf = (t.surfaces || []).length ? ` [${(t.surfaces || []).join(',')}]` : '';
        const line = `${t.procedure_name} (${t.status})${surf}`;
        hints[key] = hints[key] ? `${hints[key]} · ${line}` : line;
      }
    }
    return hints;
  });

  /** Completed/in-progress treatment surfaces per tooth (for chart overlay). */
  treatedSurfacesByTooth = computed(() => {
    const map: Record<string, string[]> = {};
    for (const t of this.treatments()) {
      if (t.status === 'cancelled') continue;
      for (const tooth of t.tooth_numbers) {
        const key = String(tooth);
        for (const s of t.surfaces || []) {
          if (!map[key]) map[key] = [];
          if (!map[key].includes(s)) map[key].push(s);
        }
      }
    }
    return map;
  });

  /** Per-surface treatment status for odontogram color coding. */
  surfaceStatusByTooth = computed(() => {
    const map: Record<string, Record<string, 'planned' | 'completed' | 'in_progress'>> = {};
    const priority: Record<string, number> = { planned: 1, in_progress: 2, completed: 3 };
    for (const t of this.treatments()) {
      if (t.status === 'cancelled') continue;
      for (const tooth of t.tooth_numbers) {
        const key = String(tooth);
        if (!map[key]) map[key] = {};
        for (const s of t.surfaces || []) {
          const existing = map[key][s];
          if (!existing || (priority[t.status] ?? 0) > (priority[existing] ?? 0)) {
            map[key][s] = t.status as 'planned' | 'completed' | 'in_progress';
          }
        }
      }
    }
    return map;
  });

  activeTooth = computed(() => this.selectedTeeth()[0] ?? null);

  doneForActiveTooth = computed(() => {
    const tooth = this.activeTooth();
    if (!tooth) return [];
    return this.treatments().filter(
      (t) => t.tooth_numbers.includes(tooth) && (t.status === 'completed' || t.status === 'in_progress')
    );
  });

  plannedForActiveTooth = computed(() => {
    const tooth = this.activeTooth();
    if (!tooth) return [];
    return this.treatments().filter(
      (t) => t.tooth_numbers.includes(tooth) && t.status === 'planned'
    );
  });

  filteredProcedures = computed(() => {
    const cats = ['diagnosis', 'planning', 'treatment'];
    const cat = cats[this.categoryTab()] || 'treatment';
    const q = this.searchControl.value.trim().toLowerCase();
    return this.procedures().filter((p) => {
      if (p.category !== cat) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    });
  });

  frequentProcedures = computed(() => this.procedures().filter((p) => p.is_frequent));

  totalAmount = computed(() =>
    this.treatments()
      .filter((t) => t.status !== 'cancelled')
      .reduce((sum, t) => sum + Number(t.unit_price || 0), 0)
  );

  groupedTreatments = computed(() => {
    const map = new Map<string, OralTreatment[]>();
    for (const t of this.treatments()) {
      const key = t.session_date || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  });

  private patientCrud = new CrudService<any>(
    inject(HttpClient),
    'patients',
    this.auth,
    'patients'
  );

  patientOptions = signal<any[]>([]);

  ngOnInit(): void {
    if (this.route.snapshot.data['embedded']) this.embedded = true;
    this.searchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()).subscribe();
    this.oral.listProcedures({ include_tdb: true }).subscribe((p) => this.procedures.set(p.results));

    if (this.inputPatientId != null) {
      this.setPatient(this.inputPatientId);
      return;
    }

    if (!this.route.snapshot.paramMap.get('patientId')) {
      this.patientCrud.list({ limit: 200 }).subscribe((p) => this.patientOptions.set(p.results));
    }

    const idParam = this.route.snapshot.paramMap.get('patientId');
    if (idParam) {
      this.setPatient(+idParam);
    }
    this.route.paramMap.subscribe((params) => {
      if (this.inputPatientId != null) return;
      const pid = params.get('patientId');
      if (pid) this.setPatient(+pid);
    });
  }

  canWrite = () => this.auth.hasPermission('oral.write');
  canBill = () => this.auth.hasModule('billing') && this.auth.hasPermission('billing.write');

  onPatientPicked(id: number | null): void {
    if (!id) return;
    this.router.navigate(this.embedded ? ['/patients', id, 'oral'] : ['/oral', id]);
    this.setPatient(id);
  }

  setPatient(id: number): void {
    this.patientId.set(id);
    this.loading.set(true);
    this.patientCrud.get(id).subscribe({
      next: (p) => {
        this.patient.set(p);
        this.reloadChartAndTreatments();
      },
      error: () => {
        this.loading.set(false);
        this.snack.open(this.translate.instant('common.error'), 'OK', { duration: 2500 });
      },
    });
  }

  reloadChartAndTreatments(): void {
    const id = this.patientId();
    if (!id) return;
    this.oral.getChart(id).subscribe({
      next: (c) => this.chart.set(c.teeth_state || {}),
      error: () => this.chart.set({}),
    });
    this.oral.listTreatments(id).subscribe({
      next: (t) => {
        this.treatments.set(t.results);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.loadUnbilled(id);
  }

  loadUnbilled(patientId: number): void {
    if (!this.canBill()) {
      this.unbilledTreatments.set([]);
      return;
    }
    this.oral.listTreatments(patientId, { unbilled: true, status: 'completed' }).subscribe({
      next: (t) => {
        this.unbilledTreatments.set(t.results);
        this.selectedForInvoice.set(new Set(t.results.map((x) => x.id)));
      },
    });
  }

  toggleInvoiceSelection(id: number, checked: boolean): void {
    const set = new Set(this.selectedForInvoice());
    if (checked) set.add(id);
    else set.delete(id);
    this.selectedForInvoice.set(set);
  }

  createInvoiceFromSelected(): void {
    const patientId = this.patientId();
    if (!patientId) return;
    const ids = [...this.selectedForInvoice()];
    if (!ids.length) {
      this.snack.open(this.translate.instant('oral.unbilledTreatments'), 'OK', { duration: 2500 });
      return;
    }
    this.oral
      .createInvoiceFromTreatments({
        patient: patientId,
        treatment_ids: ids,
        discount_percent: this.invoiceDiscountControl.value || '0',
        e_document_type: this.eDocumentControl.value,
      })
      .subscribe({
        next: (inv) => {
          this.lastInvoiceId.set(inv.id);
          this.reloadChartAndTreatments();
          this.snack.open(this.translate.instant('oral.invoiceCreated'), 'OK', { duration: 2500 });
        },
        error: (e) =>
          this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
            duration: 3500,
          }),
      });
  }

  applyProcedure(proc: ProcedureCatalog, status: OralTreatment['status'] = 'planned'): void {
    this.activeToolProcedure.set(proc);
    this.surfaceSelectEnabled.set(proc.category === 'treatment');
    const id = this.patientId();
    const tooth = this.activeTooth();
    if (!id || !tooth) {
      this.snack.open(this.translate.instant('oral.selectToothFirst'), 'OK', { duration: 2500 });
      return;
    }
    const cats = ['diagnosis', 'planning', 'treatment'];
    const cat = cats[this.categoryTab()] || 'treatment';
    let resolvedStatus = status;
    if (cat === 'planning' || cat === 'diagnosis') resolvedStatus = 'planned';
    this.oral
      .bulkCreate({
        patient: id,
        procedure: proc.id,
        tooth_numbers: [tooth],
        surfaces: this.selectedSurfaces(),
        status: resolvedStatus,
      })
      .subscribe({
        next: () => {
          this.reloadChartAndTreatments();
          this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
        },
        error: (e) =>
          this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
            duration: 3500,
          }),
      });
  }

  applyProcedureAsCompleted(proc: ProcedureCatalog): void {
    this.activeToolProcedure.set(proc);
    const id = this.patientId();
    const tooth = this.activeTooth();
    if (!id || !tooth) {
      this.snack.open(this.translate.instant('oral.selectToothFirst'), 'OK', { duration: 2500 });
      return;
    }
    this.oral
      .bulkCreate({
        patient: id,
        procedure: proc.id,
        tooth_numbers: [tooth],
        surfaces: this.selectedSurfaces(),
        status: 'completed',
      })
      .subscribe({
        next: (created) => {
          const t = created[0];
          if (t) {
            this.oral
              .updateTreatment(t.id, {
                performed_at: new Date().toISOString().slice(0, 10),
              })
              .subscribe({
                next: () => this.reloadChartAndTreatments(),
                error: () => this.reloadChartAndTreatments(),
              });
          } else {
            this.reloadChartAndTreatments();
          }
          this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
        },
        error: (e) =>
          this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
            duration: 3500,
          }),
      });
  }

  highlightTreatment(t: OralTreatment): void {
    this.highlightTooth.set(t.tooth_numbers[0] ?? null);
    if (t.tooth_numbers[0]) this.selectedTeeth.set([t.tooth_numbers[0]]);
  }

  updateStatus(t: OralTreatment, status: OralTreatment['status']): void {
    const body: Partial<OralTreatment> = { status };
    if (status === 'completed') body.performed_at = new Date().toISOString().slice(0, 10);
    this.oral.updateTreatment(t.id, body).subscribe({
      next: () => this.reloadChartAndTreatments(),
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 3500,
        }),
    });
  }

  removeTreatment(t: OralTreatment): void {
    this.confirmDialog.confirmDelete().then((ok) => {
      if (!ok) return;
      this.oral.deleteTreatment(t.id).subscribe({
        next: () => {
          this.reloadChartAndTreatments();
          this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
        },
        error: (e) =>
          this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
            duration: 2500,
          }),
      });
    });
  }

  formatPrice(v: string | number): string {
    return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  isTreatmentCategory(): boolean {
    return this.categoryTab() === 2;
  }

  toggleSurface(code: string): void {
    const set = new Set(this.selectedSurfaces());
    if (set.has(code)) set.delete(code);
    else set.add(code);
    this.selectedSurfaces.set([...set]);
  }

  onSurfacePick(event: { tooth: number; surface: string }): void {
    if (this.activeTooth() !== event.tooth) {
      this.selectedTeeth.set([event.tooth]);
    }
    this.toggleSurface(event.surface);
  }

  hoverProcedure(proc: ProcedureCatalog | null): void {
    this.activeToolProcedure.set(proc);
    this.surfaceSelectEnabled.set(!!proc && proc.category === 'treatment');
  }

  toothSurfaces = TOOTH_SURFACES;
}

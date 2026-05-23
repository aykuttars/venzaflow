import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { NviService } from '../../core/nvi.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { CrudService } from '../../shared/crud.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { PhoneInputDirective } from '../../shared/phone-input.directive';
import {
  emailRequiredValidator,
  phoneRequiredValidator,
  phoneValidator,
  patientIdentityValidator,
} from '../../shared/form-validators';
import { AuthImageComponent, patientPhotoUrl } from '../../shared/auth-image.component';
import { PatientPhotoAvatarComponent } from '../../shared/patient-photo-avatar.component';
import { MernisAddressFormComponent } from '../../shared/mernis-address-form.component';
import { PatientDetailDialogComponent } from './patient-detail-dialog.component';

function emptyAddressGroup(fb: FormBuilder) {
  return fb.nonNullable.group({
    province_code: fb.control<number | null>(null),
    province_name: [''],
    district_code: fb.control<number | null>(null),
    district_name: [''],
    neighborhood_code: fb.control<number | null>(null),
    neighborhood_name: [''],
    street_code: fb.control<number | null>(null),
    street_name: [''],
    building_code: fb.control<number | null>(null),
    building_no: [''],
    unit_code: fb.control<number | null>(null),
    apartment_no: [''],
    address_code: fb.control<number | null>(null),
    full_address: [''],
  });
}

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    TranslateModule,
    PageHeaderComponent,
    PhoneInputDirective,
    MernisAddressFormComponent,
    AuthImageComponent,
    PatientPhotoAvatarComponent,
    PatientDetailDialogComponent,
  ],
  templateUrl: './patients.component.html',
  styles: [
    CRUD_DIALOG_STYLES,
    `
      .page--embedded { padding-top: 0; }
      .embedded-actions { display: flex; justify-content: flex-end; margin-bottom: 8px; }
      .dialog { max-width: 920px; width: min(920px, 96vw); }
      .dialog__section { margin-bottom: 16px; }
      .dialog__section-title {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.75;
      }
      .dialog__row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .verify-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
      .verified-badge { color: #2e7d32; font-size: 13px; }
      .full-width { width: 100%; }
      .photo-row { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 8px; }
      .photo-preview { width: 100px; height: 100px; border-radius: 6px; overflow: hidden; }
      .photo-actions { display: flex; flex-direction: column; gap: 8px; }
      .patient-avatar { width: 40px; height: 40px; border-radius: 50%; }
      .patient-name-link { cursor: pointer; }
      .patient-name-link:hover { color: #3f51b5; text-decoration: underline; }
    `,
  ],
})
export class PatientsComponent implements OnInit {
  @Input() embedded = false;

  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private nvi = inject(NviService);
  protected auth = inject(AuthService);
  private patientCrud = new CrudService<any>(this.http, 'patients', this.auth, 'patients');
  private recordCrud = new CrudService<any>(this.http, 'medical-records', this.auth, 'patients');

  tab = signal(0);
  patients = signal<any[]>([]);
  records = signal<any[]>([]);
  editingPatient = signal(false);
  editingRecord = signal(false);
  nviVerified = signal(false);
  nviReference = signal('');
  patientHasPhoto = signal(false);
  pendingPhotoFile = signal<File | null>(null);
  pendingPhotoPreview = signal<string | null>(null);
  removePhotoOnSave = signal(false);
  viewingPatientDetail = signal<number | null>(null);
  detailInitialTab = signal(0);
  detailPatientSummary = signal<any | null>(null);

  patientForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    nationality: this.fb.control<'tc' | 'foreign'>('tc', Validators.required),
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    tckn: ['', patientIdentityValidator('tc')],
    birth_date: this.fb.control<Date | null>(null, Validators.required),
    mobile_phone: ['', phoneRequiredValidator()],
    email: ['', emailRequiredValidator()],
    home_phone: ['', phoneValidator()],
    work_phone: ['', phoneValidator()],
    home_address: emptyAddressGroup(this.fb),
    work_address: emptyAddressGroup(this.fb),
  });

  recordForm = this.fb.group({
    id: this.fb.control<number | null>(null),
    patient: this.fb.control<number | null>(null, Validators.required),
    summary: [''],
  });

  ngOnInit(): void {
    if (this.route.snapshot.data['embedded']) {
      this.embedded = true;
    }
    this.patientForm.get('nationality')!.valueChanges.subscribe((nationality) => {
      this.nviVerified.set(false);
      this.nviReference.set('');
      const tcknCtrl = this.patientForm.get('tckn')!;
      tcknCtrl.setValidators(patientIdentityValidator(nationality || 'tc'));
      tcknCtrl.updateValueAndValidity({ emitEvent: false });
    });
    this.reloadPatients();
    if (this.canAccessRecords()) {
      this.reloadRecords();
    }
  }

  canWritePatients = () => this.auth.hasPermission('patients.write');
  canWriteRecords = () => this.auth.hasPermission('patients.write');
  canAccessRecords = () =>
    this.auth.hasModule('patients') && this.auth.hasPermission('patients.read');
  canAccessOral = () => this.auth.hasModule('oral') && this.auth.hasPermission('oral.read');

  oralChartLink(patientId: number): string[] {
    if (this.auth.moduleParent('oral') === 'patients') {
      return ['/patients', String(patientId), 'oral'];
    }
    return ['/oral', String(patientId)];
  }

  oralTabIndex(): number {
    return this.canAccessOral() ? 1 : -1;
  }

  openPatientDetail(p: any, tabIndex = 0): void {
    this.detailPatientSummary.set(p);
    this.detailInitialTab.set(tabIndex);
    this.viewingPatientDetail.set(p.id);
  }

  closePatientDetail(): void {
    this.viewingPatientDetail.set(null);
    this.detailPatientSummary.set(null);
  }

  maskTckn(tckn?: string): string {
    if (!tckn || tckn.length < 4) return tckn || '';
    return `${tckn.slice(0, 3)}******${tckn.slice(-2)}`;
  }

  patientPhotoUrl = patientPhotoUrl;

  reloadPatients(): void {
    this.patientCrud.list({ limit: 200 }).subscribe((p) => this.patients.set(p.results));
  }

  reloadRecords(): void {
    this.recordCrud.list({ limit: 200 }).subscribe((p) => this.records.set(p.results));
  }

  openPatientForm(p?: any): void {
    this.clearPendingPhoto();
    this.nviVerified.set(!!p?.nvi_verified);
    this.nviReference.set(p?.nvi_reference || '');
    this.patientHasPhoto.set(!!p?.has_photo);
    this.removePhotoOnSave.set(false);
    if (p) {
      this.patientForm.reset({
        id: p.id,
        nationality: p.nationality || 'tc',
        first_name: p.first_name,
        last_name: p.last_name,
        tckn: p.tckn || '',
        birth_date: p.birth_date ? new Date(p.birth_date) : null,
        mobile_phone: p.mobile_phone || p.phone || '',
        email: p.email || '',
        home_phone: p.home_phone || '',
        work_phone: p.work_phone || '',
      });
      this.patientForm.setControl('home_address', this.patchAddressGroup(p.home_address));
      this.patientForm.setControl('work_address', this.patchAddressGroup(p.work_address));
    } else {
      this.patientForm.reset({
        id: null,
        nationality: 'tc',
        first_name: '',
        last_name: '',
        tckn: '',
        birth_date: null,
        mobile_phone: '',
        email: '',
        home_phone: '',
        work_phone: '',
      });
      this.patientForm.setControl('home_address', emptyAddressGroup(this.fb));
      this.patientForm.setControl('work_address', emptyAddressGroup(this.fb));
    }
    const nationality = this.patientForm.value.nationality || 'tc';
    const tcknCtrl = this.patientForm.get('tckn')!;
    tcknCtrl.setValidators(patientIdentityValidator(nationality));
    tcknCtrl.updateValueAndValidity({ emitEvent: false });
    this.editingPatient.set(true);
  }

  private patchAddressGroup(data: Record<string, unknown> | undefined) {
    const g = emptyAddressGroup(this.fb);
    if (data) {
      const normalized = { ...data } as Record<string, unknown>;
      for (const key of [
        'province_code',
        'district_code',
        'neighborhood_code',
        'street_code',
        'building_code',
        'unit_code',
        'address_code',
      ]) {
        const v = normalized[key];
        if (v != null && v !== '') normalized[key] = Number(v);
      }
      g.patchValue(normalized as any);
    }
    return g;
  }

  verifyIdentity(): void {
    const v = this.patientForm.getRawValue();
    if (!v.birth_date) return;
    const payload = {
      nationality: v.nationality,
      first_name: v.first_name,
      last_name: v.last_name,
      birth_date: this.formatDate(v.birth_date),
      tckn: v.tckn,
    };
    this.nvi.verifyIdentity(payload as any).subscribe({
      next: (res) => {
        this.nviVerified.set(res.verified);
        this.nviReference.set(res.reference);
        if (res.normalized_first_name) {
          this.patientForm.patchValue({ first_name: res.normalized_first_name });
        }
        if (res.normalized_last_name) {
          this.patientForm.patchValue({ last_name: res.normalized_last_name });
        }
        this.snack.open(this.translate.instant('patients.nviVerified'), 'OK', { duration: 2000 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('patients.nviFailed'), 'OK', {
          duration: 3500,
        }),
    });
  }

  savePatient(): void {
    if (this.patientForm.invalid) return;
    if (!this.nviVerified()) {
      this.snack.open(this.translate.instant('patients.nviRequired'), 'OK', { duration: 3000 });
      return;
    }
    const v = this.patientForm.getRawValue();
    const payload: Record<string, unknown> = {
      nationality: v.nationality,
      first_name: v.first_name,
      last_name: v.last_name,
      tckn: v.tckn,
      birth_date: v.birth_date ? this.formatDate(v.birth_date) : null,
      mobile_phone: v.mobile_phone,
      email: v.email,
      home_phone: v.home_phone,
      work_phone: v.work_phone,
      home_address: v.home_address,
      work_address: this.hasWorkAddress(v.work_address) ? v.work_address : {},
      nvi_reference: this.nviReference(),
    };
    const op = v.id
      ? this.patientCrud.update(v.id!, payload)
      : this.patientCrud.create(payload);
    op.subscribe({
      next: (saved) => {
        this.syncPatientPhoto(saved.id).subscribe({
          next: () => {
            this.editingPatient.set(false);
            this.clearPendingPhoto();
            this.reloadPatients();
            this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
          },
          error: (e) =>
            this.snack.open(
              e?.error?.detail || this.translate.instant('common.error'),
              'OK',
              { duration: 4000 }
            ),
        });
      },
      error: (e) =>
        this.snack.open(
          e?.error?.detail || Object.values(e?.error || {})[0] || this.translate.instant('common.error'),
          'OK',
          { duration: 4000 }
        ),
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.applyPendingPhoto(file);
  }

  onAvatarFileSelected(file: File): void {
    this.applyPendingPhoto(file);
  }

  private applyPendingPhoto(file: File): void {
    if (file.size > 5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
      this.snack.open(this.translate.instant('patients.photoInvalid'), 'OK', { duration: 3500 });
      return;
    }
    this.revokePendingPhotoPreview();
    this.pendingPhotoFile.set(file);
    this.pendingPhotoPreview.set(URL.createObjectURL(file));
    this.removePhotoOnSave.set(false);
  }

  formInitials(): string {
    const v = this.patientForm.getRawValue();
    const f = (v.first_name || '')[0] || '';
    const l = (v.last_name || '')[0] || '';
    return (f + l).toUpperCase();
  }

  markPhotoForRemoval(): void {
    this.revokePendingPhotoPreview();
    this.pendingPhotoFile.set(null);
    this.pendingPhotoPreview.set(null);
    this.removePhotoOnSave.set(true);
  }

  private syncPatientPhoto(patientId: number): Observable<unknown> {
    const file = this.pendingPhotoFile();
    if (file) {
      const body = new FormData();
      body.append('photo', file);
      return this.http.post(patientPhotoUrl(patientId), body);
    }
    if (this.removePhotoOnSave() && this.patientHasPhoto()) {
      return this.http.delete(patientPhotoUrl(patientId));
    }
    return of(null);
  }

  private clearPendingPhoto(): void {
    this.revokePendingPhotoPreview();
    this.pendingPhotoFile.set(null);
    this.removePhotoOnSave.set(false);
    this.patientHasPhoto.set(false);
  }

  private revokePendingPhotoPreview(): void {
    const preview = this.pendingPhotoPreview();
    if (preview) URL.revokeObjectURL(preview);
  }

  private hasWorkAddress(addr: Record<string, unknown>): boolean {
    return Object.values(addr).some((v) => v != null && v !== '');
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  removePatient(p: any): void {
    const name = p.full_name || `${p.first_name} ${p.last_name}`;
    if (!confirm(this.translate.instant('common.confirmDelete') + ` (${name})`)) return;
    this.patientCrud.remove(p.id).subscribe({
      next: () => {
        this.reloadPatients();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  openRecordForm(r?: any): void {
    this.recordForm.reset(r ? { id: r.id, patient: r.patient, summary: r.summary } : { id: null, patient: null, summary: '' });
    this.editingRecord.set(true);
  }

  saveRecord(): void {
    if (this.recordForm.invalid) return;
    const v = this.recordForm.getRawValue();
    const payload = { patient: v.patient, summary: v.summary };
    const op = v.id ? this.recordCrud.update(v.id!, payload) : this.recordCrud.create(payload);
    op.subscribe({
      next: () => {
        this.editingRecord.set(false);
        this.reloadRecords();
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }

  removeRecord(r: any): void {
    if (!confirm(this.translate.instant('common.confirmDelete'))) return;
    this.recordCrud.remove(r.id).subscribe({
      next: () => {
        this.reloadRecords();
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) => this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }
}

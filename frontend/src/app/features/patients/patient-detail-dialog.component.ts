import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, Output, EventEmitter, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CrudService } from '../../shared/crud.service';
import { PATIENT_DETAIL_DIALOG_STYLES } from '../../shared/crud-styles';
import { PHONE_COUNTRIES, formatGenericPhoneDisplay } from '../../shared/phone-format.utils';
import { PatientPhotoAvatarComponent } from '../../shared/patient-photo-avatar.component';
import { PatientOverviewTabComponent } from './patient-overview-tab.component';
import { PatientOralTabComponent } from './patient-oral-tab.component';
import { PatientPrescriptionsTabComponent } from './patient-prescriptions-tab.component';
import { PatientRecordsTabComponent } from './patient-records-tab.component';

@Component({
  selector: 'app-patient-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    TranslateModule,
    PatientPhotoAvatarComponent,
    PatientOverviewTabComponent,
    PatientOralTabComponent,
    PatientPrescriptionsTabComponent,
    PatientRecordsTabComponent,
  ],
  template: `
    <header class="patient-detail-header">
      <button
        mat-icon-button
        type="button"
        class="patient-detail-header__close"
        (click)="closed.emit()"
        [attr.aria-label]="'common.cancel' | translate"
      >
        <mat-icon>close</mat-icon>
      </button>

      <div class="patient-detail-header__body">
        <div class="patient-detail-header__text">
          <p class="patient-detail-header__line patient-detail-header__line--name">{{ displayFullName }}</p>
          <hr class="patient-detail-header__rule" />
          <p class="patient-detail-header__line patient-detail-header__line--meta">{{ mobilePhoneLabel }}</p>
          <hr class="patient-detail-header__rule" />
          <p class="patient-detail-header__line patient-detail-header__line--meta">{{ patient()?.['email'] || '—' }}</p>
        </div>

        <div class="patient-detail-header__avatar">
          <app-patient-photo-avatar
            [patientId]="patientId"
            [hasPhoto]="!!patient()?.['has_photo']"
            [initials]="initials"
            [editable]="false"
            [size]="112"
          />
        </div>
      </div>
    </header>

    <div class="dialog__body-tabs patient-detail-tabs">
      <mat-tab-group [selectedIndex]="selectedTab()" (selectedIndexChange)="onTabChange($event)">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="patient-detail-tabs__icon">person</mat-icon>
            {{ 'patients.tabOverview' | translate }}
          </ng-template>
          @if (fullPatient()) {
          <app-patient-overview-tab [patient]="fullPatient()!" />
          } @else {
          <div class="patient-detail-loading">
            <mat-icon>hourglass_empty</mat-icon>
            {{ 'common.loading' | translate }}
          </div>
          }
        </mat-tab>

        @if (canAccessOral()) {
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="patient-detail-tabs__icon">dentistry</mat-icon>
            {{ 'patients.tabOral' | translate }}
          </ng-template>
          @if (oralTabVisited()) {
          <app-patient-oral-tab [patientId]="patientId" />
          }
        </mat-tab>
        }

        @if (canAccessPrescriptions()) {
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="patient-detail-tabs__icon">medication</mat-icon>
            {{ 'patients.tabPrescriptions' | translate }}
          </ng-template>
          @if (prescriptionsTabVisited()) {
          <app-patient-prescriptions-tab
            [patientId]="patientId"
            [patientName]="displayFullName"
          />
          }
        </mat-tab>
        }

        @if (hasRecordsTab()) {
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="patient-detail-tabs__icon">folder_open</mat-icon>
            {{ 'patients.tabRecords' | translate }}
          </ng-template>
          @if (recordsTabVisited()) {
          <app-patient-records-tab [patientId]="patientId" />
          }
        </mat-tab>
        }
      </mat-tab-group>
    </div>
  `,
  styles: [PATIENT_DETAIL_DIALOG_STYLES],
})
export class PatientDetailDialogComponent implements OnInit {
  @Input({ required: true }) patientId!: number;
  @Input() patientSummary: Record<string, any> | null = null;
  @Input() initialTab = 0;
  @Output() closed = new EventEmitter<void>();

  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private patientCrud = new CrudService<any>(this.http, 'patients', this.auth, 'patients');

  patient = signal<Record<string, any> | null>(null);
  fullPatient = signal<Record<string, any> | null>(null);
  selectedTab = signal(0);
  oralTabVisited = signal(false);
  prescriptionsTabVisited = signal(false);
  recordsTabVisited = signal(false);

  ngOnInit(): void {
    this.patient.set(this.patientSummary);
    this.selectedTab.set(this.initialTab);
    this.markTabVisited(this.initialTab);
    this.patientCrud.get(this.patientId).subscribe({
      next: (p) => {
        this.fullPatient.set(p);
        this.patient.set(p);
      },
      error: () => {
        if (this.patientSummary) this.fullPatient.set(this.patientSummary);
      },
    });
  }

  get displayFullName(): string {
    const p = this.patient();
    if (!p) return '—';
    const name = [p['first_name'], p['last_name']]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');
    return name || '—';
  }

  get mobilePhoneLabel(): string {
    const p = this.patient();
    const raw = String(p?.['mobile_phone'] || p?.['phone'] || '').trim();
    if (!raw) return '—';
    const formatted = formatGenericPhoneDisplay(raw, PHONE_COUNTRIES[0]);
    return `${PHONE_COUNTRIES[0].dial} ${formatted}`;
  }

  get initials(): string {
    const p = this.patient();
    if (!p) return '';
    const f = (p['first_name'] || '')[0] || '';
    const l = (p['last_name'] || '')[0] || '';
    return (f + l).toUpperCase();
  }

  canAccessOral = () => this.auth.hasModule('oral') && this.auth.hasPermission('oral.read');

  canAccessPrescriptions = () =>
    this.auth.hasModule('patients') && this.auth.hasPermission('prescriptions.read');

  hasRecordsTab = () => {
    const billing =
      this.auth.hasModule('billing') && this.auth.hasPermission('billing.read');
    const medical =
      this.auth.hasModule('patients') && this.auth.hasPermission('patients.read');
    const accounting =
      this.auth.hasModule('accounting') && this.auth.hasPermission('accounting.read');
    return billing || medical || accounting;
  };

  oralTabIndex = () => (this.canAccessOral() ? 1 : -1);
  prescriptionsTabIndex = () => {
    if (!this.canAccessPrescriptions()) return -1;
    return (this.canAccessOral() ? 1 : 0) + 1;
  };
  recordsTabIndex = () => {
    if (!this.hasRecordsTab()) return -1;
    let idx = 1;
    if (this.canAccessOral()) idx += 1;
    if (this.canAccessPrescriptions()) idx += 1;
    return idx;
  };

  onTabChange(index: number): void {
    this.selectedTab.set(index);
    this.markTabVisited(index);
  }

  private markTabVisited(index: number): void {
    if (index === this.oralTabIndex()) this.oralTabVisited.set(true);
    if (index === this.prescriptionsTabIndex()) this.prescriptionsTabVisited.set(true);
    if (index === this.recordsTabIndex()) this.recordsTabVisited.set(true);
  }
}

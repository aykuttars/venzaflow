import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, Output, EventEmitter, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { CrudService } from '../../shared/crud.service';
import { PatientPhotoAvatarComponent } from '../../shared/patient-photo-avatar.component';
import { PatientOverviewTabComponent } from './patient-overview-tab.component';
import { PatientOralTabComponent } from './patient-oral-tab.component';
import { PatientRecordsTabComponent } from './patient-records-tab.component';

@Component({
  selector: 'app-patient-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatTabsModule,
    RouterLink,
    TranslateModule,
    PatientPhotoAvatarComponent,
    PatientOverviewTabComponent,
    PatientOralTabComponent,
    PatientRecordsTabComponent,
  ],
  template: `
    <header class="patient-detail-hero">
      <button
        mat-icon-button
        type="button"
        class="patient-detail-hero__close"
        (click)="closed.emit()"
        [attr.aria-label]="'common.cancel' | translate"
      >
        <mat-icon>close</mat-icon>
      </button>

      <div class="patient-detail-hero__main">
        <div class="patient-detail-hero__info">
          <p class="patient-detail-hero__eyebrow">{{ 'patients.detailTitle' | translate }}</p>
          <h2 class="patient-detail-hero__name">{{ displayName }}</h2>
          <div class="patient-detail-hero__chips">
            @if (patient()?.['tckn'] || patient()?.['foreign_id']) {
            <span class="patient-detail-hero__chip">
              <mat-icon>badge</mat-icon>
              {{ patient()?.['tckn'] || patient()?.['foreign_id'] }}
            </span>
            }
            @if (patient()?.['mobile_phone'] || patient()?.['phone']) {
            <span class="patient-detail-hero__chip">
              <mat-icon>phone_iphone</mat-icon>
              {{ patient()?.['mobile_phone'] || patient()?.['phone'] }}
            </span>
            }
            @if (patient()?.['email']) {
            <span class="patient-detail-hero__chip patient-detail-hero__chip--truncate">
              <mat-icon>mail</mat-icon>
              {{ patient()?.['email'] }}
            </span>
            }
            @if (patient()?.['nvi_verified']) {
            <span class="patient-detail-hero__chip patient-detail-hero__chip--success">
              <mat-icon>verified</mat-icon>
              {{ 'patients.nviVerified' | translate }}
            </span>
            }
          </div>
          @if (canAccessOral()) {
          <div class="patient-detail-hero__actions">
            <a mat-stroked-button class="patient-detail-hero__oral-btn" [routerLink]="oralFullPageLink()" (click)="closed.emit()">
              <mat-icon>medical_services</mat-icon>
              {{ 'oral.openChart' | translate }}
            </a>
          </div>
          }
        </div>

        <div class="patient-detail-hero__avatar-wrap">
          <app-patient-photo-avatar
            [patientId]="patientId"
            [hasPhoto]="!!patient()?.['has_photo']"
            [initials]="initials"
            [editable]="canWritePatients()"
            [size]="96"
            (photoChanged)="onPhotoChanged($event)"
          />
          @if (canWritePatients()) {
          <span class="patient-detail-hero__avatar-hint">{{ 'patients.photoUpload' | translate }}</span>
          }
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
  styles: [`:host { display: contents; }`],
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
  recordsTabVisited = signal(false);

  canWritePatients = () => this.auth.hasPermission('patients.write');

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

  get displayName(): string {
    const p = this.patient();
    if (!p) return '';
    return p['full_name'] || `${p['first_name'] || ''} ${p['last_name'] || ''}`.trim();
  }

  get initials(): string {
    const p = this.patient();
    if (!p) return '';
    const f = (p['first_name'] || '')[0] || '';
    const l = (p['last_name'] || '')[0] || '';
    return (f + l).toUpperCase();
  }

  onPhotoChanged(event: { hasPhoto: boolean }): void {
    const p = this.patient();
    if (p) {
      const updated = { ...p, has_photo: event.hasPhoto };
      this.patient.set(updated);
      this.fullPatient.set(updated);
    }
  }

  canAccessOral = () => this.auth.hasModule('oral') && this.auth.hasPermission('oral.read');

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
  recordsTabIndex = () => {
    if (!this.hasRecordsTab()) return -1;
    return this.canAccessOral() ? 2 : 1;
  };

  oralFullPageLink(): string[] {
    if (this.auth.moduleParent('oral') === 'patients') {
      return ['/patients', String(this.patientId), 'oral'];
    }
    return ['/oral', String(this.patientId)];
  }

  onTabChange(index: number): void {
    this.selectedTab.set(index);
    this.markTabVisited(index);
  }

  private markTabVisited(index: number): void {
    if (index === this.oralTabIndex()) this.oralTabVisited.set(true);
    if (index === this.recordsTabIndex()) this.recordsTabVisited.set(true);
  }
}

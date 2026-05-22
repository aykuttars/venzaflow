import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';

@Component({
  selector: 'app-patient-overview-tab',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatInputModule, MatIconModule, TranslateModule],
  template: `
    @if (patient) {
    <div class="patient-readonly-form">
      <section class="dialog__section">
        <h3 class="dialog__section-title">{{ 'patients.sectionIdentity' | translate }}</h3>
        <div class="dialog__section-fields">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'patients.nationality' | translate }}</mat-label>
            <input
              matInput
              readonly
              [value]="(patient['nationality'] === 'foreign' ? 'patients.nationalityForeign' : 'patients.nationalityTc') | translate"
            />
          </mat-form-field>
          <div class="dialog__row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'employees.firstName' | translate }}</mat-label>
              <input matInput readonly [value]="patient['first_name'] || '—'" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'employees.lastName' | translate }}</mat-label>
              <input matInput readonly [value]="patient['last_name'] || '—'" />
            </mat-form-field>
          </div>
          @if (patient['nationality'] === 'tc') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'patients.tckn' | translate }}</mat-label>
            <input matInput readonly [value]="patient['tckn'] || '—'" />
          </mat-form-field>
          } @else {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'patients.foreignId' | translate }}</mat-label>
            <input matInput readonly [value]="patient['foreign_id'] || '—'" />
          </mat-form-field>
          }
          <div class="dialog__row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.birthDate' | translate }}</mat-label>
              <input matInput readonly [value]="patient['birth_date'] || '—'" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.age' | translate }}</mat-label>
              <input matInput readonly [value]="ageLabel" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>NVI</mat-label>
            <input
              matInput
              readonly
              [value]="(patient['nvi_verified'] ? 'patients.nviVerified' : 'patients.nviFailed') | translate"
            />
            @if (patient['nvi_verified']) {
            <mat-icon matSuffix color="primary">verified</mat-icon>
            } @else {
            <mat-icon matSuffix color="warn">error_outline</mat-icon>
            }
          </mat-form-field>
        </div>
      </section>

      <section class="dialog__section">
        <h3 class="dialog__section-title">{{ 'patients.sectionContact' | translate }}</h3>
        <div class="dialog__section-fields">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'patients.mobilePhone' | translate }}</mat-label>
            <input matInput readonly [value]="patient['mobile_phone'] || patient['phone'] || '—'" />
            @if (patient['mobile_phone'] || patient['phone']) {
            <mat-icon matSuffix>phone_iphone</mat-icon>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'customers.email' | translate }}</mat-label>
            <input matInput readonly [value]="patient['email'] || '—'" />
            @if (patient['email']) {
            <mat-icon matSuffix>mail</mat-icon>
            }
          </mat-form-field>
          <div class="dialog__row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.homePhone' | translate }}</mat-label>
              <input matInput readonly [value]="patient['home_phone'] || '—'" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.workPhone' | translate }}</mat-label>
              <input matInput readonly [value]="patient['work_phone'] || '—'" />
            </mat-form-field>
          </div>
        </div>
      </section>

      <section class="dialog__section">
        <h3 class="dialog__section-title">{{ 'patients.sectionHomeAddress' | translate }}</h3>
        <div class="dialog__section-fields">
          <div class="address-grid">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.province' | translate }}</mat-label>
              <input matInput readonly [value]="addr('home_address', 'province_name')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.district' | translate }}</mat-label>
              <input matInput readonly [value]="addr('home_address', 'district_name')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.neighborhood' | translate }}</mat-label>
              <input matInput readonly [value]="addr('home_address', 'neighborhood_name')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.street' | translate }}</mat-label>
              <input matInput readonly [value]="addr('home_address', 'street_name')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.building' | translate }}</mat-label>
              <input matInput readonly [value]="addr('home_address', 'building_no')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.unit' | translate }}</mat-label>
              <input matInput readonly [value]="addr('home_address', 'apartment_no')" />
            </mat-form-field>
          </div>
          @if (addr('home_address', 'address_code')) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'patients.address.addressCode' | translate }}</mat-label>
            <input matInput readonly [value]="addr('home_address', 'address_code')" />
          </mat-form-field>
          }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'patients.address.openAddress' | translate }}</mat-label>
            <textarea matInput rows="3" readonly>{{ patient['home_address']?.full_address || '—' }}</textarea>
          </mat-form-field>
        </div>
      </section>

      @if (hasWorkAddress) {
      <section class="dialog__section">
        <h3 class="dialog__section-title">{{ 'patients.sectionWorkAddress' | translate }}</h3>
        <div class="dialog__section-fields">
          <div class="address-grid">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.province' | translate }}</mat-label>
              <input matInput readonly [value]="addr('work_address', 'province_name')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.district' | translate }}</mat-label>
              <input matInput readonly [value]="addr('work_address', 'district_name')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.neighborhood' | translate }}</mat-label>
              <input matInput readonly [value]="addr('work_address', 'neighborhood_name')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.street' | translate }}</mat-label>
              <input matInput readonly [value]="addr('work_address', 'street_name')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.building' | translate }}</mat-label>
              <input matInput readonly [value]="addr('work_address', 'building_no')" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'patients.address.unit' | translate }}</mat-label>
              <input matInput readonly [value]="addr('work_address', 'apartment_no')" />
            </mat-form-field>
          </div>
          @if (addr('work_address', 'address_code')) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'patients.address.addressCode' | translate }}</mat-label>
            <input matInput readonly [value]="addr('work_address', 'address_code')" />
          </mat-form-field>
          }
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'patients.address.openAddress' | translate }}</mat-label>
            <textarea matInput rows="3" readonly>{{ patient['work_address']?.full_address || '—' }}</textarea>
          </mat-form-field>
        </div>
      </section>
      }
    </div>
    }
  `,
  styles: [
    CRUD_DIALOG_STYLES,
    `
      .patient-readonly-form {
        background: #fff;
        border-radius: 12px;
        padding: 8px 20px 16px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(0, 0, 0, 0.06);
      }
      .patient-readonly-form .full-width { width: 100%; }
      .patient-readonly-form input[readonly],
      .patient-readonly-form textarea[readonly] {
        cursor: default;
        color: rgba(0, 0, 0, 0.87);
      }
      .address-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 16px;
      }
      @media (max-width: 600px) {
        .address-grid { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class PatientOverviewTabComponent {
  @Input({ required: true }) patient!: Record<string, any>;

  get age(): number | null {
    const bd = this.patient['birth_date'];
    if (!bd) return null;
    const birth = new Date(bd);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
  }

  get ageLabel(): string {
    return this.age !== null ? `${this.age}` : '—';
  }

  get hasWorkAddress(): boolean {
    const a = this.patient['work_address'];
    if (!a) return false;
    return !!(a.full_address || a.province_name || a.district_name);
  }

  addr(group: 'home_address' | 'work_address', field: string): string {
    const v = this.patient[group]?.[field];
    return v != null && v !== '' ? String(v) : '—';
  }
}

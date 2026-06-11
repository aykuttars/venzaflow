import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { formatBirthDateDisplay, parseBirthDateValue } from '../../shared/date-mask.utils';
import { PHONE_COUNTRIES, formatGenericPhoneDisplay } from '../../shared/phone-format.utils';

@Component({
  selector: 'app-patient-overview-tab',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  template: `
    @if (patient) {
    <div class="patient-overview">
      <section class="dialog__section">
        <h3 class="dialog__section-title">{{ 'patients.sectionIdentity' | translate }}</h3>
        <div class="dialog__row dialog__row--doc">
          <div class="overview-field">
            <span class="overview-field__label">{{ 'patients.nationality' | translate }}</span>
            <span class="overview-field__value">{{
              (patient['nationality'] === 'foreign' ? 'patients.nationalityForeign' : 'patients.nationalityTc') | translate
            }}</span>
          </div>
          <div class="overview-field">
            <span class="overview-field__label">{{
              (patient['nationality'] === 'foreign' ? 'patients.foreignId' : 'patients.tckn') | translate
            }}</span>
            <span class="overview-field__value">{{ patient['tckn'] || '—' }}</span>
          </div>
        </div>
        <div class="dialog__row">
          <div class="overview-field">
            <span class="overview-field__label">{{ 'employees.firstName' | translate }}</span>
            <span class="overview-field__value">{{ patient['first_name'] || '—' }}</span>
          </div>
          <div class="overview-field">
            <span class="overview-field__label">{{ 'employees.lastName' | translate }}</span>
            <span class="overview-field__value">{{ patient['last_name'] || '—' }}</span>
          </div>
        </div>
        <div class="dialog__row">
          <div class="overview-field">
            <span class="overview-field__label">{{ 'patients.birthDate' | translate }}</span>
            <span class="overview-field__value">{{ birthDateLabel }}</span>
          </div>
          <div class="overview-field">
            <span class="overview-field__label">{{ 'patients.age' | translate }}</span>
            <span class="overview-field__value">{{ ageLabel }}</span>
          </div>
        </div>
        <div class="overview-field overview-field--inline">
          <span class="overview-field__label">NVI</span>
          <span class="overview-field__value overview-field__value--nvi">
            @if (patient['nvi_verified']) {
            <mat-icon color="primary">verified</mat-icon>
            }
            {{ (patient['nvi_verified'] ? 'patients.nviVerified' : 'patients.nviFailed') | translate }}
          </span>
        </div>
      </section>

      <section class="dialog__section">
        <h3 class="dialog__section-title">{{ 'patients.sectionContact' | translate }}</h3>
        <div class="dialog__row">
          <div class="overview-field">
            <span class="overview-field__label">{{ 'patients.mobilePhone' | translate }}</span>
            <span class="overview-field__value">{{ mobilePhoneLabel }}</span>
          </div>
          <div class="overview-field">
            <span class="overview-field__label">{{ 'customers.email' | translate }}</span>
            <span class="overview-field__value">{{ patient['email'] || '—' }}</span>
          </div>
        </div>
        <div class="dialog__row">
          <div class="overview-field">
            <span class="overview-field__label">{{ 'patients.homePhone' | translate }}</span>
            <span class="overview-field__value">{{ phoneLabel(patient['home_phone']) }}</span>
          </div>
          <div class="overview-field">
            <span class="overview-field__label">{{ 'patients.workPhone' | translate }}</span>
            <span class="overview-field__value">{{ phoneLabel(patient['work_phone']) }}</span>
          </div>
        </div>
      </section>

      <section class="dialog__section">
        <h3 class="dialog__section-title">{{ 'patients.sectionHomeAddress' | translate }}</h3>
        <div class="overview-field">
          <span class="overview-field__label">{{ 'patients.fullAddress' | translate }}</span>
          <span class="overview-field__value overview-field__value--multiline">{{
            patient['home_address']?.full_address || '—'
          }}</span>
        </div>
      </section>

      @if (hasWorkAddress) {
      <section class="dialog__section">
        <h3 class="dialog__section-title">{{ 'patients.sectionWorkAddress' | translate }}</h3>
        <div class="overview-field">
          <span class="overview-field__label">{{ 'patients.fullAddress' | translate }}</span>
          <span class="overview-field__value overview-field__value--multiline">{{
            patient['work_address']?.full_address || '—'
          }}</span>
        </div>
      </section>
      }
    </div>
    }
  `,
  styles: [
    CRUD_DIALOG_STYLES,
    `
      .patient-overview {
        background: #fff;
        border-radius: 12px;
        padding: 8px 20px 16px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(0, 0, 0, 0.06);
      }
      .dialog__row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px 16px;
        align-items: start;
        margin-bottom: 12px;
      }
      .dialog__row--doc {
        grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
      }
      .overview-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .overview-field--inline {
        margin-top: 4px;
      }
      .overview-field__label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.65;
      }
      .overview-field__value {
        font-size: 14px;
        line-height: 1.45;
        color: rgba(0, 0, 0, 0.87);
        word-break: break-word;
      }
      .overview-field__value--multiline {
        white-space: pre-wrap;
      }
      .overview-field__value--nvi {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .overview-field__value--nvi mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
      @media (max-width: 720px) {
        .dialog__row,
        .dialog__row--doc {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class PatientOverviewTabComponent {
  @Input({ required: true }) patient!: Record<string, any>;

  get birthDateLabel(): string {
    const date = parseBirthDateValue(this.patient['birth_date']);
    return date ? formatBirthDateDisplay(date) : '—';
  }

  get age(): number | null {
    const date = parseBirthDateValue(this.patient['birth_date']);
    if (!date) return null;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age -= 1;
    return age;
  }

  get ageLabel(): string {
    return this.age !== null ? `${this.age}` : '—';
  }

  get mobilePhoneLabel(): string {
    const raw = this.patient['mobile_phone'] || this.patient['phone'];
    return this.phoneLabel(raw, true);
  }

  get hasWorkAddress(): boolean {
    const a = this.patient['work_address'];
    return !!(a?.full_address?.trim());
  }

  phoneLabel(value: unknown, withDial = false): string {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    const formatted = formatGenericPhoneDisplay(raw, PHONE_COUNTRIES[0]);
    return withDial ? `${PHONE_COUNTRIES[0].dial} ${formatted}` : formatted;
  }
}

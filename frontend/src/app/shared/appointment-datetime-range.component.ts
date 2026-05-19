import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { formatDateTimeLocal, normalizeDateTimeInput, parseDateTimeLocal } from './date-utils';
import {
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  combineHourMinute,
  parseHourMinute,
} from './time-options';

@Component({
  selector: 'app-appointment-datetime-range',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
    TranslateModule,
  ],
  template: `
    <div class="appt-range">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="appt-range__date">
        <mat-label>{{ 'appointments.dateRange' | translate }}</mat-label>
        <mat-date-range-input [rangePicker]="rangePicker">
          <input matStartDate [formControl]="startDate" [placeholder]="'appointments.start' | translate" />
          <input matEndDate [formControl]="endDate" [placeholder]="'appointments.end' | translate" />
        </mat-date-range-input>
        <mat-datepicker-toggle matIconSuffix [for]="rangePicker"></mat-datepicker-toggle>
        <mat-date-range-picker #rangePicker></mat-date-range-picker>
      </mat-form-field>

      <div class="appt-range__times">
        <div class="appt-range__time-row">
          <span class="appt-range__time-label">{{ 'appointments.startTime' | translate }}</span>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="appt-range__select">
            <mat-label>{{ 'common.hour' | translate }}</mat-label>
            <mat-select [formControl]="startHour">
              @for (h of hourOptions; track h) {
              <mat-option [value]="h">{{ h }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="appt-range__select">
            <mat-label>{{ 'common.minute' | translate }}</mat-label>
            <mat-select [formControl]="startMinute">
              @for (m of minuteOptions; track m) {
              <mat-option [value]="m">{{ m }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <div class="appt-range__time-row">
          <span class="appt-range__time-label">{{ 'appointments.endTime' | translate }}</span>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="appt-range__select">
            <mat-label>{{ 'common.hour' | translate }}</mat-label>
            <mat-select [formControl]="endHour">
              @for (h of hourOptions; track h) {
              <mat-option [value]="h">{{ h }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="appt-range__select">
            <mat-label>{{ 'common.minute' | translate }}</mat-label>
            <mat-select [formControl]="endMinute">
              @for (m of minuteOptions; track m) {
              <mat-option [value]="m">{{ m }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      .appt-range {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        min-width: 0;
      }
      .appt-range__date {
        width: 100%;
        min-width: 0;
      }
      .appt-range__date ::ng-deep .mat-date-range-input {
        min-width: 0;
      }
      .appt-range__date ::ng-deep .mat-date-range-input-container {
        flex-wrap: wrap;
      }
      .appt-range__times {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        min-width: 0;
      }
      .appt-range__time-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        width: 100%;
      }
      .appt-range__time-label {
        grid-column: 1 / -1;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: rgba(0, 0, 0, 0.65);
        margin-bottom: 2px;
      }
      .appt-range__select {
        width: 100%;
        min-width: 0;
      }
      @media (max-width: 400px) {
        .appt-range__time-row {
          grid-template-columns: 1fr 1fr;
        }
        .appt-range__time-label {
          grid-column: 1 / -1;
        }
      }
    `,
  ],
})
export class AppointmentDatetimeRangeComponent implements OnInit, OnDestroy {
  @Input({ required: true }) startControl!: FormControl<string>;
  @Input({ required: true }) endControl!: FormControl<string>;

  readonly hourOptions = HOUR_OPTIONS;
  readonly minuteOptions = MINUTE_OPTIONS;

  startDate = new FormControl<Date | null>(null);
  endDate = new FormControl<Date | null>(null);
  startHour = new FormControl('09', { nonNullable: true });
  startMinute = new FormControl('00', { nonNullable: true });
  endHour = new FormControl('10', { nonNullable: true });
  endMinute = new FormControl('00', { nonNullable: true });

  private subs = new Subscription();
  private syncing = false;

  ngOnInit(): void {
    this.syncFromControls();
    this.subs.add(this.startControl.valueChanges.subscribe(() => this.syncFromControls()));
    this.subs.add(this.endControl.valueChanges.subscribe(() => this.syncFromControls()));

    const emit = () => this.pushToControls();
    this.subs.add(this.startDate.valueChanges.subscribe(emit));
    this.subs.add(this.endDate.valueChanges.subscribe(emit));
    this.subs.add(this.startHour.valueChanges.subscribe(emit));
    this.subs.add(this.startMinute.valueChanges.subscribe(emit));
    this.subs.add(this.endHour.valueChanges.subscribe(emit));
    this.subs.add(this.endMinute.valueChanges.subscribe(emit));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private syncFromControls(): void {
    if (this.syncing) return;
    this.syncing = true;

    const start = parseDateTimeLocal(normalizeDateTimeInput(this.startControl.value));
    const end = parseDateTimeLocal(normalizeDateTimeInput(this.endControl.value));

    this.startDate.setValue(start, { emitEvent: false });
    this.endDate.setValue(end, { emitEvent: false });

    if (start) {
      const st = parseHourMinute(`${start.getHours()}:${start.getMinutes()}`);
      this.startHour.setValue(st.hour, { emitEvent: false });
      this.startMinute.setValue(st.minute, { emitEvent: false });
    }
    if (end) {
      const et = parseHourMinute(`${end.getHours()}:${end.getMinutes()}`);
      this.endHour.setValue(et.hour, { emitEvent: false });
      this.endMinute.setValue(et.minute, { emitEvent: false });
    }

    this.syncing = false;
  }

  private pushToControls(): void {
    if (this.syncing) return;
    this.syncing = true;

    const start = this.combine(this.startDate.value, this.startHour.value, this.startMinute.value);
    const end = this.combine(this.endDate.value, this.endHour.value, this.endMinute.value);

    this.startControl.setValue(start ? formatDateTimeLocal(start) : '', { emitEvent: false });
    this.endControl.setValue(end ? formatDateTimeLocal(end) : '', { emitEvent: false });
    this.startControl.markAsDirty();
    this.endControl.markAsDirty();

    this.syncing = false;
  }

  private combine(date: Date | null, hour: string, minute: string): Date | null {
    if (!date) return null;
    const d = new Date(date);
    const [h, m] = combineHourMinute(hour, minute).split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }
}

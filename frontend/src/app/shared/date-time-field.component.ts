import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';

import { formatDateTimeLocal, normalizeDateTimeInput, parseDateTimeLocal } from './date-utils';
import {
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  combineHourMinute,
  parseHourMinute,
} from './time-options';

@Component({
  selector: 'app-date-time-field',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
    TranslateModule,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateTimeFieldComponent),
      multi: true,
    },
  ],
  template: `
    <div class="date-time-field">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-time-field__date">
        <mat-label>{{ labelKey | translate }}</mat-label>
        <input
          matInput
          [matDatepicker]="picker"
          [required]="required"
          [(ngModel)]="dateModel"
          [ngModelOptions]="{ standalone: true }"
          (dateChange)="onDateChange($event)"
          (blur)="onTouched()"
        />
        <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>
      <div class="date-time-field__time">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-time-field__hour">
          <mat-label>{{ 'common.hour' | translate }}</mat-label>
          <mat-select
            [(ngModel)]="hourModel"
            [ngModelOptions]="{ standalone: true }"
            [required]="required"
            (selectionChange)="onTimeChange()"
            (blur)="onTouched()"
          >
            @for (h of hourOptions; track h) {
            <mat-option [value]="h">{{ h }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="date-time-field__minute">
          <mat-label>{{ 'common.minute' | translate }}</mat-label>
          <mat-select
            [(ngModel)]="minuteModel"
            [ngModelOptions]="{ standalone: true }"
            [required]="required"
            (selectionChange)="onTimeChange()"
            (blur)="onTouched()"
          >
            @for (m of minuteOptions; track m) {
            <mat-option [value]="m">{{ m }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    </div>
  `,
  styles: [
    `
      .date-time-field {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: start;
        width: 100%;
      }
      .date-time-field__date {
        min-width: 0;
      }
      .date-time-field__time {
        display: flex;
        gap: 8px;
        align-items: start;
      }
      .date-time-field__hour,
      .date-time-field__minute {
        width: 88px;
      }
      @media (max-width: 520px) {
        .date-time-field {
          grid-template-columns: 1fr;
        }
        .date-time-field__time {
          width: 100%;
        }
        .date-time-field__hour,
        .date-time-field__minute {
          flex: 1;
          width: auto;
        }
      }
    `,
  ],
})
export class DateTimeFieldComponent implements ControlValueAccessor {
  @Input({ required: true }) labelKey!: string;
  @Input() required = false;

  readonly hourOptions = HOUR_OPTIONS;
  readonly minuteOptions = MINUTE_OPTIONS;

  dateModel: Date | null = null;
  hourModel = '09';
  minuteModel = '00';

  private onChange: (v: string) => void = () => undefined;
  onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const normalized = normalizeDateTimeInput(value);
    if (!normalized) {
      this.dateModel = null;
      this.hourModel = '09';
      this.minuteModel = '00';
      return;
    }
    const d = parseDateTimeLocal(normalized);
    if (!d) {
      this.dateModel = null;
      return;
    }
    this.dateModel = d;
    const { hour, minute } = parseHourMinute(
      `${d.getHours()}:${d.getMinutes()}`
    );
    this.hourModel = hour;
    this.minuteModel = minute;
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(): void {
    // noop
  }

  onDateChange(event: MatDatepickerInputEvent<Date>): void {
    this.dateModel = event.value;
    this.emit();
  }

  onTimeChange(): void {
    this.emit();
  }

  private emit(): void {
    if (!this.dateModel) {
      this.onChange('');
      return;
    }
    const d = new Date(this.dateModel);
    const [h, m] = combineHourMinute(this.hourModel, this.minuteModel).split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    this.onChange(formatDateTimeLocal(d));
    this.onTouched();
  }
}

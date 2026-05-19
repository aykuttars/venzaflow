import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

import { formatDateOnly, normalizeDateInput, parseDateTimeLocal } from './date-utils';

@Component({
  selector: 'app-date-field',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, TranslateModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateFieldComponent),
      multi: true,
    },
  ],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
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
  `,
})
export class DateFieldComponent implements ControlValueAccessor {
  @Input({ required: true }) labelKey!: string;
  @Input() required = false;

  dateModel: Date | null = null;

  private onChange: (v: string) => void = () => undefined;
  onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const normalized = normalizeDateInput(value);
    this.dateModel = normalized ? parseDateTimeLocal(normalized) : null;
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(): void {
    // Parent FormControl disabled state propagates when using formControlName on host
  }

  onDateChange(event: MatDatepickerInputEvent<Date>): void {
    this.dateModel = event.value;
    this.onChange(formatDateOnly(event.value));
    this.onTouched();
  }
}

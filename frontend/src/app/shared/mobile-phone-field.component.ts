import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';

import {
  PHONE_COUNTRIES,
  PhoneCountry,
  formatGenericPhoneDisplay,
  normalizePhoneForBackend,
} from './phone-format.utils';

@Component({
  selector: 'app-mobile-phone-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatSelectModule, TranslateModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MobilePhoneFieldComponent),
      multi: true,
    },
  ],
  template: `
    <div class="mobile-phone-field">
      <mat-form-field appearance="outline" class="mobile-phone-field__country">
        <mat-select [value]="country.code" (selectionChange)="onCountryChange($event.value)">
          @for (c of countries; track c.code) {
          <mat-option [value]="c.code">{{ c.dial }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="mobile-phone-field__number">
        <mat-label>{{ labelKey | translate }}</mat-label>
        <input
          matInput
          type="tel"
          inputmode="tel"
          autocomplete="tel-national"
          [required]="required"
          [disabled]="disabled"
          [value]="display"
          [attr.maxlength]="maxLength"
          (input)="onInput($event)"
          (blur)="onTouched()"
        />
      </mat-form-field>
    </div>
  `,
  styles: [
    `
      .mobile-phone-field {
        display: grid;
        grid-template-columns: 108px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        width: 100%;
      }
      .mobile-phone-field__country,
      .mobile-phone-field__number {
        width: 100%;
      }
    `,
  ],
})
export class MobilePhoneFieldComponent implements ControlValueAccessor {
  @Input({ required: true }) labelKey!: string;
  @Input() required = false;

  countries = PHONE_COUNTRIES;
  country: PhoneCountry = PHONE_COUNTRIES[0];
  display = '';
  maxLength = 17;
  disabled = false;

  private onChange: (v: string) => void = () => undefined;
  onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const clean = normalizePhoneForBackend(value || '', this.country);
    this.display = formatGenericPhoneDisplay(clean, this.country);
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onCountryChange(code: string): void {
    const next = this.countries.find((c) => c.code === code) || PHONE_COUNTRIES[0];
    this.country = next;
    this.maxLength = next.code === 'TR' ? 17 : next.nationalLength + 4;
    const clean = normalizePhoneForBackend(this.display, next);
    this.display = formatGenericPhoneDisplay(clean, next);
    this.emit(clean);
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = normalizePhoneForBackend(input.value, this.country).slice(0, this.country.nationalLength);
    this.display = formatGenericPhoneDisplay(clean, this.country);
    input.value = this.display;
    this.emit(clean);
  }

  private emit(clean: string): void {
    this.onChange(clean);
  }
}

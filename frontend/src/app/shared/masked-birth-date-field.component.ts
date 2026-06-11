import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

import {
  formatBirthDateDisplay,
  maskBirthDateInput,
  parseBirthDateMasked,
  parseBirthDateValue,
} from './date-mask.utils';

@Component({
  selector: 'app-masked-birth-date-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, TranslateModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MaskedBirthDateFieldComponent),
      multi: true,
    },
  ],
  template: `
    <mat-form-field appearance="outline" class="full-width">
      <mat-label>{{ labelKey | translate }}</mat-label>
      <input
        matInput
        type="text"
        inputmode="numeric"
        autocomplete="bday"
        placeholder="GG.AA.YYYY"
        [required]="required"
        [disabled]="disabled"
        [value]="display"
        maxlength="10"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />
    </mat-form-field>
  `,
  styles: [` .full-width { width: 100%; } `],
})
export class MaskedBirthDateFieldComponent implements ControlValueAccessor {
  @Input({ required: true }) labelKey!: string;
  @Input() required = false;

  display = '';
  disabled = false;

  private onChange: (v: Date | null) => void = () => undefined;
  onTouched: () => void = () => undefined;

  writeValue(value: Date | string | null): void {
    const date = parseBirthDateValue(value);
    this.display = date ? formatBirthDateDisplay(date) : '';
  }

  registerOnChange(fn: (v: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.display = maskBirthDateInput(input.value);
    input.value = this.display;
    if (this.display.length === 10) {
      this.onChange(parseBirthDateMasked(this.display));
    } else {
      this.onChange(null);
    }
  }

  onBlur(): void {
    if (this.display.length === 10) {
      this.onChange(parseBirthDateMasked(this.display));
    }
    this.onTouched();
  }
}

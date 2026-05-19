import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

const PHONE_CHARS = /^[+()\d\s-]*$/;
const PHONE_MIN_DIGITS = 7;
const PHONE_MAX_DIGITS = 20;

export function countPhoneDigits(value: string): number {
  return (value.match(/\d/g) || []).length;
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!PHONE_CHARS.test(trimmed)) return false;
  const digits = countPhoneDigits(trimmed);
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
}

export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (v == null || String(v).trim() === '') return null;
    return isValidPhone(String(v)) ? null : { phoneInvalid: true };
  };
}

export function emailOptionalValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (v == null || String(v).trim() === '') return null;
    return Validators.email(control);
  };
}

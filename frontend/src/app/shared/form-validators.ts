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

export function emailRequiredValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (v == null || String(v).trim() === '') return { emailRequired: true };
    return Validators.email(control);
  };
}

export function phoneRequiredValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (v == null || String(v).trim() === '') return { phoneRequired: true };
    return isValidPhone(String(v)) ? null : { phoneInvalid: true };
  };
}

export function isValidTckn(value: string): boolean {
  const text = (value || '').trim();
  if (text.length !== 11 || !/^\d+$/.test(text) || text[0] === '0') return false;
  const d = text.split('').map(Number);
  const tenth = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
  if (tenth !== d[9]) return false;
  return (d.slice(0, 10).reduce((a, b) => a + b, 0) % 10) === d[10];
}

export function tcknValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value || '').trim();
    if (!v) return { tcknRequired: true };
    return isValidTckn(v) ? null : { tcknInvalid: true };
  };
}

export function foreignKimlikValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value || '').trim();
    if (!v) return { identityRequired: true };
    if (v.length !== 11 || !/^\d+$/.test(v) || v[0] !== '9') {
      return { foreignKimlikInvalid: true };
    }
    return null;
  };
}

export function patientIdentityValidator(nationality: 'tc' | 'foreign'): ValidatorFn {
  return nationality === 'tc' ? tcknValidator() : foreignKimlikValidator();
}

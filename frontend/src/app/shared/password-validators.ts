import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const SPECIAL = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/;

export function passwordPolicyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value as string;
    if (!v) return null;
    if (v.length < 12) return { passwordPolicy: 'En az 12 karakter olmalı.' };
    if (!/[A-Z]/.test(v)) return { passwordPolicy: 'En az bir büyük harf gerekli.' };
    if (!/[a-z]/.test(v)) return { passwordPolicy: 'En az bir küçük harf gerekli.' };
    if (!/\d/.test(v)) return { passwordPolicy: 'En az bir rakam gerekli.' };
    if (!SPECIAL.test(v)) return { passwordPolicy: 'En az bir özel karakter gerekli.' };
    return null;
  };
}

export function passwordMatchValidator(
  passwordKey: string,
  confirmKey: string
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const pw = group.get(passwordKey)?.value;
    const cf = group.get(confirmKey)?.value;
    if (!pw && !cf) return null;
    return pw === cf ? null : { passwordMismatch: true };
  };
}

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const SPECIAL = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/;

export function passwordPolicyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value as string;
    if (!v) return null;
    if (v.length < 12) return { passwordPolicy: 'password.minLength' };
    if (!/[A-Z]/.test(v)) return { passwordPolicy: 'password.uppercase' };
    if (!/[a-z]/.test(v)) return { passwordPolicy: 'password.lowercase' };
    if (!/\d/.test(v)) return { passwordPolicy: 'password.digit' };
    if (!SPECIAL.test(v)) return { passwordPolicy: 'password.special' };
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

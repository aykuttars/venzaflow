import { Directive, ElementRef, HostListener, OnInit, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

import { PHONE_COUNTRIES, formatGenericPhoneDisplay, normalizePhoneForBackend } from './phone-format.utils';

const ALLOWED_KEY = /^[\d\s()-]$/;
const PHONE_PASTE = /^[\d\s()-]*$/;

@Directive({
  selector: 'input[appPhoneInput]',
  standalone: true,
})
export class PhoneInputDirective implements OnInit {
  private el = inject(ElementRef<HTMLInputElement>);
  private ngControl = inject(NgControl, { optional: true, self: true });

  constructor() {
    const input = this.el.nativeElement;
    input.type = 'tel';
    input.autocomplete = 'tel';
    input.inputMode = 'tel';
  }

  ngOnInit(): void {
    const control = this.ngControl?.control;
    if (!control) return;
    this.syncDisplay(control.value);
    control.valueChanges.subscribe((value) => {
      if (document.activeElement !== this.el.nativeElement) {
        this.syncDisplay(value);
      }
    });
  }

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const country = PHONE_COUNTRIES[0];
    const clean = normalizePhoneForBackend(input.value, country).slice(0, country.nationalLength);
    input.value = formatGenericPhoneDisplay(clean, country);
    this.ngControl?.control?.setValue(clean, { emitEvent: false });
  }

  @HostListener('keypress', ['$event'])
  onKeypress(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;
    if (!ALLOWED_KEY.test(event.key)) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!PHONE_PASTE.test(text)) {
      event.preventDefault();
    }
  }

  @HostListener('blur')
  onBlur(): void {
    const control = this.ngControl?.control;
    if (!control) return;
    this.syncDisplay(control.value);
    control.setValue(normalizePhoneForBackend(String(control.value || ''), PHONE_COUNTRIES[0]) || '');
  }

  private syncDisplay(value: unknown): void {
    const country = PHONE_COUNTRIES[0];
    const clean = normalizePhoneForBackend(String(value || ''), country);
    this.el.nativeElement.value = formatGenericPhoneDisplay(clean, country);
  }
}

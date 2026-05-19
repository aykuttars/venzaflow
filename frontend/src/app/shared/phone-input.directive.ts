import { Directive, ElementRef, HostListener, inject } from '@angular/core';

const ALLOWED_KEY = /^[+\d\s\-()]$/;

@Directive({
  selector: 'input[appPhoneInput]',
  standalone: true,
})
export class PhoneInputDirective {
  private el = inject(ElementRef<HTMLInputElement>);

  constructor() {
    const input = this.el.nativeElement;
    input.type = 'tel';
    input.autocomplete = 'tel';
    input.inputMode = 'tel';
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
}

const PHONE_PASTE = /^[+()\d\s-]*$/;

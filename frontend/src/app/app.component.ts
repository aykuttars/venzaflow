import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';
import { LanguageService } from './core/language.service';
import { ConfirmDialogComponent } from './shared/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialogComponent],
  template: `
    <router-outlet />
    <app-confirm-dialog />
  `,
})
export class AppComponent implements OnInit {
  private auth = inject(AuthService);
  private language = inject(LanguageService);

  ngOnInit(): void {
    const me = this.auth.me();
    if (me) {
      this.language.initFromTenant(
        me.default_language || me.user.tenant_default_language
      );
    }
  }
}

import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';
import { LanguageService } from './core/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
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

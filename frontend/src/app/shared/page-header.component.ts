import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="page-header">
      <mat-icon>{{ icon }}</mat-icon>
      <h1>{{ title }}</h1>
      <span class="spacer"></span>
      <ng-content></ng-content>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() icon = 'dashboard';
}

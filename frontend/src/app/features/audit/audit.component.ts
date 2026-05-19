import { Component } from '@angular/core';
import { SimpleListComponent } from '../../shared/simple-list.component';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [SimpleListComponent],
  template: `
    <app-simple-list
      title="Audit log"
      icon="history"
      path="audit"
      [columns]="[
        { key: 'timestamp', header: 'When' },
        { key: 'action', header: 'Action' },
        { key: 'model', header: 'Model' },
        { key: 'object_repr', header: 'Object' },
        { key: 'actor_email', header: 'Actor' }
      ]"
    ></app-simple-list>
  `,
})
export class AuditComponent {}

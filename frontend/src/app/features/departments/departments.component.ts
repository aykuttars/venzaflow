import { Component } from '@angular/core';
import { SimpleListComponent } from '../../shared/simple-list.component';

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [SimpleListComponent],
  template: `
    <app-simple-list
      title="Departments"
      icon="admin_panel_settings"
      path="departments"
      [columns]="[
        { key: 'key', header: 'Key' },
        { key: 'name', header: 'Name' },
        { key: 'permission_codenames', header: 'Permissions' }
      ]"
    ></app-simple-list>
  `,
})
export class DepartmentsComponent {}

import { Component } from '@angular/core';
import { SimpleListComponent } from '../../shared/simple-list.component';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [SimpleListComponent],
  template: `
    <app-simple-list
      title="Customers / Patients"
      icon="people"
      path="customers"
      [columns]="[
        { key: 'first_name', header: 'First name' },
        { key: 'last_name', header: 'Last name' },
        { key: 'kind', header: 'Type' },
        { key: 'phone', header: 'Phone' },
        { key: 'email', header: 'Email' }
      ]"
    ></app-simple-list>
  `,
})
export class CustomersComponent {}

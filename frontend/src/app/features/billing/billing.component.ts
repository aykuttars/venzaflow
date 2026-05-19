import { Component } from '@angular/core';
import { SimpleListComponent } from '../../shared/simple-list.component';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [SimpleListComponent],
  template: `
    <app-simple-list
      title="Invoices"
      icon="receipt_long"
      path="billing/invoices"
      [columns]="[
        { key: 'number', header: 'Number' },
        { key: 'issued_at', header: 'Issued' },
        { key: 'due_date', header: 'Due' },
        { key: 'status', header: 'Status' },
        { key: 'total', header: 'Total' }
      ]"
    ></app-simple-list>
  `,
})
export class BillingComponent {}

import { Component } from '@angular/core';
import { SimpleListComponent } from '../../shared/simple-list.component';

@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [SimpleListComponent],
  template: `
    <app-simple-list
      title="Transactions"
      icon="savings"
      path="accounting/transactions"
      [columns]="[
        { key: 'kind', header: 'Kind' },
        { key: 'amount', header: 'Amount' },
        { key: 'occurred_at', header: 'When' },
        { key: 'description', header: 'Description' }
      ]"
    ></app-simple-list>
  `,
})
export class AccountingComponent {}

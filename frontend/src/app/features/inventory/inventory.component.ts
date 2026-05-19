import { Component } from '@angular/core';
import { SimpleListComponent } from '../../shared/simple-list.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [SimpleListComponent],
  template: `
    <app-simple-list
      title="Inventory"
      icon="warehouse"
      path="inventory/stock"
      [columns]="[
        { key: 'product_sku', header: 'SKU' },
        { key: 'warehouse_code', header: 'Warehouse' },
        { key: 'quantity', header: 'Quantity' },
        { key: 'reorder_level', header: 'Reorder level' }
      ]"
    ></app-simple-list>
  `,
})
export class InventoryComponent {}

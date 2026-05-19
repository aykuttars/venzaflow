import { Component } from '@angular/core';
import { SimpleListComponent } from '../../shared/simple-list.component';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [SimpleListComponent],
  template: `
    <app-simple-list
      title="Appointments"
      icon="event"
      path="appointments"
      [columns]="[
        { key: 'customer_name', header: 'Customer' },
        { key: 'start_at', header: 'Start' },
        { key: 'end_at', header: 'End' },
        { key: 'status', header: 'Status' }
      ]"
    ></app-simple-list>
  `,
})
export class AppointmentsComponent {}

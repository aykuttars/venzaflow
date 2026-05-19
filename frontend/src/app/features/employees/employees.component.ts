import { Component } from '@angular/core';
import { SimpleListComponent } from '../../shared/simple-list.component';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [SimpleListComponent],
  template: `
    <app-simple-list
      title="Employees"
      icon="badge"
      path="employees"
      [columns]="[
        { key: 'employee_no', header: 'Employee no.' },
        { key: 'email', header: 'Email' },
        { key: 'hire_date', header: 'Hire date' },
        { key: 'salary', header: 'Salary' }
      ]"
    ></app-simple-list>
  `,
})
export class EmployeesComponent {}

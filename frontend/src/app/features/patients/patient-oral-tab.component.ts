import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { OralChartComponent } from '../oral/oral-chart.component';

@Component({
  selector: 'app-patient-oral-tab',
  standalone: true,
  imports: [CommonModule, OralChartComponent],
  template: `
    <app-oral-chart [inputPatientId]="patientId" [dialogMode]="true" />
  `,
})
export class PatientOralTabComponent {
  @Input({ required: true }) patientId!: number;
}

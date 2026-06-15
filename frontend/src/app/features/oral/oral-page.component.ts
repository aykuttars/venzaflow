import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../shared/page-header.component';
import { OralChartComponent } from './oral-chart.component';
import { OralProceduresComponent } from './oral-procedures.component';

@Component({
  selector: 'app-oral-page',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    TranslateModule,
    PageHeaderComponent,
    OralChartComponent,
    OralProceduresComponent,
  ],
  template: `
    <div class="page">
      <app-page-header moduleSlug="oral" icon="medical_services" />
      <mat-tab-group [selectedIndex]="tab()" (selectedIndexChange)="tab.set($event)">
        <mat-tab [label]="'oral.tabChart' | translate">
          @if (tab() === 0) {
          <app-oral-chart [shellMode]="true" />
          }
        </mat-tab>
        <mat-tab [label]="'oral.tabProcedures' | translate">
          @if (tab() === 1) {
          <app-oral-procedures />
          }
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
})
export class OralPageComponent {
  tab = signal(0);
}

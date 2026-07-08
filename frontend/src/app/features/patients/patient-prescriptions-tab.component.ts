import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../core/auth.service';
import { Prescription, PrescriptionService } from '../../core/prescription.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { CRUD_DIALOG_STYLES } from '../../shared/crud-styles';
import { openDocumentPreview } from '../../shared/document-preview-dialog.component';
import { PrescriptionFormComponent } from '../prescriptions/prescription-form.component';

@Component({
  selector: 'app-patient-prescriptions-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatSnackBarModule,
    RouterLink,
    TranslateModule,
    PrescriptionFormComponent,
  ],
  template: `
    <div class="records-tab records-tab--cards">
      <section class="dialog__section">
        <div class="records-tab__toolbar">
          <h3 class="dialog__section-title">{{ 'prescriptions.title' | translate }}</h3>
          @if (canWrite()) {
          <button mat-stroked-button type="button" (click)="openForm()">
            <mat-icon>add</mat-icon> {{ 'prescriptions.new' | translate }}
          </button>
          }
        </div>

        @if (loaded()) {
        @if (items().length) {
        <div class="record-card-list">
          @for (rx of items(); track rx.id) {
          <mat-card class="record-card">
            <mat-card-header>
              <mat-icon mat-card-avatar class="record-card__avatar">medication</mat-icon>
              <mat-card-title>{{ rx.prescription_no || ('#' + rx.id) }}</mat-card-title>
              <mat-card-subtitle>{{ rx.diagnosis_code }} — {{ rx.diagnosis_text }}</mat-card-subtitle>
              <mat-chip-set class="record-card__chips">
                <mat-chip>{{ ('prescriptions.status.' + rx.status) | translate }}</mat-chip>
                <mat-chip>{{ rx.line_count }} {{ 'prescriptions.drugCount' | translate }}</mat-chip>
              </mat-chip-set>
            </mat-card-header>
            <mat-card-content>
              @if (rx.medula_reference) {
              <p class="muted">{{ 'prescriptions.medulaRef' | translate }}: {{ rx.medula_reference }}</p>
              }
            </mat-card-content>
            <mat-card-actions align="end">
              <button mat-button type="button" (click)="openPreview(rx.id)">
                <mat-icon>visibility</mat-icon> {{ 'prescriptions.preview' | translate }}
              </button>
              @if (rx.status === 'draft' && canWrite()) {
              <button mat-button type="button" (click)="openForm(rx)">
                <mat-icon>edit</mat-icon> {{ 'common.edit' | translate }}
              </button>
              <button mat-button type="button" (click)="finalize(rx)">
                <mat-icon>send</mat-icon> {{ 'prescriptions.finalize' | translate }}
              </button>
              }
              @if ((rx.status === 'ready' || rx.status === 'submitted') && canReadSigning()) {
              <a mat-stroked-button routerLink="/signing" [queryParams]="{ document_type: 'erecete' }">
                <mat-icon>draw</mat-icon> {{ 'prescriptions.queueSigning' | translate }}
              </a>
              }
            </mat-card-actions>
          </mat-card>
          }
        </div>
        } @else {
        <p class="muted">{{ 'common.noRecords' | translate }}</p>
        }
        } @else {
        <p class="muted">{{ 'common.loading' | translate }}</p>
        }
      </section>
    </div>

    @if (editing()) {
    <div class="dialog-overlay">
      <div class="dialog dialog--wide">
        <h2>{{ editingRx() ? ('prescriptions.edit' | translate) : ('prescriptions.new' | translate) }}</h2>
        <app-prescription-form
          [patientId]="patientId"
          [patientName]="patientName"
          [prescription]="editingRx()"
          (cancelled)="closeForm()"
          (saved)="onSaved($event)"
          (finalized)="onFinalized($event)"
        />
      </div>
    </div>
    }
  `,
  styles: [CRUD_DIALOG_STYLES],
})
export class PatientPrescriptionsTabComponent implements OnInit {
  @Input({ required: true }) patientId!: number;
  @Input() patientName = '';

  private rxApi = inject(PrescriptionService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private confirm = inject(ConfirmDialogService);
  private dialog = inject(MatDialog);
  protected auth = inject(AuthService);

  items = signal<Prescription[]>([]);
  loaded = signal(false);
  editing = signal(false);
  editingRx = signal<Prescription | null>(null);

  ngOnInit(): void {
    this.load();
  }

  canWrite = () => this.auth.hasPermission('prescriptions.write');
  canReadSigning = () => this.auth.hasModule('signing') && this.auth.hasPermission('signing.read');

  openPreview(id: number): void {
    const rx = this.items().find((item) => item.id === id);
    openDocumentPreview(this.dialog, {
      title: rx?.prescription_no || `#${id}`,
      path: `prescriptions/${id}/preview/`,
    });
  }

  load(): void {
    this.loaded.set(false);
    this.rxApi.list(this.patientId).subscribe({
      next: (page) => {
        this.items.set(page.results ?? []);
        this.loaded.set(true);
      },
      error: () => {
        this.items.set([]);
        this.loaded.set(true);
      },
    });
  }

  openForm(rx: Prescription | null = null): void {
    this.editingRx.set(rx);
    this.editing.set(true);
  }

  closeForm(): void {
    this.editing.set(false);
    this.editingRx.set(null);
  }

  onSaved(rx: Prescription): void {
    this.closeForm();
    this.load();
    void rx;
  }

  onFinalized(rx: Prescription): void {
    this.closeForm();
    this.load();
    void rx;
  }

  finalize(rx: Prescription): void {
    this.rxApi.finalize(rx.id).subscribe({
      next: () => {
        this.snack.open(this.translate.instant('prescriptions.finalized'), 'OK', { duration: 2500 });
        this.load();
      },
      error: () => this.snack.open(this.translate.instant('common.error'), 'OK', { duration: 2500 }),
    });
  }
}

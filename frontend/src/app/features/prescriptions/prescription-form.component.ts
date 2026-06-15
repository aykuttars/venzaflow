import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { API_BASE } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { DrugCatalogItem, Prescription, PrescriptionLine, PrescriptionService } from '../../core/prescription.service';
import { SearchSelectComponent } from '../../shared/search-select.component';

@Component({
  selector: 'app-prescription-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslateModule,
    SearchSelectComponent,
  ],
  template: `
    <form [formGroup]="form" class="rx-form" (ngSubmit)="saveDraft()">
      <div class="dialog__row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'prescriptions.diagnosisCode' | translate }}</mat-label>
          <input matInput formControlName="diagnosis_code" placeholder="K02.1" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'prescriptions.diagnosisText' | translate }}</mat-label>
          <input matInput formControlName="diagnosis_text" />
        </mat-form-field>
      </div>
      <div class="dialog__row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'prescriptions.type' | translate }}</mat-label>
          <mat-select formControlName="prescription_type">
            @for (t of prescriptionTypes; track t) {
            <mat-option [value]="t">{{ ('prescriptions.types.' + t) | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'prescriptions.provision' | translate }}</mat-label>
          <mat-select formControlName="provision_type">
            @for (p of provisionTypes; track p) {
            <mat-option [value]="p">{{ ('prescriptions.provisions.' + p) | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'prescriptions.notes' | translate }}</mat-label>
        <textarea matInput rows="2" formControlName="notes"></textarea>
      </mat-form-field>

      <h4>{{ 'prescriptions.drugs' | translate }}</h4>
      <div formArrayName="lines">
        @for (line of lines.controls; track $index; let i = $index) {
        <div [formGroupName]="i" class="rx-line">
          <app-search-select
            formControlName="drug"
            apiPath="prescriptions/drugs"
            moduleSlug="patients"
            [labelKeys]="['barkod', 'name']"
            [label]="'prescriptions.drug' | translate"
          />
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'prescriptions.drugName' | translate }}</mat-label>
            <input matInput formControlName="drug_name" />
          </mat-form-field>
          <div class="dialog__row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'prescriptions.dose' | translate }}</mat-label>
              <input matInput formControlName="dose" placeholder="1x1" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'prescriptions.frequency' | translate }}</mat-label>
              <input matInput formControlName="frequency" placeholder="Günde 2" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'prescriptions.periodDays' | translate }}</mat-label>
              <input matInput type="number" formControlName="period_days" />
            </mat-form-field>
          </div>
          <div class="dialog__row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'prescriptions.route' | translate }}</mat-label>
              <mat-select formControlName="route">
                @for (r of routes; track r) {
                <mat-option [value]="r">{{ ('prescriptions.routes.' + r) | translate }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'prescriptions.boxCount' | translate }}</mat-label>
              <input matInput type="number" formControlName="box_count" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'prescriptions.usage' | translate }}</mat-label>
            <input matInput formControlName="usage_instruction" />
          </mat-form-field>
          @if (lines.length > 1) {
          <button mat-button type="button" color="warn" (click)="removeLine(i)">
            <mat-icon>delete</mat-icon> {{ 'prescriptions.removeLine' | translate }}
          </button>
          }
        </div>
        }
      </div>
      <button mat-stroked-button type="button" (click)="addLine()">
        <mat-icon>add</mat-icon> {{ 'prescriptions.addLine' | translate }}
      </button>

      <div class="rx-preview">
        <h4>{{ 'prescriptions.previewTitle' | translate }}</h4>
        <div class="rx-preview__paper">
          <p><strong>{{ patientName }}</strong></p>
          <p>{{ form.value.diagnosis_code }} — {{ form.value.diagnosis_text }}</p>
          @for (line of lines.controls; track $index) {
          <p class="rx-preview__line">
            {{ line.value.drug_name || '—' }}:
            {{ line.value.dose }} · {{ line.value.frequency }} · {{ line.value.period_days }}
            {{ 'prescriptions.days' | translate }} · {{ line.value.usage_instruction }}
          </p>
          }
        </div>
      </div>

      <div class="rx-actions">
        <button mat-button type="button" (click)="cancelled.emit()">{{ 'common.cancel' | translate }}</button>
        <button mat-stroked-button type="submit" [disabled]="saving()">{{ 'prescriptions.saveDraft' | translate }}</button>
        @if (canWrite()) {
        <button mat-flat-button color="primary" type="button" [disabled]="saving()" (click)="saveAndFinalize()">
          {{ 'prescriptions.finalize' | translate }}
        </button>
        }
      </div>
    </form>
  `,
  styles: [
    `
      .rx-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .full-width {
        width: 100%;
      }
      .rx-line {
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
      }
      .rx-preview__paper {
        border: 1px solid #333;
        padding: 16px;
        min-height: 120px;
        font-family: Georgia, serif;
        background: #fff;
      }
      .rx-preview__line {
        margin: 8px 0 0;
      }
      .rx-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 8px;
      }
    `,
  ],
})
export class PrescriptionFormComponent implements OnChanges {
  @Input({ required: true }) patientId!: number;
  @Input() patientName = '';
  @Input() prescription: Prescription | null = null;
  @Output() cancelled = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Prescription>();
  @Output() finalized = new EventEmitter<Prescription>();

  private fb = inject(FormBuilder);
  private rxApi = inject(PrescriptionService);
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  protected auth = inject(AuthService);

  saving = signal(false);
  prescriptionTypes = ['normal', 'kirmizi', 'yesil', 'mor', 'turuncu'];
  provisionTypes = ['sgk', 'ucretli', 'yesil_kart', 'emekli'];
  routes = ['oral', 'topical', 'iv', 'im', 'sc', 'other'];

  form = this.fb.group({
    diagnosis_code: ['', Validators.required],
    diagnosis_text: [''],
    prescription_type: ['normal'],
    provision_type: ['sgk'],
    notes: [''],
    lines: this.fb.array([this.newLineGroup()]),
  });

  constructor() {
    this.lines.controls.forEach((ctrl, index) => {
      ctrl.get('drug')?.valueChanges.subscribe((drugId) => {
        if (drugId) this.loadDrugName(index, drugId as number);
      });
    });
  }

  ngOnChanges(): void {
    if (this.prescription) {
      this.form.patchValue({
        diagnosis_code: this.prescription.diagnosis_code,
        diagnosis_text: this.prescription.diagnosis_text,
        prescription_type: this.prescription.prescription_type,
        provision_type: this.prescription.provision_type,
        notes: this.prescription.notes,
      });
      this.lines.clear();
      for (const line of this.prescription.lines) {
        const g = this.lineGroupFrom(line);
        this.lines.push(g);
        const idx = this.lines.length - 1;
        g.get('drug')?.valueChanges.subscribe((drugId) => {
          if (drugId) this.loadDrugName(idx, drugId as number);
        });
      }
    }
  }

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  canWrite = () => this.auth.hasPermission('prescriptions.write');

  newLineGroup(): FormGroup {
    return this.fb.group({
      drug: [null as number | null],
      drug_name: ['', Validators.required],
      box_count: [1],
      quantity_per_box: [1],
      dose: ['', Validators.required],
      frequency: ['', Validators.required],
      period_days: [7],
      route: ['oral'],
      usage_instruction: ['', Validators.required],
    });
  }

  lineGroupFrom(line: PrescriptionLine): FormGroup {
    return this.fb.group({
      drug: [line.drug ?? null],
      drug_name: [line.drug_name, Validators.required],
      box_count: [line.box_count ?? 1],
      quantity_per_box: [line.quantity_per_box ?? 1],
      dose: [line.dose, Validators.required],
      frequency: [line.frequency, Validators.required],
      period_days: [line.period_days ?? 7],
      route: [line.route ?? 'oral'],
      usage_instruction: [line.usage_instruction, Validators.required],
    });
  }

  addLine(): void {
    const g = this.newLineGroup();
    const idx = this.lines.length;
    g.get('drug')?.valueChanges.subscribe((drugId) => {
      if (drugId) this.loadDrugName(idx, drugId as number);
    });
    this.lines.push(g);
  }

  removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  loadDrugName(index: number, drugId: number): void {
    this.http.get<DrugCatalogItem>(`${API_BASE}/prescriptions/drugs/${drugId}/`).subscribe({
      next: (drug) => {
        this.lines.at(index).patchValue({ drug_name: drug.name });
      },
    });
  }

  private payload() {
    return {
      patient: this.patientId,
      ...this.form.getRawValue(),
      lines: this.lines.getRawValue(),
    };
  }

  saveDraft(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const body = this.payload() as any;
    const req = this.prescription
      ? this.rxApi.update(this.prescription.id, body)
      : this.rxApi.create(body as any);
    req.subscribe({
      next: (rx) => {
        this.saving.set(false);
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 2000 });
        this.saved.emit(rx);
      },
      error: () => {
        this.saving.set(false);
        this.snack.open(this.translate.instant('common.error'), 'OK', { duration: 2500 });
      },
    });
  }

  saveAndFinalize(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const body = this.payload() as any;
    const save$ = this.prescription
      ? this.rxApi.update(this.prescription.id, body)
      : this.rxApi.create(body as any);
    save$.subscribe({
      next: (rx) => {
        this.rxApi.finalize(rx.id).subscribe({
          next: (finalized) => {
            this.saving.set(false);
            this.snack.open(this.translate.instant('prescriptions.finalized'), 'OK', { duration: 2500 });
            this.finalized.emit(finalized);
          },
          error: () => {
            this.saving.set(false);
            this.snack.open(this.translate.instant('common.error'), 'OK', { duration: 2500 });
          },
        });
      },
      error: () => {
        this.saving.set(false);
        this.snack.open(this.translate.instant('common.error'), 'OK', { duration: 2500 });
      },
    });
  }
}

import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';

import { BarcodeLookupResult, BarcodeService } from './barcode.service';

export interface ScanMissWizardData {
  code: string;
  action: 'create_wizard' | 'assign_existing';
}

@Component({
  selector: 'app-scan-miss-wizard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'barcode.scanMiss.title' | translate }}</h2>
    <mat-dialog-content>
      @if (data.action === 'create_wizard') {
      <mat-stepper linear>
        <mat-step [stepControl]="step1Form">
          <form [formGroup]="step1Form">
            <p>{{ 'barcode.scanMiss.step1Hint' | translate }}</p>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
              <mat-label>{{ 'barcode.scanMiss.barcode' | translate }}</mat-label>
              <input matInput formControlName="code" readonly />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
              <mat-label>{{ 'barcode.scanMiss.productName' | translate }}</mat-label>
              <input matInput formControlName="name" />
            </mat-form-field>
            <button mat-flat-button color="primary" type="button" (click)="submitStep1()" [disabled]="step1Form.invalid">
              {{ 'common.next' | translate }}
            </button>
          </form>
        </mat-step>
        <mat-step>
          <p>{{ 'barcode.scanMiss.step2Hint' | translate }}</p>
          <form [formGroup]="step2Form">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
              <mat-label>{{ 'barcode.price' | translate }}</mat-label>
              <input matInput type="number" formControlName="unit_price" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
              <mat-label>{{ 'products.cost' | translate }}</mat-label>
              <input matInput type="number" formControlName="cost_price" />
            </mat-form-field>
          </form>
          <div class="actions">
            <button mat-stroked-button type="button" (click)="skipStep2()">{{ 'barcode.scanMiss.skip' | translate }}</button>
            <button mat-flat-button color="primary" type="button" (click)="submitStep2()">{{ 'common.save' | translate }}</button>
          </div>
        </mat-step>
      </mat-stepper>
      } @else {
      <p>{{ 'barcode.scanMiss.assignHint' | translate }}</p>
      <form [formGroup]="assignForm">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
          <mat-label>{{ 'barcode.scanMiss.barcode' | translate }}</mat-label>
          <input matInput formControlName="code" readonly />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full">
          <mat-label>{{ 'barcode.productId' | translate }}</mat-label>
          <input matInput type="number" formControlName="product_id" />
        </mat-form-field>
      </form>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">{{ 'common.cancel' | translate }}</button>
      @if (data.action === 'assign_existing') {
      <button mat-flat-button color="primary" type="button" (click)="submitAssign()" [disabled]="assignForm.invalid">
        {{ 'barcode.scanMiss.assign' | translate }}
      </button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full {
        width: 100%;
        display: block;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
    `,
  ],
})
export class ScanMissWizardComponent {
  data = inject<ScanMissWizardData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<ScanMissWizardComponent>);
  private fb = inject(FormBuilder);
  private barcode = inject(BarcodeService);
  private snack = inject(MatSnackBar);

  productId = signal<number | null>(null);

  step1Form = this.fb.nonNullable.group({
    code: [this.data.code, Validators.required],
    name: ['', Validators.required],
  });

  step2Form = this.fb.group({
    unit_price: [null as number | null],
    cost_price: [null as number | null],
  });

  assignForm = this.fb.nonNullable.group({
    code: [this.data.code, Validators.required],
    product_id: [0, Validators.min(1)],
  });

  submitStep1(): void {
    if (this.step1Form.invalid) return;
    const v = this.step1Form.getRawValue();
    this.barcode.scanMissCreateStep1(v.code, v.name).subscribe({
      next: (res) => {
        this.productId.set(res.product_id);
        this.snack.open('Ürün oluşturuldu', undefined, { duration: 2000 });
      },
      error: () => this.snack.open('Hata', undefined, { duration: 3000 }),
    });
  }

  submitStep2(): void {
    const pid = this.productId();
    if (!pid) return;
    const v = this.step2Form.getRawValue();
    this.barcode.scanMissCreateStep2(pid, v).subscribe({
      next: (res) => this.dialogRef.close(res.product as BarcodeLookupResult),
      error: () => this.snack.open('Hata', undefined, { duration: 3000 }),
    });
  }

  skipStep2(): void {
    const pid = this.productId();
    if (!pid) return;
    this.barcode.lookup(this.data.code).subscribe({
      next: (r) => this.dialogRef.close(r),
    });
  }

  submitAssign(): void {
    const v = this.assignForm.getRawValue();
    this.barcode.scanMissAssign(v.code, v.product_id).subscribe({
      next: (r) => this.dialogRef.close(r),
      error: () => this.snack.open('Atama hatası', undefined, { duration: 3000 }),
    });
  }
}

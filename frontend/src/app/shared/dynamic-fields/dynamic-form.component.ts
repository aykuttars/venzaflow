import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';

import { FormFieldConfig, ProductFieldDefinition, ProductRow } from './models';

@Component({
  selector: 'app-dynamic-product-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    TranslateModule,
  ],
  template: `
    <form [formGroup]="form">
      @for (section of sections; track section) {
      <h3 class="form-section-title">{{ section }}</h3>
      <div class="form-section-grid">
        @for (field of fieldsForSection(section); track field.field_key + field.field_source) {
        @if (field.field_source === 'CORE') {
        @switch (field.field_key) {
          @case ('category') {
          <mat-form-field appearance="outline">
            <mat-label>{{ field.label }}</mat-label>
            <mat-select formControlName="category" [required]="field.is_required">
              @for (c of categories; track c.id) {
              <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          }
          @case ('is_active') {
          <div class="checkbox-field">
            <mat-checkbox formControlName="is_active">{{ field.label }}</mat-checkbox>
          </div>
          }
          @default {
          <mat-form-field appearance="outline">
            <mat-label>{{ field.label }}</mat-label>
            <input
              matInput
              [formControlName]="field.field_key"
              [readonly]="field.is_readonly"
              [placeholder]="field.placeholder || ''"
              [required]="field.is_required"
            />
          </mat-form-field>
          }
        }
        } @else if (field.field_source === 'DYNAMIC') {
        @if (dynamicDef(field.field_key); as def) {
        <mat-form-field appearance="outline">
          <mat-label>{{ field.label || def.label }}</mat-label>
          @if (def.field_type === 'SELECT' && def.options?.length) {
          <mat-select [formControlName]="'df_' + def.key" [required]="field.is_required || def.is_required">
            @for (opt of def.options; track $index) {
            <mat-option [value]="optionValue(opt)">{{ optionLabel(opt) }}</mat-option>
            }
          </mat-select>
          } @else if (def.field_type === 'BOOLEAN') {
          <mat-select [formControlName]="'df_' + def.key">
            <mat-option [value]="true">{{ 'common.yes' | translate }}</mat-option>
            <mat-option [value]="false">{{ 'common.no' | translate }}</mat-option>
          </mat-select>
          } @else if (def.field_type === 'TEXTAREA') {
          <textarea matInput rows="3" [formControlName]="'df_' + def.key"></textarea>
          } @else {
          <input matInput [formControlName]="'df_' + def.key" [required]="field.is_required || def.is_required" />
          }
          @if (field.help_text || def.help_text) {
          <mat-hint>{{ field.help_text || def.help_text }}</mat-hint>
          }
        </mat-form-field>
        }
        }
        }
      </div>
      }
    </form>
  `,
  styles: [
    `
      .form-section-title {
        margin: 16px 0 8px;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.7;
      }
      .form-section-title:first-child {
        margin-top: 0;
      }
      .form-section-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 8px 16px;
      }
      .checkbox-field {
        display: flex;
        align-items: center;
        min-height: 56px;
      }
    `,
  ],
})
export class DynamicProductFormComponent implements OnChanges {
  @Input() formConfig: FormFieldConfig[] = [];
  @Input() fieldDefinitions: ProductFieldDefinition[] = [];
  @Input() categories: { id: number; name: string }[] = [];
  @Input() initial: ProductRow | null = null;

  form!: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({});
  }

  ngOnChanges(): void {
    this.buildForm();
  }

  get sections(): string[] {
    const set = new Set(
      this.formConfig.filter((f) => f.is_visible).map((f) => f.section || 'Genel Bilgiler')
    );
    return [...set];
  }

  fieldsForSection(section: string): FormFieldConfig[] {
    return this.formConfig
      .filter((f) => f.is_visible && (f.section || 'Genel Bilgiler') === section)
      .sort((a, b) => a.order - b.order);
  }

  dynamicDef(key: string): ProductFieldDefinition | undefined {
    return this.fieldDefinitions.find((d) => d.key === key);
  }

  optionValue(opt: string | { value: string; label: string }): string {
    return typeof opt === 'string' ? opt : opt.value;
  }

  optionLabel(opt: string | { value: string; label: string }): string {
    return typeof opt === 'string' ? opt : opt.label;
  }

  getPayload(): Record<string, unknown> {
    const raw = this.form.getRawValue();
    const custom_fields: Record<string, unknown> = {};
    for (const def of this.fieldDefinitions) {
      const k = `df_${def.key}`;
      if (k in raw) custom_fields[def.key] = raw[k];
    }
    return {
      sku: raw['sku'],
      barcode: raw['barcode'] || '',
      name: raw['name'],
      category: raw['category'],
      unit_price: raw['unit_price'],
      cost_price: raw['cost_price'] || null,
      is_active: raw['is_active'] ?? true,
      custom_fields,
    };
  }

  private buildForm(): void {
    const controls: Record<string, unknown> = {
      sku: [this.initial?.sku ?? '', Validators.required],
      barcode: [this.initial?.barcode ?? ''],
      name: [this.initial?.name ?? '', Validators.required],
      category: [this.initial?.category ?? null, Validators.required],
      unit_price: [this.initial?.unit_price ?? '0.00', Validators.required],
      cost_price: [this.initial?.cost_price ?? ''],
      is_active: [this.initial?.is_active ?? true],
    };
    for (const def of this.fieldDefinitions) {
      const val = this.initial?.dynamic_fields?.[def.key] ?? def.default_value ?? '';
      const validators = def.is_required ? [Validators.required] : [];
      controls[`df_${def.key}`] = [val, validators];
    }
    this.form = this.fb.group(controls);
  }
}

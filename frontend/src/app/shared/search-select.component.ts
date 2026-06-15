import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import {
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
} from 'rxjs';

import { AuthService } from '../core/auth.service';
import { CrudService } from './crud.service';

type Row = Record<string, unknown>;

@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchSelectComponent),
      multi: true,
    },
  ],
  template: `
    <mat-form-field appearance="outline" class="search-select-field">
      <mat-label>{{ label }}</mat-label>
      <input
        matInput
        type="text"
        [formControl]="inputControl"
        [matAutocomplete]="auto"
        [required]="required"
        [placeholder]="placeholderKey | translate"
        (blur)="onBlur()"
      />
      @if (loading()) {
      <mat-spinner matSuffix diameter="20" />
      }
      <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onOptionSelected($event.option.value)">
        @if (allowNull) {
        <mat-option [value]="null">{{ nullLabel }}</mat-option>
        }
        @if (showMinCharsHint()) {
        <mat-option disabled>
          {{ 'common.searchSelectMinChars' | translate: { count: minSearchLength } }}
        </mat-option>
        }
        @if (showNoResults()) {
        <mat-option disabled>{{ 'common.noRecords' | translate }}</mat-option>
        }
        @for (item of options(); track item['id']) {
        <mat-option [value]="item">{{ formatLabel(item) }}</mat-option>
        }
      </mat-autocomplete>
      @if (hint) {
      <mat-hint>{{ hint }}</mat-hint>
      }
    </mat-form-field>
  `,
  styles: [
    `
      .search-select-field {
        width: 100%;
      }
    `,
  ],
})
export class SearchSelectComponent implements ControlValueAccessor, OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) apiPath!: string;
  @Input() moduleSlug?: string;
  @Input() label = '';
  @Input() labelKeys: string[] = ['name'];
  @Input() minSearchLength = 3;
  @Input() resultLimit = 25;
  @Input() allowNull = false;
  @Input() nullLabel = '—';
  @Input() hint = '';
  @Input() required = false;
  @Input() placeholderKey = 'common.searchSelectPlaceholder';
  @Input() extraParams: Record<string, string | number | undefined | null> = {};

  inputControl = new FormControl<string>('', { nonNullable: true });
  options = signal<Row[]>([]);
  loading = signal(false);

  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private crud?: CrudService<Row>;
  private search$ = new Subject<string>();
  private subs = new Subscription();
  private selectedId: number | string | null = null;
  private selectedLabel = '';
  private pendingValue: number | string | null | undefined;
  private onChange: (v: number | string | null) => void = () => undefined;
  onTouched: () => void = () => undefined;

  ngOnInit(): void {
    this.ensureCrud();
    this.subs.add(
      this.inputControl.valueChanges.pipe(distinctUntilChanged()).subscribe((term) => this.onSearchTerm(term))
    );
    this.subs.add(
      this.search$
        .pipe(
          debounceTime(300),
          distinctUntilChanged(),
          switchMap((term) => {
            if (term.length < this.minSearchLength) {
              this.loading.set(false);
              this.options.set([]);
              return of(null);
            }
            this.loading.set(true);
            const extra: Record<string, string | number | undefined> = {};
            for (const [k, v] of Object.entries(this.extraParams)) {
              if (v != null && v !== '') extra[k] = v as string | number;
            }
            return this.crud!.list({ search: term, limit: this.resultLimit, extra }).pipe(
              catchError(() => of({ count: 0, next: null, previous: null, results: [] }))
            );
          })
        )
        .subscribe((page) => {
          if (page) this.options.set(page.results);
          this.loading.set(false);
        })
    );
    if (this.pendingValue !== undefined) {
      this.applyValue(this.pendingValue);
      this.pendingValue = undefined;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['apiPath'] || changes['moduleSlug']) {
      this.ensureCrud();
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  writeValue(value: number | string | null): void {
    if (!this.crud) {
      this.pendingValue = value;
      return;
    }
    this.applyValue(value);
  }

  registerOnChange(fn: (v: number | string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) this.inputControl.disable({ emitEvent: false });
    else this.inputControl.enable({ emitEvent: false });
  }

  formatLabel(item: Row): string {
    const parts = this.labelKeys
      .map((k) => item[k])
      .filter((v) => v != null && v !== '');
    return parts.length ? parts.join(' · ') : String(item['id'] ?? '');
  }

  showMinCharsHint(): boolean {
    const term = this.inputControl.value.trim();
    return term.length > 0 && term.length < this.minSearchLength && !this.loading();
  }

  showNoResults(): boolean {
    const term = this.inputControl.value.trim();
    return term.length >= this.minSearchLength && !this.loading() && this.options().length === 0;
  }

  onSearchTerm(term: string): void {
    if (term === this.selectedLabel) return;
    if (this.selectedId != null) {
      this.selectedId = null;
      this.selectedLabel = '';
      this.onChange(null);
    }
    this.search$.next(term.trim());
  }

  onOptionSelected(item: Row | null): void {
    if (item == null) {
      this.selectedId = null;
      this.selectedLabel = '';
      this.inputControl.setValue('', { emitEvent: false });
      this.onChange(null);
      return;
    }
    const id = item['id'] as number | string;
    this.selectedId = id;
    this.selectedLabel = this.formatLabel(item);
    this.inputControl.setValue(this.selectedLabel, { emitEvent: false });
    this.onChange(id);
  }

  onBlur(): void {
    this.onTouched();
    const term = this.inputControl.value;
    if (this.selectedId != null && term !== this.selectedLabel) {
      this.inputControl.setValue(this.selectedLabel, { emitEvent: false });
    } else if (this.selectedId == null && term.trim() === '' && this.allowNull) {
      this.onChange(null);
    }
  }

  private ensureCrud(): void {
    if (!this.apiPath) return;
    this.crud = new CrudService<Row>(this.http, this.apiPath, this.auth, this.moduleSlug);
  }

  private applyValue(value: number | string | null): void {
    this.selectedId = value;
    if (value == null || value === '') {
      this.selectedLabel = '';
      this.inputControl.setValue('', { emitEvent: false });
      return;
    }
    this.crud!.get(value).subscribe({
      next: (item) => {
        this.selectedLabel = this.formatLabel(item);
        this.inputControl.setValue(this.selectedLabel, { emitEvent: false });
      },
      error: () => {
        this.selectedLabel = String(value);
        this.inputControl.setValue(this.selectedLabel, { emitEvent: false });
      },
    });
  }
}

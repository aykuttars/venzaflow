import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import { NviListItem, NviOpenAddress, NviService } from '../core/nvi.service';

function parseBuildingNo(name: string): string {
  const m = name.match(/^([^-]+)/);
  return m ? m[1].trim() : name;
}

function parseApartmentNo(name: string): string {
  const m =
    name.match(/İç Kapı No\s*:\s*(\S+)/i) ||
    name.match(/Iç Kapı No\s*:\s*(\S+)/i) ||
    name.match(/Kapı No\s*:\s*(\S+)/i);
  return m ? m[1] : name;
}

const CODE_FIELDS = [
  'province_code',
  'district_code',
  'neighborhood_code',
  'street_code',
  'building_code',
  'unit_code',
  'address_code',
] as const;

@Component({
  selector: 'app-mernis-address-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    TranslateModule,
  ],
  template: `
    @if (savedLocked) {
    <div class="address-saved">
      <div class="address-saved__grid">
        <div class="address-saved__item">
          <span class="address-saved__label">{{ 'patients.address.province' | translate }}</span>
          <span>{{ group.get('province_name')?.value || '—' }}</span>
        </div>
        <div class="address-saved__item">
          <span class="address-saved__label">{{ 'patients.address.district' | translate }}</span>
          <span>{{ group.get('district_name')?.value || '—' }}</span>
        </div>
        <div class="address-saved__item">
          <span class="address-saved__label">{{ 'patients.address.neighborhood' | translate }}</span>
          <span>{{ group.get('neighborhood_name')?.value || '—' }}</span>
        </div>
        <div class="address-saved__item">
          <span class="address-saved__label">{{ 'patients.address.street' | translate }}</span>
          <span>{{ group.get('street_name')?.value || '—' }}</span>
        </div>
        <div class="address-saved__item">
          <span class="address-saved__label">{{ 'patients.address.building' | translate }}</span>
          <span>{{ group.get('building_no')?.value || '—' }}</span>
        </div>
        <div class="address-saved__item">
          <span class="address-saved__label">{{ 'patients.address.unit' | translate }}</span>
          <span>{{ group.get('apartment_no')?.value || '—' }}</span>
        </div>
      </div>
      @if (group.get('address_code')?.value || group.get('full_address')?.value) {
      <div class="address-open-row">
        @if (group.get('address_code')?.value) {
        <div class="address-open-row__item address-open-row__item--code">
          <span class="address-open-row__label">{{ 'patients.address.addressCode' | translate }}</span>
          <span class="address-open-row__value">{{ group.get('address_code')?.value }}</span>
        </div>
        }
        @if (group.get('full_address')?.value) {
        <div class="address-open-row__item address-open-row__item--address">
          <span class="address-open-row__label">{{ 'patients.address.openAddress' | translate }}</span>
          <span class="address-open-row__value">{{ group.get('full_address')?.value }}</span>
        </div>
        }
      </div>
      }
      <button mat-stroked-button type="button" class="address-saved__change" (click)="unlockForEdit()">
        {{ 'patients.address.changeAddress' | translate }}
      </button>
    </div>
    } @else {
    @if (restoring) {
    <div class="address-loading">
      <mat-spinner diameter="28"></mat-spinner>
      <span>{{ 'patients.address.loading' | translate }}</span>
    </div>
    }
    <div class="address-grid" [class.address-grid--dimmed]="restoring">
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.province' | translate }}</mat-label>
        <mat-select
          [formControl]="$any(group.get('province_code'))"
          [compareWith]="compareCode"
          (selectionChange)="onProvince($event.value)"
        >
          @for (p of provinces; track p.code) {
          <mat-option [value]="p.code">{{ p.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.district' | translate }}</mat-label>
        <mat-select
          [formControl]="$any(group.get('district_code'))"
          [compareWith]="compareCode"
          (selectionChange)="onDistrict($event.value)"
        >
          @for (d of districts; track d.code) {
          <mat-option [value]="d.code">{{ d.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.neighborhood' | translate }}</mat-label>
        <mat-select
          [formControl]="$any(group.get('neighborhood_code'))"
          [compareWith]="compareCode"
          (selectionChange)="onNeighborhood($event.value)"
        >
          @for (n of neighborhoods; track n.code) {
          <mat-option [value]="n.code">{{ n.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.street' | translate }}</mat-label>
        <mat-select
          [formControl]="$any(group.get('street_code'))"
          [compareWith]="compareCode"
          (selectionChange)="onStreet($event.value)"
        >
          @for (s of streets; track s.code) {
          <mat-option [value]="s.code">{{ s.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.building' | translate }}</mat-label>
        <mat-select
          [formControl]="$any(group.get('building_code'))"
          [compareWith]="compareCode"
          (selectionChange)="onBuilding($event.value)"
        >
          @for (b of buildings; track b.code) {
          <mat-option [value]="b.code">{{ buildingLabel(b.name) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.unit' | translate }}@if (unitOptional) { ({{ 'patients.address.optional' | translate }})}</mat-label>
        <mat-select
          [formControl]="$any(group.get('unit_code'))"
          [compareWith]="compareCode"
          (selectionChange)="onUnit($event.value)"
          [disabled]="restoring || (unitOptional && !!group.get('address_code')?.value)"
        >
          @for (u of units; track u.code) {
          <mat-option [value]="u.code">{{ unitLabel(u.name) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>
    @if (group.get('address_code')?.value || group.get('full_address')?.value) {
    <div class="address-open-row">
      @if (group.get('address_code')?.value) {
      <div class="address-open-row__item address-open-row__item--code">
        <span class="address-open-row__label">{{ 'patients.address.addressCode' | translate }}</span>
        <span class="address-open-row__value">{{ group.get('address_code')?.value }}</span>
      </div>
      }
      @if (group.get('full_address')?.value) {
      <div class="address-open-row__item address-open-row__item--address">
        <span class="address-open-row__label">{{ 'patients.address.openAddress' | translate }}</span>
        <span class="address-open-row__value">{{ group.get('full_address')?.value }}</span>
      </div>
      }
    </div>
    }
    }
  `,
  styles: [
    `
      .address-loading {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        font-size: 13px;
        opacity: 0.75;
      }
      .address-grid--dimmed {
        pointer-events: none;
        opacity: 0.55;
      }
      .address-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 8px;
      }
      .address-open-row {
        display: grid;
        grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
        gap: 16px;
        align-items: baseline;
        margin-top: 8px;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.04);
      }
      .address-open-row__item {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
      }
      .address-open-row__label {
        flex-shrink: 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.65;
      }
      .address-open-row__value {
        font-size: 13px;
        line-height: 1.45;
        color: rgba(0, 0, 0, 0.87);
        min-width: 0;
        word-break: break-word;
      }
      @media (max-width: 640px) {
        .address-open-row {
          grid-template-columns: 1fr;
        }
      }
      .address-saved__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px 16px;
        margin-bottom: 8px;
      }
      .address-saved__item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 13px;
      }
      .address-saved__label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.65;
      }
      .address-saved__change {
        margin-top: 8px;
      }
    `,
  ],
})
export class MernisAddressFormComponent implements OnInit {
  @Input({ required: true }) group!: FormGroup;

  private nvi = inject(NviService);

  provinces: NviListItem[] = [];
  districts: NviListItem[] = [];
  neighborhoods: NviListItem[] = [];
  streets: NviListItem[] = [];
  buildings: NviListItem[] = [];
  units: NviListItem[] = [];
  unitOptional = false;
  restoring = false;
  savedLocked = false;

  buildingLabel = parseBuildingNo;
  unitLabel = parseApartmentNo;
  compareCode = (a: number | string | null, b: number | string | null) =>
    a != null && b != null && Number(a) === Number(b);

  ngOnInit(): void {
    this.normalizeCodeFields();
    if (this.hasCompleteSavedAddress()) {
      this.savedLocked = true;
      if (!this.group.get('unit_code')?.value && this.group.get('address_code')?.value) {
        this.unitOptional = true;
      }
      return;
    }
    this.beginInteractiveLoad();
  }

  unlockForEdit(): void {
    this.savedLocked = false;
    this.beginInteractiveLoad();
  }

  private beginInteractiveLoad(): void {
    const hasSavedAddress = !!this.group.get('province_code')?.value;
    if (hasSavedAddress) this.restoring = true;

    this.nvi.listProvinces().subscribe({
      next: (rows) => {
        this.provinces = rows;
        this.restoreNames('province', rows);
        if (hasSavedAddress) {
          this.restoreSavedCascade();
        }
      },
      error: () => {
        this.restoring = false;
      },
    });
  }

  private hasCompleteSavedAddress(): boolean {
    const g = this.group;
    return !!(
      g.get('province_code')?.value &&
      g.get('district_code')?.value &&
      g.get('neighborhood_code')?.value &&
      g.get('street_code')?.value &&
      g.get('building_code')?.value &&
      g.get('province_name')?.value &&
      g.get('district_name')?.value &&
      g.get('neighborhood_name')?.value &&
      g.get('street_name')?.value &&
      g.get('address_code')?.value &&
      g.get('full_address')?.value
    );
  }

  onProvince(code: number): void {
    this.setItem('province', this.provinces, code);
    this.resetBelow('district');
    this.loadDistricts(code, true);
  }

  onDistrict(code: number): void {
    this.setItem('district', this.districts, code);
    this.resetBelow('neighborhood');
    this.loadNeighborhoods(code, true);
  }

  onNeighborhood(code: number): void {
    this.setItem('neighborhood', this.neighborhoods, code);
    this.resetBelow('street');
    this.loadStreets(code, true);
  }

  onStreet(code: number): void {
    this.setItem('street', this.streets, code);
    this.resetBelow('building');
    const mahalle = this.group.get('neighborhood_code')?.value;
    if (mahalle) this.loadBuildings(mahalle, code, true);
  }

  onBuilding(code: number): void {
    this.setItem('building', this.buildings, code);
    this.resetBelow('unit');
    this.unitOptional = false;
    const mahalle = this.group.get('neighborhood_code')?.value;
    if (mahalle) this.loadUnits(mahalle, code, true);
  }

  onUnit(code: number): void {
    this.setItem('unit', this.units, code);
    this.unitOptional = false;
    const mahalle = this.group.get('neighborhood_code')?.value;
    if (mahalle) this.loadOpenAddress(mahalle, { unit: code });
  }

  private restoreSavedCascade(): void {
    const pc = this.num('province_code');
    if (!pc) {
      this.restoring = false;
      return;
    }
    this.loadDistricts(pc, false, () => {
      const dc = this.num('district_code');
      if (!dc) return this.finishRestore();
      this.loadNeighborhoods(dc, false, () => {
        const nc = this.num('neighborhood_code');
        if (!nc) return this.finishRestore();
        this.loadStreets(nc, false, () => {
          const sc = this.num('street_code');
          if (!sc) return this.finishRestore();
          this.loadBuildings(nc, sc, false, () => {
            const bc = this.num('building_code');
            if (!bc) return this.finishRestore();
            this.loadUnits(nc, bc, false, () => this.finishRestore());
          });
        });
      });
    });
  }

  private finishRestore(): void {
    const uc = this.num('unit_code');
    const ac = this.group.get('address_code')?.value;
    if (!uc && ac) {
      this.unitOptional = true;
    }
    if (uc && !ac) {
      const nc = this.num('neighborhood_code');
      if (nc) {
        this.loadOpenAddress(nc, { unit: uc });
      }
    }
    this.restoring = false;
  }

  private loadDistricts(il: number, reset: boolean, done?: () => void): void {
    this.nvi.listDistricts(il).subscribe({
      next: (rows) => {
        this.districts = rows;
        if (!reset) this.restoreNames('district', rows);
        done?.();
      },
      error: () => {
        this.restoring = false;
        done?.();
      },
    });
  }

  private loadNeighborhoods(ilce: number, reset: boolean, done?: () => void): void {
    this.nvi.listNeighborhoods(ilce).subscribe({
      next: (rows) => {
        this.neighborhoods = rows;
        if (!reset) this.restoreNames('neighborhood', rows);
        done?.();
      },
      error: () => {
        this.restoring = false;
        done?.();
      },
    });
  }

  private loadStreets(mahalle: number, reset: boolean, done?: () => void): void {
    this.nvi.listStreets(mahalle).subscribe({
      next: (rows) => {
        this.streets = rows;
        if (!reset) this.restoreNames('street', rows);
        done?.();
      },
      error: () => {
        this.restoring = false;
        done?.();
      },
    });
  }

  private loadBuildings(mahalle: number, yol: number, reset: boolean, done?: () => void): void {
    this.nvi.listBuildings(mahalle, yol).subscribe({
      next: (rows) => {
        this.buildings = rows;
        if (!reset) this.restoreNames('building', rows);
        done?.();
      },
      error: () => {
        this.restoring = false;
        done?.();
      },
    });
  }

  private loadUnits(mahalle: number, bina: number, reset: boolean, done?: () => void): void {
    this.nvi.listUnits(mahalle, bina).subscribe({
      next: (rows) => {
        this.units = rows;
        if (!reset) {
          this.restoreNames('unit', rows);
          done?.();
          return;
        }
        if (rows.length === 0) {
          this.tryOpenAddressAtBuilding(mahalle, bina);
        }
        done?.();
      },
      error: () => {
        this.units = [];
        if (reset) this.tryOpenAddressAtBuilding(mahalle, bina);
        this.restoring = false;
        done?.();
      },
    });
  }

  private tryOpenAddressAtBuilding(mahalle: number, bina: number): void {
    this.nvi.getOpenAddress(mahalle, { bina }).subscribe({
      next: (row) => this.applyOpenAddress(row, true),
      error: () => {
        this.unitOptional = false;
      },
    });
  }

  private loadOpenAddress(mahalle: number, opts: { unit?: number; bina?: number }): void {
    this.nvi.getOpenAddress(mahalle, opts).subscribe({
      next: (row) => this.applyOpenAddress(row, row.resolved_at === 'building'),
    });
  }

  private applyOpenAddress(row: NviOpenAddress, atBuilding: boolean): void {
    this.unitOptional = atBuilding;
    this.group.patchValue(
      {
        address_code: row.address_code,
        full_address: row.full_address,
        building_no: row.building_no || this.group.get('building_no')?.value,
        apartment_no: row.apartment_no || this.group.get('apartment_no')?.value || '',
        ...(atBuilding
          ? { unit_code: null, unit_name: '', apartment_no: row.apartment_no || '' }
          : {}),
      },
      { emitEvent: false }
    );
  }

  private setItem(level: string, list: NviListItem[], code: number): void {
    const row = list.find((x) => x.code === code);
    if (!row) return;
    this.group.patchValue({
      [`${level}_code`]: row.code,
      [`${level}_name`]: row.name,
      ...(level === 'building' ? { building_no: parseBuildingNo(row.name) } : {}),
      ...(level === 'unit' ? { apartment_no: parseApartmentNo(row.name) } : {}),
    });
    if (level !== 'unit') {
      this.clearOpenAddress();
    }
  }

  private restoreNames(level: string, list: NviListItem[]): void {
    const code = this.num(`${level}_code`);
    if (code == null) return;
    const row = list.find((x) => Number(x.code) === code);
    if (row) {
      const patch: Record<string, string | number> = {
        [`${level}_code`]: row.code,
        [`${level}_name`]: row.name,
      };
      if (level === 'building') patch['building_no'] = parseBuildingNo(row.name);
      if (level === 'unit') patch['apartment_no'] = parseApartmentNo(row.name);
      this.group.patchValue(patch, { emitEvent: false });
    }
  }

  private resetBelow(from: string): void {
    const order = ['district', 'neighborhood', 'street', 'building', 'unit'] as const;
    const start = order.indexOf(from as (typeof order)[number]);
    for (const level of order.slice(start)) {
      this.group.patchValue(
        {
          [`${level}_code`]: null,
          [`${level}_name`]: '',
          ...(level === 'building' ? { building_no: '' } : {}),
          ...(level === 'unit' ? { apartment_no: '' } : {}),
        },
        { emitEvent: false }
      );
    }
    if (from === 'district') {
      this.neighborhoods = [];
      this.streets = [];
      this.buildings = [];
      this.units = [];
    } else if (from === 'neighborhood') {
      this.streets = [];
      this.buildings = [];
      this.units = [];
    } else if (from === 'street') {
      this.buildings = [];
      this.units = [];
    } else if (from === 'building') {
      this.units = [];
    }
    this.unitOptional = false;
    this.clearOpenAddress();
  }

  private clearOpenAddress(): void {
    this.group.patchValue(
      { address_code: null, full_address: '' },
      { emitEvent: false }
    );
  }

  private normalizeCodeFields(): void {
    const patch: Record<string, number | null> = {};
    for (const key of CODE_FIELDS) {
      const raw = this.group.get(key)?.value;
      if (raw == null || raw === '') continue;
      const num = Number(raw);
      if (!Number.isNaN(num)) patch[key] = num;
    }
    if (Object.keys(patch).length) {
      this.group.patchValue(patch, { emitEvent: false });
    }
  }

  private num(field: string): number | null {
    const raw = this.group.get(field)?.value;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
}

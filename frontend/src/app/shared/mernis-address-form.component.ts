import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
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

@Component({
  selector: 'app-mernis-address-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    TranslateModule,
  ],
  template: `
    <div class="address-grid">
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.province' | translate }}</mat-label>
        <mat-select [formControl]="$any(group.get('province_code'))" (selectionChange)="onProvince($event.value)">
          @for (p of provinces; track p.code) {
          <mat-option [value]="p.code">{{ p.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.district' | translate }}</mat-label>
        <mat-select [formControl]="$any(group.get('district_code'))" (selectionChange)="onDistrict($event.value)">
          @for (d of districts; track d.code) {
          <mat-option [value]="d.code">{{ d.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.neighborhood' | translate }}</mat-label>
        <mat-select [formControl]="$any(group.get('neighborhood_code'))" (selectionChange)="onNeighborhood($event.value)">
          @for (n of neighborhoods; track n.code) {
          <mat-option [value]="n.code">{{ n.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.street' | translate }}</mat-label>
        <mat-select [formControl]="$any(group.get('street_code'))" (selectionChange)="onStreet($event.value)">
          @for (s of streets; track s.code) {
          <mat-option [value]="s.code">{{ s.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.building' | translate }}</mat-label>
        <mat-select [formControl]="$any(group.get('building_code'))" (selectionChange)="onBuilding($event.value)">
          @for (b of buildings; track b.code) {
          <mat-option [value]="b.code">{{ buildingLabel(b.name) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'patients.address.unit' | translate }}@if (unitOptional) { ({{ 'patients.address.optional' | translate }})}</mat-label>
        <mat-select
          [formControl]="$any(group.get('unit_code'))"
          (selectionChange)="onUnit($event.value)"
          [disabled]="unitOptional && !!group.get('address_code')?.value"
        >
          @for (u of units; track u.code) {
          <mat-option [value]="u.code">{{ unitLabel(u.name) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>
    @if (group.get('address_code')?.value) {
    <mat-form-field appearance="outline" class="full-width">
      <mat-label>{{ 'patients.address.addressCode' | translate }}</mat-label>
      <input matInput readonly [value]="group.get('address_code')?.value" />
    </mat-form-field>
    }
    @if (group.get('full_address')?.value) {
    <div class="address-preview">
      <span class="address-preview__label">{{ 'patients.address.openAddress' | translate }}</span>
      <p>{{ group.get('full_address')?.value }}</p>
    </div>
    }
  `,
  styles: [
    `
      .address-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 8px;
      }
      .full-width {
        width: 100%;
        margin-top: 8px;
      }
      .address-preview {
        margin: 8px 0 0;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.04);
      }
      .address-preview__label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.65;
        margin-bottom: 4px;
      }
      .address-preview p {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
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

  buildingLabel = parseBuildingNo;
  unitLabel = parseApartmentNo;

  ngOnInit(): void {
    this.nvi.listProvinces().subscribe({
      next: (rows) => {
        this.provinces = rows;
        this.restoreNames('province', this.provinces);
      },
    });
    const pc = this.group.get('province_code')?.value;
    if (pc) this.loadDistricts(pc, false);
    const dc = this.group.get('district_code')?.value;
    if (dc) this.loadNeighborhoods(dc, false);
    const nc = this.group.get('neighborhood_code')?.value;
    if (nc) this.loadStreets(nc, false);
    const sc = this.group.get('street_code')?.value;
    if (sc && nc) this.loadBuildings(nc, sc, false);
    const bc = this.group.get('building_code')?.value;
    if (bc && nc) this.loadUnits(nc, bc, false);
    const uc = this.group.get('unit_code')?.value;
    const ac = this.group.get('address_code')?.value;
    if (uc && nc) {
      this.loadOpenAddress(nc, { unit: uc });
    } else if (ac && bc && nc && !uc) {
      this.unitOptional = true;
    }
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

  private loadDistricts(il: number, reset: boolean): void {
    this.nvi.listDistricts(il).subscribe({
      next: (rows) => {
        this.districts = rows;
        if (!reset) this.restoreNames('district', rows);
      },
    });
  }

  private loadNeighborhoods(ilce: number, reset: boolean): void {
    this.nvi.listNeighborhoods(ilce).subscribe({
      next: (rows) => {
        this.neighborhoods = rows;
        if (!reset) this.restoreNames('neighborhood', rows);
      },
    });
  }

  private loadStreets(mahalle: number, reset: boolean): void {
    this.nvi.listStreets(mahalle).subscribe({
      next: (rows) => {
        this.streets = rows;
        if (!reset) this.restoreNames('street', rows);
      },
    });
  }

  private loadBuildings(mahalle: number, yol: number, reset: boolean): void {
    this.nvi.listBuildings(mahalle, yol).subscribe({
      next: (rows) => {
        this.buildings = rows;
        if (!reset) this.restoreNames('building', rows);
      },
    });
  }

  private loadUnits(mahalle: number, bina: number, reset: boolean): void {
    this.nvi.listUnits(mahalle, bina).subscribe({
      next: (rows) => {
        this.units = rows;
        if (!reset) {
          this.restoreNames('unit', rows);
          return;
        }
        if (rows.length === 0) {
          this.tryOpenAddressAtBuilding(mahalle, bina);
        }
      },
      error: () => {
        this.units = [];
        this.tryOpenAddressAtBuilding(mahalle, bina);
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
    const code = this.group.get(`${level}_code`)?.value;
    const row = list.find((x) => x.code === code);
    if (row) {
      const patch: Record<string, string> = { [`${level}_name`]: row.name };
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
}

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthImageComponent, patientPhotoUrl } from './auth-image.component';

@Component({
  selector: 'app-patient-photo-avatar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslateModule,
    AuthImageComponent,
  ],
  template: `
    <div
      class="patient-photo-avatar"
      [class.patient-photo-avatar--editable]="editable"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.--avatar-size.px]="size"
      [matTooltip]="editable ? ('patients.photoUpload' | translate) : ''"
    >
      @if (displayPreview()) {
      <img [src]="displayPreview()!" [alt]="initials" class="patient-photo-avatar__img" />
      } @else if (hasPhoto && patientId) {
      <app-auth-image
        [url]="patientPhotoUrl(patientId)"
        [alt]="initials"
        className="patient-photo-avatar__img"
        [style]="'width:' + size + 'px;height:' + size + 'px;border-radius:50%'"
      />
      } @else {
      <div class="patient-photo-avatar__placeholder">
        @if (initials) {
        <span>{{ initials }}</span>
        } @else {
        <mat-icon>person</mat-icon>
        }
      </div>
      }

      @if (editable) {
      <button
        type="button"
        class="patient-photo-avatar__overlay"
        (click)="onAvatarClick($event)"
        [attr.aria-label]="'patients.photoUpload' | translate"
      >
        <mat-icon>add_a_photo</mat-icon>
      </button>
      @if (hasPhoto || displayPreview()) {
      <button
        type="button"
        class="patient-photo-avatar__remove"
        [matMenuTriggerFor]="photoMenu"
        (click)="$event.stopPropagation()"
        [attr.aria-label]="'patients.photoRemove' | translate"
      >
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #photoMenu="matMenu">
        <button mat-menu-item type="button" (click)="triggerFileInput()">
          <mat-icon>photo_camera</mat-icon>
          <span>{{ 'patients.photoChange' | translate }}</span>
        </button>
        <button mat-menu-item type="button" (click)="onRemove()">
          <mat-icon color="warn">delete</mat-icon>
          <span>{{ 'patients.photoRemove' | translate }}</span>
        </button>
      </mat-menu>
      }
      <input
        #fileInput
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        (change)="onFileSelected($event)"
      />
      }
    </div>
  `,
  styles: [
    `
      .patient-photo-avatar {
        position: relative;
        flex-shrink: 0;
        border-radius: 50%;
        overflow: visible;
      }
      .patient-photo-avatar__img,
      .patient-photo-avatar__placeholder {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        border: 2px solid rgba(63, 81, 181, 0.35);
        box-sizing: border-box;
      }
      .patient-photo-avatar__placeholder {
        background: linear-gradient(135deg, #e8eaf6, #c5cae9);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: calc(var(--avatar-size, 96px) * 0.32);
        font-weight: 600;
        color: #3949ab;
      }
      .patient-photo-avatar__placeholder mat-icon {
        font-size: calc(var(--avatar-size, 96px) * 0.45);
        width: calc(var(--avatar-size, 96px) * 0.45);
        height: calc(var(--avatar-size, 96px) * 0.45);
        color: #5c6bc0;
      }
      .patient-photo-avatar--editable .patient-photo-avatar__overlay {
        position: absolute;
        inset: 0;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.45);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
      }
      .patient-photo-avatar--editable:hover .patient-photo-avatar__overlay {
        opacity: 1;
      }
      .patient-photo-avatar__remove {
        position: absolute;
        bottom: -2px;
        right: -2px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: white;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }
      .patient-photo-avatar__remove mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    `,
  ],
})
export class PatientPhotoAvatarComponent {
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  @Input() patientId: number | null = null;
  @Input() hasPhoto = false;
  @Input() editable = false;
  @Input() size = 96;
  @Input() initials = '';
  @Input() previewUrl: string | null = null;
  /** true = upload/delete via API immediately; false = emit events for parent */
  @Input() immediateUpload = true;

  @Output() photoChanged = new EventEmitter<{ hasPhoto: boolean }>();
  @Output() fileSelected = new EventEmitter<File>();
  @Output() removeRequested = new EventEmitter<void>();

  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  localPreview = signal<string | null>(null);
  patientPhotoUrl = patientPhotoUrl;

  displayPreview(): string | null {
    return this.previewUrl || this.localPreview();
  }

  onAvatarClick(event: Event): void {
    event.stopPropagation();
    if (!this.editable) return;
    this.triggerFileInput();
  }

  triggerFileInput(): void {
    this.fileInputRef?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
      this.snack.open(this.translate.instant('patients.photoInvalid'), 'OK', { duration: 3500 });
      return;
    }

    if (!this.immediateUpload || !this.patientId) {
      this.setLocalPreview(file);
      this.fileSelected.emit(file);
      return;
    }

    const body = new FormData();
    body.append('photo', file);
    this.http.post(patientPhotoUrl(this.patientId), body).subscribe({
      next: () => {
        this.hasPhoto = true;
        this.setLocalPreview(file);
        this.photoChanged.emit({ hasPhoto: true });
        this.snack.open(this.translate.instant('common.saved'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 3500,
        }),
    });
  }

  onRemove(): void {
    if (!this.immediateUpload || !this.patientId) {
      this.localPreview.set(null);
      this.removeRequested.emit();
      return;
    }
    this.http.delete(patientPhotoUrl(this.patientId)).subscribe({
      next: () => {
        this.hasPhoto = false;
        this.localPreview.set(null);
        this.photoChanged.emit({ hasPhoto: false });
        this.snack.open(this.translate.instant('common.deleted'), 'OK', { duration: 1500 });
      },
      error: (e) =>
        this.snack.open(e?.error?.detail || this.translate.instant('common.error'), 'OK', {
          duration: 2500,
        }),
    });
  }

  private setLocalPreview(file: File): void {
    const prev = this.localPreview();
    if (prev) URL.revokeObjectURL(prev);
    this.localPreview.set(URL.createObjectURL(file));
  }
}

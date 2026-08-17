import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common'; // 1. Import
import { DUserProfileInsert, UserProfilesService } from '../../services/user-profiles.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-missing-profile.component',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './missing-profile.component.html',
  styleUrl: './missing-profile.component.scss',
})
export class MissingProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly userProfileService = inject(UserProfilesService);
  private readonly supabaseService = inject(SupabaseService);

  readonly profile = signal<Awaited<ReturnType<SupabaseService['getCurrentUserProfile']>> | null>(
    null,
  );
  readonly profileForm = this.fb.group({
    name: this.fb.nonNullable.control('', {
      validators: [Validators.required],
    }),
  });

  isSaving = signal(false);
  submitAttempted = false;
  errorMessage = '';

  isInvalid(controlName: string): boolean {
    const control = this.profileForm.get(controlName);

    return Boolean(control && control.invalid && (control.touched || this.submitAttempted));
  }

  async submit(): Promise<void> {
    this.submitAttempted = true;
    this.errorMessage = '';

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const formValue = this.profileForm.getRawValue();

    const profile: DUserProfileInsert = {
      display_name: formValue.name.trim(),
    };

    this.isSaving.set(true);

    try {
      this.profile.set(await this.userProfileService.create(profile));
    } catch (error: unknown) {
      console.error('Unable to create profile', error);

      this.errorMessage =
        error instanceof Error ? error.message : 'The profile could not be created.';
    } finally {
      this.isSaving.set(false);
    }
  }

  async ngOnInit() {
    this.profile.set(await this.supabaseService.getCurrentUserProfile());
  }
}

import { Component, inject, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly supabaseService = inject(SupabaseService);

  private readonly router = inject(Router);

  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);

  readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),

    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  async ngOnInit(): Promise<void> {
    /*
     * If someone manually navigates to /login
     * while already authenticated, send them
     * back into the application.
     */
    const session = await this.supabaseService.getSession();

    if (session) {
      await this.navigateAfterLogin();
    }
  }

  async login(): Promise<void> {
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    try {
      const { email, password } = this.form.getRawValue();

      await this.supabaseService.signIn(email.trim(), password);

      await this.navigateAfterLogin();
    } catch (error) {
      console.error('Login failed', error);

      this.error.set(error instanceof Error ? error.message : 'Unable to log in.');
    } finally {
      this.loading.set(false);
    }
  }

  private async navigateAfterLogin(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    /*
     * Only allow internal Angular URLs here.
     */
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      await this.router.navigateByUrl(returnUrl);

      return;
    }

    /*
     * Replace this with whatever makes sense
     * as your application's landing page.
     */
    await this.router.navigate(['/']);
  }
}

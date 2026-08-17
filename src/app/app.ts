import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SupabaseService } from './services/supabase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly supabaseService = inject(SupabaseService);

  private readonly router = inject(Router);

  async logout(): Promise<void> {
    try {
      await this.supabaseService.signOut();

      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Unable to log out', error);
    }
  }
}

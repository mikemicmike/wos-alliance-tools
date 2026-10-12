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

  constructor() {
    // Scrolling over a focused number input changes its value. Cancel that and scroll the page
    // ourselves, so the input keeps focus and its value.
    document.addEventListener(
      'wheel',
      (event) => {
        const target = event.target;
        if (
          target instanceof HTMLInputElement &&
          target.type === 'number' &&
          target === document.activeElement
        ) {
          event.preventDefault();
          // deltaMode: 0 = pixels, 1 = lines, 2 = pages
          const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
          window.scrollBy(event.deltaX * unit, event.deltaY * unit);
        }
      },
      { passive: false },
    );
  }

  async logout(): Promise<void> {
    try {
      await this.supabaseService.signOut();

      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Unable to log out', error);
    }
  }
}

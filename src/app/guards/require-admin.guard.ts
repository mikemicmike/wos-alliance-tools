import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { SupabaseService } from '../services/supabase.service';

/**
 * Hides admin pages from everyone else. This only affects the UI - what each user can
 * actually change is enforced by the database's RLS policies.
 */
export const requireAdminGuard: CanActivateFn = async () => {
  const supabaseService = inject(SupabaseService);

  const router = inject(Router);

  try {
    const profile = await supabaseService.getProfile();
    if (profile?.is_admin) {
      return true;
    }
  } catch (error) {
    console.error('Unable to validate admin access', error);
  }

  return router.createUrlTree(['/']);
};

import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { SupabaseService } from '../services/supabase.service';

export const requireNotApprovedUserProfileGuard: CanActivateFn = async (_route, state) => {
  const supabaseService = inject(SupabaseService);

  const router = inject(Router);

  let profile: Awaited<ReturnType<SupabaseService['userProfile']>> = null;

  try {
    profile = await supabaseService.getProfile();
  } catch (error) {
    console.error('Unable to validate session', error);
  }

  if (profile?.is_approved !== true) {
    return true;
  } else {
    return router.createUrlTree(['/'], {
      queryParams: {
        returnUrl: state.url,
      },
    });
  }
};

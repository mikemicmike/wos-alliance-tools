import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const supabaseService = inject(SupabaseService);

  const router = inject(Router);

  try {
    const session = await supabaseService.getSession();

    if (session) {
      return true;
    }
  } catch (error) {
    console.error('Unable to validate session', error);
  }

  return router.createUrlTree(['/login'], {
    queryParams: {
      returnUrl: state.url,
    },
  });
};

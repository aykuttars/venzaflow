import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const data = route.data as { module?: string; permission?: string };

  if (data.module && !auth.hasModule(data.module)) {
    router.navigate(['/dashboard']);
    return false;
  }
  if (data.permission && !auth.hasPermission(data.permission)) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};

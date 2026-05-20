import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { PlatformAuthService } from './platform-auth.service';

export const platformAuthGuard: CanActivateFn = () => {
  const auth = inject(PlatformAuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/admin/login']);
};

export const platformGuestGuard: CanActivateFn = () => {
  const auth = inject(PlatformAuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/admin/tenants']);
};

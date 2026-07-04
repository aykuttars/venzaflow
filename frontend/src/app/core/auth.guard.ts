import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    if (!auth.me()) {
      auth.loadMe().subscribe({ error: () => auth.logout() });
    }
    return true;
  }

  if (!auth.hasRefreshToken()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  return auth.refreshAccess().pipe(
    switchMap(() => (auth.me() ? of(true) : auth.loadMe().pipe(map(() => true)))),
    map(() => true),
    catchError(() => {
      auth.logout(false);
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return of(false);
    })
  );
};

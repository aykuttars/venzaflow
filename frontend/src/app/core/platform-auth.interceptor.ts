import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { PlatformAuthService } from './platform-auth.service';

let platformRefreshing = false;

function isPlatformApi(url: string): boolean {
  return url.includes('/platform/');
}

export const platformAuthInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  if (!isPlatformApi(req.url)) {
    return next(req);
  }

  const auth = inject(PlatformAuthService);
  const router = inject(Router);

  const skip =
    req.url.endsWith('/platform/auth/login/') ||
    req.url.endsWith('/platform/auth/refresh/');
  const access = auth.access();
  const reqWithAuth =
    access && !skip
      ? req.clone({ setHeaders: { Authorization: `Bearer ${access}` } })
      : req;

  return next(reqWithAuth).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !skip && auth.refresh() && !platformRefreshing) {
        platformRefreshing = true;
        return auth.refreshAccess().pipe(
          switchMap((res) => {
            platformRefreshing = false;
            const retry = req.clone({
              setHeaders: { Authorization: `Bearer ${res.access}` },
            });
            return next(retry);
          }),
          catchError((e) => {
            platformRefreshing = false;
            auth.logout(false);
            router.navigate(['/admin/login']);
            return throwError(() => e);
          })
        );
      }
      return throwError(() => err);
    })
  );
};

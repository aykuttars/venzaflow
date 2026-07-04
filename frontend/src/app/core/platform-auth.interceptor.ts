import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

import { PlatformAuthService } from './platform-auth.service';

let refresh$: ReturnType<PlatformAuthService['refreshAccess']> | null = null;

function isPlatformApi(url: string): boolean {
  return url.includes('/platform/');
}

function refreshOnce(auth: PlatformAuthService) {
  if (!refresh$) {
    refresh$ = auth.refreshAccess().pipe(
      shareReplay(1),
      finalize(() => {
        refresh$ = null;
      })
    );
  }
  return refresh$;
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
      if (err.status === 401 && !skip && auth.refresh()) {
        return refreshOnce(auth).pipe(
          switchMap((res) => {
            const retry = req.clone({
              setHeaders: { Authorization: `Bearer ${res.access}` },
            });
            return next(retry);
          }),
          catchError((e) => {
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

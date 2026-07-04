import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

let refresh$: ReturnType<AuthService['refreshAccess']> | null = null;

function isTenantApi(url: string): boolean {
  return !url.includes('/platform/');
}

function refreshOnce(auth: AuthService) {
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

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  if (!isTenantApi(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  const skip = req.url.endsWith('/auth/login/') || req.url.endsWith('/auth/refresh/');
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
            router.navigate(['/login']);
            return throwError(() => e);
          })
        );
      }
      return throwError(() => err);
    })
  );
};

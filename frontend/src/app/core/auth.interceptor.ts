import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

let refreshing = false;

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
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
      if (err.status === 401 && !skip && auth.refresh() && !refreshing) {
        refreshing = true;
        return auth.refreshAccess().pipe(
          switchMap((res) => {
            refreshing = false;
            const retry = req.clone({
              setHeaders: { Authorization: `Bearer ${res.access}` },
            });
            return next(retry);
          }),
          catchError((e) => {
            refreshing = false;
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

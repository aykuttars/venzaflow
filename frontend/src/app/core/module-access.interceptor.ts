import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';

import { AuthService } from './auth.service';

function isTenantApi(url: string): boolean {
  return !url.includes('/platform/');
}

export const moduleAccessInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  if (!isTenantApi(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  if (!auth.canAccessApiPath(req.url)) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 403,
          statusText: 'Module not enabled',
          url: req.url,
          error: { detail: 'Module not enabled for this tenant.' },
        })
    );
  }

  return next(req);
};

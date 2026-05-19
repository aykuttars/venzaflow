import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { LanguageService } from './language.service';

export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  const lang = inject(LanguageService).getAcceptLanguageHeader();
  return next(
    req.clone({
      setHeaders: { 'Accept-Language': lang },
    })
  );
};

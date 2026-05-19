import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { AuthService } from '../auth.service';
import * as A from './auth.actions';

@Injectable()
export class AuthEffects {
  private actions$ = inject(Actions);
  private auth = inject(AuthService);
  private router = inject(Router);

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(A.loginRequested),
      switchMap(({ customer_code, email, password }) =>
        this.auth.login({ customer_code, email, password }).pipe(
          map((res) => A.loginSucceeded({ res })),
          catchError((err) =>
            of(
              A.loginFailed({
                error:
                  err?.error?.detail || err?.message || 'Login failed',
              })
            )
          )
        )
      )
    )
  );

  loginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(A.loginSucceeded),
        tap(() => this.router.navigate(['/dashboard']))
      ),
    { dispatch: false }
  );

  logout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(A.logout),
        tap(() => this.auth.logout())
      ),
    { dispatch: false }
  );
}

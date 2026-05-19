import { createAction, props } from '@ngrx/store';

import { LoginResponse, MeUser } from '../auth.service';

export const loginRequested = createAction(
  '[Auth] Login Requested',
  props<{ customer_code: string; email: string; password: string }>()
);
export const loginSucceeded = createAction(
  '[Auth] Login Succeeded',
  props<{ res: LoginResponse }>()
);
export const loginFailed = createAction(
  '[Auth] Login Failed',
  props<{ error: string }>()
);

export const meLoaded = createAction(
  '[Auth] Me Loaded',
  props<{ user: MeUser; permissions: string[]; enabled_modules: string[] }>()
);

export const logout = createAction('[Auth] Logout');

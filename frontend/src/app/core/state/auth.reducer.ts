import { createReducer, on } from '@ngrx/store';

import { MeUser } from '../auth.service';
import * as A from './auth.actions';

export interface AuthState {
  user: MeUser | null;
  permissions: string[];
  enabled_modules: string[];
  loading: boolean;
  error: string | null;
}

export const initialState: AuthState = {
  user: null,
  permissions: [],
  enabled_modules: [],
  loading: false,
  error: null,
};

export const authReducer = createReducer(
  initialState,
  on(A.loginRequested, (s) => ({ ...s, loading: true, error: null })),
  on(A.loginSucceeded, (s, { res }) => ({
    ...s,
    loading: false,
    error: null,
    user: res.user,
    permissions: res.permissions,
    enabled_modules: res.enabled_modules,
  })),
  on(A.loginFailed, (s, { error }) => ({ ...s, loading: false, error })),
  on(A.meLoaded, (s, { user, permissions, enabled_modules }) => ({
    ...s,
    user,
    permissions,
    enabled_modules,
  })),
  on(A.logout, () => initialState)
);

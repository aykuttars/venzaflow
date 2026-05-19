# Frontend architecture

```
frontend/
  src/main.ts                bootstrapApplication(AppComponent, appConfig)
  src/app/app.config.ts      providers: router, http(+interceptor), animations, NgRx store/effects
  src/app/app.routes.ts      top-level routes + lazy feature loaders + guards
  src/app/core/
    api.ts                   API_BASE = '/api/v1'
    jwt.ts                   decodeJwt(), isExpired()
    auth.service.ts          login/me/refresh/logout, signals: access, refresh, me, isAuthenticated
    auth.interceptor.ts      attach Bearer; on 401 try refresh, retry, else logout
    auth.guard.ts            blocks unauthenticated routes; lazy-loads me() if missing
    role.guard.ts            checks route.data.module + route.data.permission
    layout/main-layout.component.ts  sidenav + toolbar shell, role-filtered nav items
    state/auth.{actions,reducer,effects}.ts  NgRx slice (optional; service is the source of truth)
  src/app/features/<area>/<area>.component.ts  Lazy-loaded feature pages
  src/app/shared/
    page-header.component.ts
    simple-list.component.ts  reusable list/search/paginate wrapper
    crud.service.ts            CrudService<T> with list/get/create/update/remove
```

## JWT handling

- Stored in `localStorage` under `bms.access` / `bms.refresh` (signal-backed in `AuthService`).
- `decodeJwt()` parses base64url payload (no library) and exposes `tenant_id`, `tenant_code`, `department_key`, `email` to the app.
- Interceptor refreshes on 401 once; retries the original request with the new access; on refresh failure, logs out and routes to `/login`.

## Role-aware navigation

`MainLayoutComponent` defines a `NAV` array with `module` + `permission` for each item, and renders only those for which `AuthService.hasModule` and `hasPermission` are true. Route guards re-check on activation so deep links cannot bypass the sidebar filter.

## Build

- `npm install`
- `npm start` (proxies `/api` → `http://localhost:8000`)
- `npm run build` (`dist/bms/browser` is the static output served by nginx)

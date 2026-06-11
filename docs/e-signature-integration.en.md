# e-Signature (signing) module — integration notes

This document consolidates the **key decisions and gotchas** captured while wiring up
the `signing` module + the `eimza` desktop app + authority integrations
(e-Invoice / e-Archive / e-Prescription).

> Architecture summary: **Connection + Routing**. Tenant admins manage their own
> integrator connections and document routing; platform admins can override these per
> tenant. Signatures are produced either on the desktop (XAdES) or by the integrator
> (financial seal).
>
> 🇹🇷 Türkçe sürüm: [`e-signature-integration.md`](./e-signature-integration.md)

---

## 1. Module catalog — backend is the single source of truth

- The assignable module list is defined in `backend/apps/common/permission_codes.py`
  (`ALL_MODULES`, `MODULE_LABELS`).
- The frontend fetches it **dynamically** via `GET /platform/modules/`
  (`ModuleCatalogService`). There is no hardcoded slug list.
- **Note:** Adding a new module only requires a backend change; the platform admin UI
  picks it up automatically.

## 2. Login gating — tenants without e-signature cannot log in

- `eimza` sends `required_module: 'signing'` on login.
- The backend `LoginView` returns `403` + `{ "code": "module_not_enabled" }` when the
  tenant lacks the module; `eimza` maps this to a user-friendly message.
- Additionally the user's department must have **`signing.read` / `signing.write`**:
  - `signing.read` → view tasks.
  - `signing.write` → sign, create tasks **and access the integration settings page**.

## 3. Health check

- Backend exposes `GET /api/v1/health/`.
- `eimza` polls it periodically (`useSystemHealth` hook) and shows a banner
  (`ConnectionBanner`) when the server is unreachable.
- Backend availability before login is also verified through this endpoint.

## 4. AKİS / PKCS#11 driver setup (eimza, macOS/Windows)

- Redistributable PKCS#11 libraries can be **bundled** into the build (DMG/EXE)
  (`eimza/electron-builder.yml` → `extraResources`, `eimza/resources/pkcs11/`).
- Driver discovery order: in-app bundled candidates first (`bundledDriverCandidates`),
  then well-known system paths (e.g. macOS `/usr/local/lib/libakisp11.dylib`).
- If auto-discovery fails, the user can **pick the driver file manually**
  (`DriverSetupGuide` component: platform-specific guidance + link + scan/browse).
- **Licensing note:** if the AKİS driver cannot be bundled directly, keep the install
  link + manual selection path available.

## 5. Session/device visibility (eimza connections in the web panel)

- The backend `UserSession` model tracks every login session (`client`, `ip_address`,
  `last_seen_at`, `revoked`); the `jti` is embedded into the JWT.
- `eimza` adds `X-Client-Id: eimza` and `X-Client-Version` headers to every request, so
  desktop connections are shown **separately** from browser sessions.
- The **Sessions** page (`/sessions`) lists these sessions and allows revoking them.
- Signing tasks appear with their status on the **e-Signature** page (`/signing`).

## 6. Signing flow — XAdES-BES / UBL-TR

- e-Invoice / e-Archive documents are produced as **UBL-TR 1.2** XML
  (`apps/signing/services/ubl.py`) and signed with **XAdES-BES enveloped** signatures
  (`apps/signing/services/xades.py`, two-phase: `prepare_xades` + `inject_signature`).
- **Important:** the XAdES path is used only for e-Invoice/e-Archive tasks backed by a
  **real `Invoice`** (`SignTaskViewSet._is_xades`). Manual tasks created via
  `createSignTask` from `eimza` use the legacy canonical payload path.
- The supplier (sender) details come from the tenant's **signing profile**
  (`TenantSigningProfile` → `supplier_dict`): tax/ID number, title, tax office, address.

## 7. No changes required in the eimza app

Because the `prepare`/`complete` contract is byte-identical, the XAdES/UBL and
connection+routing work require **no code changes in eimza**:

- The `prepare` request already sends `certificate_der_base64` (XAdES needs the cert).
- The `prepare` response returns `task_id`, `data_to_sign_base64`, `algorithm`,
  `document_type` (exactly what eimza reads).
- eimza signs the returned bytes **format-agnostically** via PKCS#11 using `algorithm`
  (`SHA256_RSA_PKCS`); those bytes can now be the XAdES `SignedInfo` C14N.
- The `complete` request sends `signature_base64` + `certificate_der_base64`; the
  backend injects the signature into the UBL template (`inject_signature`) and submits
  it to the authority.
- **The only future touch point:** if the signature algorithm changes (e.g.
  SHA256→SHA512). Since eimza reads `algorithm` from the server, it usually adapts
  automatically.

## 8. Connection + Routing configuration (web panel)

Steps a tenant must complete in the web panel to enable the e-signature flow:

1. **Sender identity** (signing profile): tax/ID number, title, tax office, address,
   certificate type.
2. Define **at least one integrator connection** (provider, environment, signing mode,
   credentials).
3. **Route** the relevant document family (efatura / earsiv / erecete) to that
   connection.

> These are configuration steps — not code changes. Without routing, the `complete`
> step cannot submit to the authority.

- Tenant endpoint: `/api/v1/sign/integration/...`
- Platform override endpoint: `/api/v1/platform/tenants/{id}/integration/...`
- Frontend: `/signing/integration` for tenants; `/admin/tenants/:id/integration` for
  platform (same component, switches mode via the route param).

### Certificate type and signing mode

| Concept | Option | Meaning |
|---------|--------|---------|
| Certificate type | `personal` | Personal e-signature (desktop/smart card, XAdES) |
| Certificate type | `mali_muhur` | Corporate financial seal |
| Signing mode | `client_xades` | We produce the signature (XAdES) |
| Signing mode | `provider_seal` | The integrator produces the signature (financial seal) |

## 9. Credential security (encryption)

- Integrator credentials are stored **encrypted with Fernet**
  (`apps/common/secretbox.py`).
- The key is derived from the `AUTHORITY_ENCRYPTION_KEY` setting.
- **In production, `AUTHORITY_ENCRYPTION_KEY` must be set as an environment variable**
  (otherwise a development key is used → insecure).
- Secrets are **masked** in API responses; leaving a form field blank keeps the
  existing secret.

## 10. Provider catalog and dynamic forms

- Provider capabilities are defined in `apps/integrations/authority/providers.py`
  (`nilvera`, `uyumsoft`, `izibiz`, `medula`): `supported_families`, `environments`,
  `signing_modes`, `auth_fields`.
- The frontend builds the connection form **dynamically** from this catalog; fields and
  options update when the provider changes.

## 11. Mock / test behavior

- When no live credentials exist, or in tests, a **mock adapter** is used
  (`apps/integrations/authority/mock.py`) — deterministic, no credentials needed.
- Unit tests cover the XAdES round-trip and integration configuration
  (`apps/signing/tests.py`). Test command:
  `python manage.py test apps.signing.tests` (target the module instead of label-based
  discovery).

## 12. Known limitations / next steps

- **Medula (e-Prescription)** `test_connection` is still a stub; real SOAP handshake
  pending.
- Nilvera is configured as the reference integrator; a true end-to-end live test
  requires valid credentials + a draft invoice on the tenant.
- The e-Prescription signing flow exists in the backend, but authority submission
  depends on the provider.

## 13. Deployment checklist

1. Apply backend migrations (`signing` app — `0004_integrationconnection_...`).
2. Assign the `signing` module to the tenant (platform admin panel).
3. Grant `signing.read` / `signing.write` to the user's department.
4. Set the `AUTHORITY_ENCRYPTION_KEY` environment variable.
5. Configure the signing profile + connection + routing from the web panel.
6. Rebuild and restart the Docker stack.

---

## Related files

| Area | File |
|------|------|
| Module catalog | `backend/apps/common/permission_codes.py` |
| Login gating / sessions | `backend/apps/accounts/views.py`, `backend/apps/accounts/models.py` |
| XAdES | `backend/apps/signing/services/xades.py` |
| UBL-TR | `backend/apps/signing/services/ubl.py` |
| Signing flow (views) | `backend/apps/signing/views.py` |
| Config models | `backend/apps/signing/models.py` (`TenantSigningProfile`, `IntegrationConnection`, `DocumentRouting`) |
| Integration endpoints | `backend/apps/signing/views_integration.py`, `backend/apps/signing/urls.py` |
| Provider catalog | `backend/apps/integrations/authority/providers.py` |
| Credential encryption | `backend/apps/common/secretbox.py` |
| Frontend settings page | `frontend/src/app/features/signing/signing-integration.component.ts` |
| eimza API client | `eimza/src/main/services/apiClient.ts` |
| eimza signing flow | `eimza/src/main/services/signingService.ts` |
| Driver discovery | `eimza/src/main/services/driverDiscovery.ts` |

# Bundled PKCS#11 drivers (optional)

Drop a **redistributable** PKCS#11 library here to give users a zero-install
experience. The app auto-discovers and prefers these over system drivers.

Expected layout (filenames must match exactly):

```
resources/pkcs11/
  darwin/opensc-pkcs11.dylib
  win32/opensc-pkcs11.dll
  linux/opensc-pkcs11.so
```

## Notes

- **OpenSC** (https://github.com/OpenSC/OpenSC) is LGPL and may be redistributed.
  It supports many Turkish e-signature cards and only needs the OS PC/SC service
  (built into macOS and Windows).
- **AKİS is intentionally NOT bundled** — it is TÜBİTAK proprietary middleware and
  redistribution generally requires explicit permission. Users install AKİS via the
  in-app download button instead.
- macOS: a bundled `.dylib` must be signed with your Developer ID and the app must be
  notarized; otherwise hardened runtime will refuse to load it. You may also need the
  `com.apple.security.cs.disable-library-validation` entitlement.
- Provide the binary matching the build architecture (arm64 / x64).
- These folders may be empty; the in-app download + manual-select flow still works.

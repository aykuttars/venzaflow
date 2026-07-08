export const IPC = {
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_INFO: 'system:info',

  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_SESSION: 'auth:session',
  AUTH_RESTORE: 'auth:restore',

  PKCS11_DISCOVER_DRIVERS: 'pkcs11:discover-drivers',
  PKCS11_PROBE_TOKEN: 'pkcs11:probe-token',
  PKCS11_SET_DRIVER: 'pkcs11:set-driver',
  PKCS11_LIST_SLOTS: 'pkcs11:list-slots',
  PKCS11_LIST_CERTIFICATES: 'pkcs11:list-certificates',
  PKCS11_SELECT_CERTIFICATE: 'pkcs11:select-certificate',
  PKCS11_GET_SELECTED: 'pkcs11:get-selected',
  PKCS11_LOGOUT: 'pkcs11:logout',

  SIGN_LIST_TASKS: 'sign:list-tasks',
  SIGN_PREPARE: 'sign:prepare',
  SIGN_EXECUTE: 'sign:execute',
  SIGN_COMPLETE: 'sign:complete',
  SIGN_PREVIEW: 'sign:preview'
} as const

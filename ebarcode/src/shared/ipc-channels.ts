export const IPC = {
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_INFO: 'system:info',

  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_SESSION: 'auth:session',
  AUTH_RESTORE: 'auth:restore',

  BARCODE_LOOKUP: 'barcode:lookup',
  BARCODE_LIST_JOBS: 'barcode:list-jobs',
  BARCODE_JOB_TSPL: 'barcode:job-tspl',
  BARCODE_COMPLETE_JOB: 'barcode:complete-job',
  BARCODE_CREATE_JOB: 'barcode:create-job',
  BARCODE_LIST_TEMPLATES: 'barcode:list-templates',
  BARCODE_TRANSFER: 'barcode:transfer',
  BARCODE_EFFECTIVE_SETTINGS: 'barcode:effective-settings',

  PRINTER_LIST_PORTS: 'printer:list-ports',
  PRINTER_GET_SETTINGS: 'printer:get-settings',
  PRINTER_SAVE_SETTINGS: 'printer:save-settings',
  PRINTER_SEND_RAW: 'printer:send-raw',
  PRINTER_TEST: 'printer:test'
} as const

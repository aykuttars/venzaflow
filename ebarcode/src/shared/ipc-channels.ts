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

  SERVICE_CREATE_TICKET: 'service:create-ticket',
  SERVICE_LOOKUP: 'service:lookup',
  SERVICE_TRANSITION: 'service:transition',
  SERVICE_SUBMIT_DIAGNOSIS: 'service:submit-diagnosis',
  SERVICE_APPROVE_QUOTE: 'service:approve-quote',
  SERVICE_DELIVER: 'service:deliver',
  SERVICE_PRINT_INTAKE: 'service:print-intake',

  CUSTOMERS_SEARCH: 'customers:search',

  PRINTER_LIST_PORTS: 'printer:list-ports',
  PRINTER_GET_SETTINGS: 'printer:get-settings',
  PRINTER_SAVE_SETTINGS: 'printer:save-settings',
  PRINTER_SEND_RAW: 'printer:send-raw',
  PRINTER_TEST: 'printer:test'
} as const

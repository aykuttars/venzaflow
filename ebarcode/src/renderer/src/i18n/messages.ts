export type AppLocale = 'tr' | 'en'

export type MessageKey =
  | 'app.loading'
  | 'app.subtitle'
  | 'login.customerCode'
  | 'login.email'
  | 'login.password'
  | 'login.submit'
  | 'login.submitting'
  | 'login.failed'
  | 'dashboard.refresh'
  | 'dashboard.logout'
  | 'dashboard.tab.scan'
  | 'dashboard.tab.print'
  | 'dashboard.tab.settings'
  | 'dashboard.scan.hint'
  | 'dashboard.scan.placeholder'
  | 'dashboard.scan.notFound'
  | 'dashboard.scan.brand'
  | 'dashboard.scan.transferHint'
  | 'dashboard.scan.printLabel'
  | 'dashboard.scan.transfer'
  | 'dashboard.print.title'
  | 'dashboard.print.subtitle'
  | 'dashboard.print.runQueue'
  | 'dashboard.print.col.id'
  | 'dashboard.print.col.template'
  | 'dashboard.print.col.products'
  | 'dashboard.print.col.copies'
  | 'dashboard.print.col.status'
  | 'dashboard.print.empty'
  | 'dashboard.settings.printerTitle'
  | 'dashboard.settings.printerHint'
  | 'dashboard.settings.btWizard'
  | 'dashboard.settings.port'
  | 'dashboard.settings.portDefault'
  | 'dashboard.settings.autoPoll'
  | 'dashboard.settings.pollInterval'
  | 'dashboard.settings.save'
  | 'dashboard.settings.testLabel'
  | 'dashboard.settings.scannerTitle'
  | 'dashboard.settings.scannerHint'
  | 'dashboard.settings.scannerStep1'
  | 'dashboard.settings.scannerStep2'
  | 'dashboard.settings.scannerStep3'
  | 'dashboard.log.title'
  | 'dashboard.log.queueReadError'
  | 'dashboard.log.tenantProfile'
  | 'dashboard.log.tenantProfileError'
  | 'dashboard.log.queueEmpty'
  | 'dashboard.log.printing'
  | 'dashboard.log.done'
  | 'dashboard.log.printError'
  | 'dashboard.log.scan'
  | 'dashboard.log.jobCreated'
  | 'dashboard.log.jobError'
  | 'dashboard.log.transfer'
  | 'dashboard.log.transferError'
  | 'dashboard.log.settingsSaved'
  | 'dashboard.log.testSent'
  | 'dashboard.log.testError'
  | 'bt.title'
  | 'bt.step.powerOn'
  | 'bt.step.pairDarwin'
  | 'bt.step.pairWin32'
  | 'bt.step.pairLinux'
  | 'bt.step.selectPort'
  | 'bt.step.testPrint'
  | 'bt.step.save'
  | 'bt.port'
  | 'bt.portSelect'
  | 'bt.next'
  | 'bt.test'
  | 'bt.close'

const tr: Record<MessageKey, string> = {
  'app.loading': '{name} yükleniyor…',
  'app.subtitle': 'Masaüstü barkod & etiket köprüsü',
  'login.customerCode': 'Müşteri kodu',
  'login.email': 'E-posta',
  'login.password': 'Şifre',
  'login.submit': 'Giriş yap',
  'login.submitting': 'Giriş yapılıyor…',
  'login.failed': 'Giriş başarısız',
  'dashboard.refresh': 'Yenile',
  'dashboard.logout': 'Çıkış',
  'dashboard.tab.scan': 'Okuma',
  'dashboard.tab.print': 'Yazdırma ({count})',
  'dashboard.tab.settings': 'Yazıcı & Okuyucu',
  'dashboard.scan.hint': 'Netum F-18w USB/BT HID — okuyucu bu alana odaklıyken barkod gönderir.',
  'dashboard.scan.placeholder': 'Barkod okutun…',
  'dashboard.scan.notFound': 'Ürün bulunamadı',
  'dashboard.scan.brand': 'Marka: {brand}',
  'dashboard.scan.transferHint': "DEPO'da stok var — vitrin için transfer önerilir",
  'dashboard.scan.printLabel': 'Etiket yazdır',
  'dashboard.scan.transfer': 'DEPO → MAGAZA (1 adet)',
  'dashboard.print.title': 'Yazdırma kuyruğu',
  'dashboard.print.subtitle': 'Web veya bu uygulamadan oluşturulan queued işler',
  'dashboard.print.runQueue': 'Kuyruğu yazdır',
  'dashboard.print.col.id': '#',
  'dashboard.print.col.template': 'Şablon',
  'dashboard.print.col.products': 'Ürünler',
  'dashboard.print.col.copies': 'Kopya',
  'dashboard.print.col.status': 'Durum',
  'dashboard.print.empty': 'Kuyrukta iş yok',
  'dashboard.settings.printerTitle': 'XP-P328B yazıcı',
  'dashboard.settings.printerHint':
    'Tenant modu: {mode}. USB doğrudan veya Bluetooth SPP → seri port.',
  'dashboard.settings.btWizard': 'Bluetooth kurulum sihirbazı',
  'dashboard.settings.port': 'Seri / port',
  'dashboard.settings.portDefault': 'Varsayılan sistem yazıcısı',
  'dashboard.settings.autoPoll': 'Otomatik kuyruk kontrolü',
  'dashboard.settings.pollInterval': 'Kontrol aralığı (sn)',
  'dashboard.settings.save': 'Kaydet',
  'dashboard.settings.testLabel': 'Test etiketi',
  'dashboard.settings.scannerTitle': 'Netum F-18w okuyucu',
  'dashboard.settings.scannerHint':
    'Varsayılan HID klavye modu — ek sürücü gerekmez. USB veya BT HID ile bağlayın; Okuma sekmesindeki alan odaktayken barkod okutun.',
  'dashboard.settings.scannerStep1': 'Okuyucuyu USB veya Bluetooth HID modunda eşleştirin',
  'dashboard.settings.scannerStep2': 'Bu uygulamada Okuma sekmesine geçin (otomatik odak)',
  'dashboard.settings.scannerStep3': 'Kutu üzerindeki EAN barkodunu okutun',
  'dashboard.log.title': 'Günlük',
  'dashboard.log.queueReadError': 'Kuyruk okunamadı: {error}',
  'dashboard.log.tenantProfile': 'Tenant profil: {model} · print={mode}',
  'dashboard.log.tenantProfileError': 'Tenant yazdırma profili alınamadı',
  'dashboard.log.queueEmpty': 'Kuyrukta iş yok',
  'dashboard.log.printing': 'Yazdırılıyor #{id} {name}',
  'dashboard.log.done': 'Tamamlandı #{id}',
  'dashboard.log.printError': 'Yazdırma hatası: {error}',
  'dashboard.log.scan': 'Scan: {sku}',
  'dashboard.log.jobCreated': 'PrintJob oluşturuldu: {sku}',
  'dashboard.log.jobError': 'Job oluşturma hatası: {error}',
  'dashboard.log.transfer': 'Transfer: {sku} DEPO→MAGAZA',
  'dashboard.log.transferError': 'Transfer hatası: {error}',
  'dashboard.log.settingsSaved': 'Yazıcı ayarları kaydedildi',
  'dashboard.log.testSent': 'Test etiketi gönderildi',
  'dashboard.log.testError': 'Test baskı hatası: {error}',
  'bt.title': 'Bluetooth / Yazıcı kurulumu',
  'bt.step.powerOn': 'Bluetooth ve yazıcıyı açın',
  'bt.step.pairDarwin':
    "macOS'ta Sistem Ayarları → Bluetooth'tan Xprinter yazıcıyı eşleştirin (SPP/COM sürücüsü gerekirse Xprinter macOS sürücüsünü kurun)",
  'bt.step.pairWin32': "Windows'ta Xprinter sürücüsünü / Bluetooth eşleştirmesini tamamlayın",
  'bt.step.pairLinux':
    'Linux’ta yazıcıyı Bluetooth ile eşleştirin; gerekirse Xprinter Linux sürücüsünü ve /dev/ttyUSB* veya /dev/rfcomm* portunu kullanın',
  'bt.step.selectPort': 'Aşağıdan seri/USB portunu seçin',
  'bt.step.testPrint': 'Test yazdırması gönderin',
  'bt.step.save': 'Başarılıysa ayarları kaydedin',
  'bt.port': 'Port',
  'bt.portSelect': 'Seçin…',
  'bt.next': 'İleri',
  'bt.test': 'Test yazdır',
  'bt.close': 'Kapat'
}

const en: Record<MessageKey, string> = {
  'app.loading': 'Loading {name}…',
  'app.subtitle': 'Desktop barcode & label bridge',
  'login.customerCode': 'Customer code',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in…',
  'login.failed': 'Sign in failed',
  'dashboard.refresh': 'Refresh',
  'dashboard.logout': 'Sign out',
  'dashboard.tab.scan': 'Scan',
  'dashboard.tab.print': 'Print ({count})',
  'dashboard.tab.settings': 'Printer & Scanner',
  'dashboard.scan.hint': 'Netum F-18w USB/BT HID — scanner sends barcodes while this field is focused.',
  'dashboard.scan.placeholder': 'Scan barcode…',
  'dashboard.scan.notFound': 'Product not found',
  'dashboard.scan.brand': 'Brand: {brand}',
  'dashboard.scan.transferHint': 'Stock in warehouse — transfer to storefront suggested',
  'dashboard.scan.printLabel': 'Print label',
  'dashboard.scan.transfer': 'WAREHOUSE → STORE (1 unit)',
  'dashboard.print.title': 'Print queue',
  'dashboard.print.subtitle': 'Queued jobs from web or this app',
  'dashboard.print.runQueue': 'Print queue',
  'dashboard.print.col.id': '#',
  'dashboard.print.col.template': 'Template',
  'dashboard.print.col.products': 'Products',
  'dashboard.print.col.copies': 'Copies',
  'dashboard.print.col.status': 'Status',
  'dashboard.print.empty': 'No jobs in queue',
  'dashboard.settings.printerTitle': 'XP-P328B printer',
  'dashboard.settings.printerHint': 'Tenant mode: {mode}. USB direct or Bluetooth SPP → serial port.',
  'dashboard.settings.btWizard': 'Bluetooth setup wizard',
  'dashboard.settings.port': 'Serial / port',
  'dashboard.settings.portDefault': 'Default system printer',
  'dashboard.settings.autoPoll': 'Automatic queue polling',
  'dashboard.settings.pollInterval': 'Poll interval (sec)',
  'dashboard.settings.save': 'Save',
  'dashboard.settings.testLabel': 'Test label',
  'dashboard.settings.scannerTitle': 'Netum F-18w scanner',
  'dashboard.settings.scannerHint':
    'Default HID keyboard mode — no extra driver. Connect via USB or BT HID; scan while the Scan tab field is focused.',
  'dashboard.settings.scannerStep1': 'Pair the scanner in USB or Bluetooth HID mode',
  'dashboard.settings.scannerStep2': 'Open the Scan tab in this app (auto focus)',
  'dashboard.settings.scannerStep3': 'Scan the EAN barcode on the box',
  'dashboard.log.title': 'Log',
  'dashboard.log.queueReadError': 'Could not read queue: {error}',
  'dashboard.log.tenantProfile': 'Tenant profile: {model} · print={mode}',
  'dashboard.log.tenantProfileError': 'Could not load tenant print profile',
  'dashboard.log.queueEmpty': 'No jobs in queue',
  'dashboard.log.printing': 'Printing #{id} {name}',
  'dashboard.log.done': 'Completed #{id}',
  'dashboard.log.printError': 'Print error: {error}',
  'dashboard.log.scan': 'Scan: {sku}',
  'dashboard.log.jobCreated': 'Print job created: {sku}',
  'dashboard.log.jobError': 'Job creation error: {error}',
  'dashboard.log.transfer': 'Transfer: {sku} WAREHOUSE→STORE',
  'dashboard.log.transferError': 'Transfer error: {error}',
  'dashboard.log.settingsSaved': 'Printer settings saved',
  'dashboard.log.testSent': 'Test label sent',
  'dashboard.log.testError': 'Test print error: {error}',
  'bt.title': 'Bluetooth / Printer setup',
  'bt.step.powerOn': 'Turn on Bluetooth and the printer',
  'bt.step.pairDarwin':
    'On macOS, pair the Xprinter in System Settings → Bluetooth (install Xprinter macOS driver if SPP/COM is required)',
  'bt.step.pairWin32': 'On Windows, complete Xprinter driver / Bluetooth pairing',
  'bt.step.pairLinux':
    'On Linux, pair via Bluetooth; use Xprinter Linux driver and /dev/ttyUSB* or /dev/rfcomm* if needed',
  'bt.step.selectPort': 'Select the serial/USB port below',
  'bt.step.testPrint': 'Send a test print',
  'bt.step.save': 'If successful, save settings',
  'bt.port': 'Port',
  'bt.portSelect': 'Select…',
  'bt.next': 'Next',
  'bt.test': 'Test print',
  'bt.close': 'Close'
}

export const messages: Record<AppLocale, Record<MessageKey, string>> = { tr, en }

export function normalizeLocale(value: string | undefined): AppLocale {
  return value?.toLowerCase().startsWith('en') ? 'en' : 'tr'
}

export function formatMessage(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

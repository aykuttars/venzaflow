export type AppLocale = 'tr' | 'en'

export type MessageKey =
  | 'app.loading'
  | 'app.subtitle'
  | 'login.customerCode'
  | 'login.customerCodePlaceholder'
  | 'login.email'
  | 'login.emailPlaceholder'
  | 'login.password'
  | 'login.submit'
  | 'login.submitting'
  | 'login.failed'
  | 'dashboard.refresh'
  | 'dashboard.logout'
  | 'dashboard.tab.scan'
  | 'dashboard.tab.service'
  | 'dashboard.tab.print'
  | 'dashboard.tab.settings'
  | 'dashboard.scan.hint'
  | 'dashboard.scan.placeholder'
  | 'dashboard.scan.notFound'
  | 'dashboard.scan.notFoundDetail'
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
  | 'dashboard.settings.autoPollHint'
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
  | 'service.tab.intake'
  | 'service.tab.lookup'
  | 'service.intake.hint'
  | 'service.intake.quick'
  | 'service.intake.existing'
  | 'service.intake.submit'
  | 'service.field.intakeMode'
  | 'service.field.customerSearch'
  | 'service.field.customerSearchPlaceholder'
  | 'service.field.customerSearchMin'
  | 'service.field.customerSearching'
  | 'service.field.clearCustomer'
  | 'service.lookup.hint'
  | 'service.lookup.placeholder'
  | 'service.lookup.searching'
  | 'service.lookup.minChars'
  | 'service.lookup.notFound'
  | 'service.lookup.reprint'
  | 'service.deliver.title'
  | 'service.deliver.submit'
  | 'service.deliver.already'
  | 'service.field.customerName'
  | 'service.field.customerLastName'
  | 'service.field.phone'
  | 'service.field.brand'
  | 'service.field.model'
  | 'service.field.serial'
  | 'service.field.complaint'
  | 'service.field.status'
  | 'service.field.estimated'
  | 'service.field.finalPrice'
  | 'service.field.payment'
  | 'service.field.diagnosis'
  | 'service.actions.diagnosis'
  | 'service.actions.startDiagnosis'
  | 'service.actions.approve'
  | 'service.actions.reject'
  | 'service.actions.markReady'
  | 'service.actions.saveDiagnosis'
  | 'service.log.transition'
  | 'service.log.transitionError'
  | 'service.log.diagnosisSaved'
  | 'service.log.diagnosisError'
  | 'service.log.approved'
  | 'service.log.approveError'
  | 'service.payment.cash'
  | 'service.payment.card'
  | 'service.payment.iban'
  | 'service.status.received'
  | 'service.status.diagnosing'
  | 'service.status.awaiting'
  | 'service.status.inRepair'
  | 'service.status.ready'
  | 'service.status.delivered'
  | 'service.status.cancelled'
  | 'service.log.intakeCreated'
  | 'service.log.intakeError'
  | 'service.log.lookup'
  | 'service.log.delivered'
  | 'service.log.deliverError'
  | 'service.log.reprint'
  | 'service.log.reprintError'
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
  'login.customerCodePlaceholder': 'Customer Code',
  'login.email': 'E-posta',
  'login.emailPlaceholder': 'Email',
  'login.password': 'Şifre',
  'login.submit': 'Giriş yap',
  'login.submitting': 'Giriş yapılıyor…',
  'login.failed': 'Giriş başarısız',
  'dashboard.refresh': 'Yenile',
  'dashboard.logout': 'Çıkış',
  'dashboard.tab.scan': 'Okuma',
  'dashboard.tab.service': 'Servis',
  'dashboard.tab.print': 'Yazdırma ({count})',
  'dashboard.tab.settings': 'Yazıcı & Okuyucu',
  'dashboard.scan.hint': 'Netum F-18w USB/BT HID — okuyucu bu alana odaklıyken barkod gönderir.',
  'dashboard.scan.placeholder': 'Barkod okutun…',
  'dashboard.scan.notFound': 'Ürün bulunamadı',
  'dashboard.scan.notFoundDetail': 'Ürün bulunamadı — okunan: «{code}»',
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
  'dashboard.settings.autoPollHint':
    'Açıkken yazdırma kuyruğu arka planda kontrol edilir; yeni işler otomatik yazıcıya gönderilir.',
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
  'service.tab.intake': 'Teslim al',
  'service.tab.lookup': 'Ara / Teslim et',
  'service.intake.hint': 'Cihaz teslim alma — kayıt oluşturulunca servis ve müşteri etiketleri yazdırma kuyruğuna eklenir.',
  'service.intake.quick': 'Hızlı (ad + telefon)',
  'service.intake.existing': 'Kayıtlı müşteri',
  'service.intake.submit': 'Kaydet ve etiket yazdır',
  'service.field.intakeMode': 'Müşteri girişi',
  'service.field.customerSearch': 'Müşteri ara',
  'service.field.customerSearchPlaceholder': 'Ad, telefon veya e-posta…',
  'service.field.customerSearchMin': 'Aramak için en az {count} karakter yazın',
  'service.field.customerSearching': 'Müşteriler aranıyor…',
  'service.field.clearCustomer': 'Seçimi temizle',
  'service.lookup.hint': 'Kayıt no (SR-…), telefon, ad veya ad soyad ile arayın; listeden seçin.',
  'service.lookup.placeholder': 'Kayıt no, telefon veya müşteri adı…',
  'service.lookup.searching': 'Kayıtlar aranıyor…',
  'service.lookup.minChars': 'Aramak için en az {count} karakter yazın',
  'service.lookup.notFound': 'Kayıt bulunamadı — «{code}»',
  'service.lookup.reprint': 'Teslim etiketlerini yeniden yazdır',
  'service.deliver.title': 'Teslim ve tahsilat',
  'service.deliver.submit': 'Teslim et',
  'service.deliver.already': 'Bu kayıt zaten teslim edilmiş.',
  'service.field.customerName': 'Müşteri adı',
  'service.field.customerLastName': 'Müşteri soyadı',
  'service.field.phone': 'Telefon',
  'service.field.brand': 'Marka',
  'service.field.model': 'Model',
  'service.field.serial': 'Seri no',
  'service.field.complaint': 'Şikayet',
  'service.field.status': 'Durum',
  'service.field.estimated': 'Tahmini ücret',
  'service.field.finalPrice': 'Tahsil edilen tutar (₺)',
  'service.field.payment': 'Ödeme yöntemi',
  'service.field.diagnosis': 'Teşhis',
  'service.actions.diagnosis': 'Teşhis gir',
  'service.actions.startDiagnosis': 'Teşhise başla',
  'service.actions.approve': 'Müşteri onayladı',
  'service.actions.reject': 'Red / iptal',
  'service.actions.markReady': 'Tamir bitti',
  'service.actions.saveDiagnosis': 'Teşhisi kaydet',
  'service.log.transition': 'Durum güncellendi: {number}',
  'service.log.transitionError': 'Durum hatası: {error}',
  'service.log.diagnosisSaved': 'Teşhis kaydedildi: {number}',
  'service.log.diagnosisError': 'Teşhis hatası: {error}',
  'service.log.approved': 'Onaylandı: {number}',
  'service.log.approveError': 'Onay hatası: {error}',
  'service.payment.cash': 'Nakit',
  'service.payment.card': 'Kart',
  'service.payment.iban': 'IBAN / Havale',
  'service.status.received': 'Teslim alındı',
  'service.status.diagnosing': 'Teşhis',
  'service.status.awaiting': 'Onay bekliyor',
  'service.status.inRepair': 'Tamirde',
  'service.status.ready': 'Teslime hazır',
  'service.status.delivered': 'Teslim edildi',
  'service.status.cancelled': 'İptal',
  'service.log.intakeCreated': 'Servis kaydı: {number}',
  'service.log.intakeError': 'Teslim alma hatası: {error}',
  'service.log.lookup': 'Kayıt bulundu: {number}',
  'service.log.delivered': 'Teslim edildi: {number}',
  'service.log.deliverError': 'Teslim hatası: {error}',
  'service.log.reprint': 'Etiket kuyruğa alındı: {number}',
  'service.log.reprintError': 'Yeniden yazdırma hatası: {error}',
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
  'login.customerCodePlaceholder': 'Customer Code',
  'login.email': 'Email',
  'login.emailPlaceholder': 'Email',
  'login.password': 'Password',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in…',
  'login.failed': 'Sign in failed',
  'dashboard.refresh': 'Refresh',
  'dashboard.logout': 'Sign out',
  'dashboard.tab.scan': 'Scan',
  'dashboard.tab.service': 'Service',
  'dashboard.tab.print': 'Print ({count})',
  'dashboard.tab.settings': 'Printer & Scanner',
  'dashboard.scan.hint': 'Netum F-18w USB/BT HID — scanner sends barcodes while this field is focused.',
  'dashboard.scan.placeholder': 'Scan barcode…',
  'dashboard.scan.notFound': 'Product not found',
  'dashboard.scan.notFoundDetail': 'Product not found — scanned: «{code}»',
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
  'dashboard.settings.autoPollHint':
    'When enabled, the print queue is checked in the background and new jobs are sent to the printer.',
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
  'service.tab.intake': 'Intake',
  'service.tab.lookup': 'Lookup / Deliver',
  'service.intake.hint': 'Device intake — shop and customer labels are queued for printing after save.',
  'service.intake.quick': 'Quick (name + phone)',
  'service.intake.existing': 'Existing customer',
  'service.intake.submit': 'Save & print labels',
  'service.field.intakeMode': 'Customer entry',
  'service.field.customerSearch': 'Search customer',
  'service.field.customerSearchPlaceholder': 'Name, phone or email…',
  'service.field.customerSearchMin': 'Type at least {count} characters to search',
  'service.field.customerSearching': 'Searching customers…',
  'service.field.clearCustomer': 'Clear selection',
  'service.lookup.hint': 'Search by ticket # (SR-…), phone, or customer name; pick from the list.',
  'service.lookup.placeholder': 'Ticket #, phone or customer name…',
  'service.lookup.searching': 'Searching tickets…',
  'service.lookup.minChars': 'Type at least {count} characters to search',
  'service.lookup.notFound': 'Ticket not found — «{code}»',
  'service.lookup.reprint': 'Reprint intake labels',
  'service.deliver.title': 'Pickup & payment',
  'service.deliver.submit': 'Deliver',
  'service.deliver.already': 'This ticket is already delivered.',
  'service.field.customerName': 'First name',
  'service.field.customerLastName': 'Last name',
  'service.field.phone': 'Phone',
  'service.field.brand': 'Brand',
  'service.field.model': 'Model',
  'service.field.serial': 'Serial no',
  'service.field.complaint': 'Complaint',
  'service.field.status': 'Status',
  'service.field.estimated': 'Estimated price',
  'service.field.finalPrice': 'Amount collected (₺)',
  'service.field.payment': 'Payment method',
  'service.field.diagnosis': 'Diagnosis',
  'service.actions.diagnosis': 'Enter diagnosis',
  'service.actions.startDiagnosis': 'Start diagnosis',
  'service.actions.approve': 'Customer approved',
  'service.actions.reject': 'Reject / cancel',
  'service.actions.markReady': 'Repair complete',
  'service.actions.saveDiagnosis': 'Save diagnosis',
  'service.log.transition': 'Status updated: {number}',
  'service.log.transitionError': 'Status error: {error}',
  'service.log.diagnosisSaved': 'Diagnosis saved: {number}',
  'service.log.diagnosisError': 'Diagnosis error: {error}',
  'service.log.approved': 'Approved: {number}',
  'service.log.approveError': 'Approval error: {error}',
  'service.payment.cash': 'Cash',
  'service.payment.card': 'Card',
  'service.payment.iban': 'Bank transfer',
  'service.status.received': 'Received',
  'service.status.diagnosing': 'Diagnosing',
  'service.status.awaiting': 'Awaiting approval',
  'service.status.inRepair': 'In repair',
  'service.status.ready': 'Ready for pickup',
  'service.status.delivered': 'Delivered',
  'service.status.cancelled': 'Cancelled',
  'service.log.intakeCreated': 'Service ticket: {number}',
  'service.log.intakeError': 'Intake error: {error}',
  'service.log.lookup': 'Ticket found: {number}',
  'service.log.delivered': 'Delivered: {number}',
  'service.log.deliverError': 'Delivery error: {error}',
  'service.log.reprint': 'Labels queued: {number}',
  'service.log.reprintError': 'Reprint error: {error}',
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

"""Demo tenant: bilgisayar donanımı perakende mağazası (yüksek SKU çeşitliliği)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES, filter_codenames_for_tenant
from apps.inventory.models import Location, Stock, Warehouse
from apps.products.field_validation import validate_field_value
from apps.products.models import (
    Category,
    FieldType,
    Product,
    ProductFieldDefinition,
    ProductFieldValue,
)
from apps.products.ui_defaults import seed_ui_config_for_tenant
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()

CUSTOMER_CODE = "4500"
TENANT_NAME = "Lens Bilisim Teknoloji"
EMAIL_DOMAIN = "lens.local"
DEFAULT_PASSWORD = "X7@qL9#vT2!mZ4$k"

HARDWARE_MODULES = [
    "products",
    "inventory",
    "barcode",
    "billing",
    "dashboard",
    "employees",
    "settings",
    "audit",
]

BARCODE_MODULE_PARENTS = {"barcode": "inventory"}

CATEGORIES: list[tuple[str, str]] = [
    ("Anakart", "anakart"),
    ("Ekran kartı", "ekran-karti"),
    ("Güç kaynağı", "guc-kaynagi"),
    ("Kasa", "kasa"),
    ("Soğutma", "sogutma"),
    ("Depolama", "depolama"),
    ("RAM", "ram"),
    ("İşlemci", "islemci"),
    ("Periferik", "periferik"),
    ("Monitör", "monitor"),
    ("Konsol & oyun", "konsol"),
    ("Ağ & güvenlik", "ag-guvenlik"),
    ("Ses & hoparlör", "ses"),
    ("Kablo & aksesuar", "aksesuar"),
    ("Ofis ekipmanı", "ofis"),
]

# (sku, name, category_slug, unit_price, cost_price, barcode, brand, stock_qty, reorder)
PRODUCTS: list[tuple[str, str, str, str, str, str, str, int, int]] = [
    ("MB-ASUS-Z690-P", "ASUS Prime Z690-P WIFI", "anakart", "8499.00", "7200.00", "8598765432101", "ASUS", 8, 2),
    ("MB-MSI-B760", "MSI PRO B760M-P DDR4", "anakart", "4299.00", "3600.00", "8598765432102", "MSI", 14, 3),
    ("MB-GIGABYTE-B550", "Gigabyte B550 AORUS ELITE", "anakart", "5199.00", "4400.00", "8598765432103", "Gigabyte", 6, 2),
    ("GPU-RTX4060-GB", "Gigabyte GeForce RTX 4060 8G", "ekran-karti", "12999.00", "11200.00", "8598765432201", "Gigabyte", 5, 2),
    ("GPU-RTX4060-ASUS", "ASUS Dual RTX 4060 OC 8GB", "ekran-karti", "13499.00", "11600.00", "8598765432202", "ASUS", 4, 1),
    ("GPU-RTX4070-MSI", "MSI Ventus 2X RTX 4070 12G", "ekran-karti", "21999.00", "19800.00", "8598765432203", "MSI", 3, 1),
    ("GPU-RX7600-SAP", "Sapphire Pulse RX 7600 8GB", "ekran-karti", "10999.00", "9800.00", "8598765432204", "Sapphire", 6, 2),
    ("PSU-RMP-650", "Rampage Smart 650W 80+ Bronze", "guc-kaynagi", "2499.00", "1950.00", "8598765432301", "Rampage", 22, 5),
    ("PSU-RMP-750G", "Rampage Turbo 750W 80+ Gold", "guc-kaynagi", "3799.00", "3100.00", "8598765432302", "Rampage", 15, 4),
    ("PSU-CORSAIR-RM750", "Corsair RM750 80+ Gold", "guc-kaynagi", "5499.00", "4700.00", "8598765432303", "Corsair", 9, 3),
    ("CASE-ELITE-SHARK", "Elite Shark Mesh RGB Mid Tower", "kasa", "2899.00", "2200.00", "8598765432401", "Elite Shark", 18, 4),
    ("CASE-GAMETECH", "GameTech Ares 4FAN ARGB", "kasa", "1999.00", "1550.00", "8598765432402", "GameTech", 25, 6),
    ("CASE-ZOKO-Z5", "Zoko Z5 Tempered Glass", "kasa", "1699.00", "1280.00", "8598765432403", "Zoko", 30, 8),
    ("COOL-ASUS-LC360", "ASUS Prime LC 360 ARGB", "sogutma", "4999.00", "4200.00", "8598765432501", "ASUS", 7, 2),
    ("COOL-CM-H410", "Cooler Master Hyper 410R", "sogutma", "899.00", "650.00", "8598765432502", "Cooler Master", 35, 10),
    ("COOL-DEEPCOOL-AG400", "DeepCool AG400 LED", "sogutma", "649.00", "480.00", "8598765432503", "DeepCool", 40, 12),
    ("SSD-KING-1TB", "Kingston NV2 1TB NVMe", "depolama", "2799.00", "2350.00", "8598765432601", "Kingston", 28, 8),
    ("SSD-SAMS-500", "Samsung 990 EVO 500GB", "depolama", "3299.00", "2850.00", "8598765432602", "Samsung", 16, 5),
    ("SSD-WD-2TB", "WD Blue SN580 2TB", "depolama", "5499.00", "4900.00", "8598765432603", "WD", 10, 3),
    ("HDD-SEAGATE-2TB", "Seagate Barracuda 2TB 7200RPM", "depolama", "1899.00", "1550.00", "8598765432604", "Seagate", 20, 6),
    ("RAM-KING-16", "Kingston Fury 16GB DDR4 3200", "ram", "1499.00", "1180.00", "8598765432701", "Kingston", 32, 10),
    ("RAM-CORSAIR-32", "Corsair Vengeance 32GB DDR5 5600", "ram", "3999.00", "3400.00", "8598765432702", "Corsair", 12, 4),
    ("RAM-GSKILL-16", "G.Skill Ripjaws 16GB DDR4 3600", "ram", "1699.00", "1350.00", "8598765432703", "G.Skill", 24, 8),
    ("MOU-LOG-G203", "Logitech G203 Lightsync", "periferik", "899.00", "680.00", "8598765432801", "Logitech", 45, 12),
    ("MOU-LOG-G502", "Logitech G502 HERO", "periferik", "1899.00", "1500.00", "8598765432802", "Logitech", 18, 5),
    ("KEY-LOG-G213", "Logitech G213 Prodigy", "periferik", "1299.00", "980.00", "8598765432803", "Logitech", 22, 6),
    ("HS-LOG-G435", "Logitech G435 Kablosuz", "periferik", "2499.00", "2050.00", "8598765432804", "Logitech", 14, 4),
    ("HS-HYPERX-CLOUD", "HyperX Cloud II", "periferik", "2999.00", "2450.00", "8598765432805", "HyperX", 11, 3),
    ("CON-PS5-SLIM", "PlayStation 5 Slim Dijital", "konsol", "18999.00", "17500.00", "8598765432901", "Sony", 4, 1),
    ("CON-PS5-DISC", "PlayStation 5 Slim Disk", "konsol", "21999.00", "20200.00", "8598765432902", "Sony", 3, 1),
    ("CON-XBOX-S", "Xbox Series S 512GB", "konsol", "11999.00", "10800.00", "8598765432903", "Microsoft", 6, 2),
    ("ACC-HDMI-2M", "HDMI 2.1 Kablo 2m", "aksesuar", "299.00", "120.00", "8598765433001", "Generic", 80, 20),
    ("ACC-USB-C-HUB", "USB-C 7in1 Hub", "aksesuar", "899.00", "520.00", "8598765433002", "Ugreen", 35, 10),
    ("ACC-THERMAL", "Thermal Grizzly Kryonaut 1g", "aksesuar", "449.00", "280.00", "8598765433003", "Thermal Grizzly", 50, 15),
    ("ACC-MOUSEPAD-XL", "RGB Mousepad XL", "aksesuar", "399.00", "180.00", "8598765433004", "Rampage", 60, 20),
    ("ACC-WIFI-AX", "TP-Link AX1800 WiFi USB", "aksesuar", "799.00", "580.00", "8598765433005", "TP-Link", 25, 8),
    ("CPU-INTEL-13400F", "Intel Core i5-13400F", "islemci", "8999.00", "8200.00", "8598765432110", "Intel", 7, 2),
    ("CPU-AMD-5600", "AMD Ryzen 5 5600", "islemci", "6499.00", "5900.00", "8598765432111", "AMD", 9, 3),
    # — Görsellerden ek: anakart / GPU —
    ("MB-ASUS-Z790-P", "ASUS Prime Z790-P WIFI", "anakart", "11499.00", "9800.00", "8598765432112", "ASUS", 5, 2),
    ("MB-ASUS-TUF-B650", "ASUS TUF Gaming B650-PLUS", "anakart", "6999.00", "5900.00", "8598765432113", "ASUS", 6, 2),
    ("GPU-RTX3060-GB", "Gigabyte GeForce RTX 3060 12G", "ekran-karti", "9999.00", "8800.00", "8598765432210", "Gigabyte", 8, 3),
    ("GPU-RTX3070-ASUS", "ASUS TUF RTX 3070 8G", "ekran-karti", "14999.00", "13200.00", "8598765432211", "ASUS", 4, 1),
    ("GPU-RTX4060-TUF", "ASUS TUF Gaming RTX 4060 OC", "ekran-karti", "13999.00", "12100.00", "8598765432212", "ASUS", 6, 2),
    # — Kasa (Zoko, Amiral, Archon, Fazeon, Sharkoon, Rampage) —
    ("CASE-ZOKO-CHIKO", "Zoko Chiko ATX Gaming Case", "kasa", "1899.00", "1420.00", "8598765432410", "Zoko", 22, 6),
    ("CASE-ZOKO-CHIKO-W", "Zoko Chiko White Tempered Glass", "kasa", "2099.00", "1580.00", "8598765432411", "Zoko", 14, 4),
    ("CASE-ZOKO-MELODY", "Zoko Melody RGB Gaming Case", "kasa", "2199.00", "1650.00", "8598765432412", "Zoko", 12, 4),
    ("CASE-ZOKO-KING", "Zoko King Mid Tower", "kasa", "1799.00", "1350.00", "8598765432413", "Zoko", 16, 5),
    ("CASE-AMIRAL-LUX", "Amiral Luxury PC Chassis", "kasa", "3299.00", "2600.00", "8598765432414", "Amiral", 8, 2),
    ("CASE-ARCHON-NEON", "Archon Neon X Computer Case", "kasa", "2499.00", "1900.00", "8598765432415", "Archon", 10, 3),
    ("CASE-FAZEON-F7", "Fazeon F7 Mesh Gaming Case", "kasa", "2799.00", "2100.00", "8598765432416", "Fazeon", 11, 3),
    ("CASE-PB-P803", "Power Boost PB-P803AB Mesh ARGB", "kasa", "1999.00", "1500.00", "8598765432417", "Power Boost", 15, 4),
    ("CASE-SHARK-CA300", "Sharkoon Elite Shark CA300 ATX", "kasa", "3199.00", "2450.00", "8598765432418", "Sharkoon", 10, 3),
    ("CASE-RMP-COMPACT", "Rampage Compact PRO-723 4FAN+750W", "kasa", "4499.00", "3600.00", "8598765432419", "Rampage", 6, 2),
    ("CASE-GAMETECH-F7", "GameTech F7 RGB Mid Tower", "kasa", "2299.00", "1750.00", "8598765432420", "GameTech", 9, 3),
    # — PSU ek —
    ("PSU-FAZEON-550", "Fazeon PW Series 550W", "guc-kaynagi", "1899.00", "1450.00", "8598765432310", "Fazeon", 18, 5),
    ("PSU-FAZEON-650", "Fazeon PW Series 650W 80+", "guc-kaynagi", "2199.00", "1700.00", "8598765432311", "Fazeon", 14, 4),
    ("PSU-CORSAIR-CX550", "Corsair CX550 80+ Bronze", "guc-kaynagi", "2799.00", "2300.00", "8598765432312", "Corsair", 12, 4),
    ("PSU-SHARK-600", "Sharkoon Cratos Lite 600W 80+", "guc-kaynagi", "1999.00", "1550.00", "8598765432313", "Sharkoon", 20, 6),
    ("PSU-REVENGE-V120", "Revenge Infinite V120 650W", "guc-kaynagi", "2299.00", "1780.00", "8598765432314", "Revenge", 10, 3),
    # — Monitör & laptop kutusu benzeri —
    ("MON-ACER-24", "Acer Nitro 24\" 165Hz IPS", "monitor", "6999.00", "6100.00", "8598765432806", "Acer", 8, 2),
    ("MON-LG-27", "LG 27\" UltraGear 144Hz", "monitor", "8999.00", "7800.00", "8598765432807", "LG", 5, 2),
    ("MON-ASUS-TUF-27", "ASUS TUF Gaming VG27 165Hz", "monitor", "9499.00", "8200.00", "8598765432810", "ASUS", 6, 2),
    ("MON-LEN-24", "Lenovo 24\" FHD Office Monitor", "monitor", "4999.00", "4200.00", "8598765432811", "Lenovo", 10, 3),
    ("MON-HP-22", "HP 22\" Business Monitor", "monitor", "3999.00", "3300.00", "8598765432812", "HP", 12, 4),
    # — Periferik: fare, klavye, kulaklık (duvar rafı) —
    ("MOU-RMP-BLAZE", "Rampage Blaze RGB Gaming Mouse", "periferik", "599.00", "380.00", "8598765432820", "Rampage", 55, 15),
    ("MOU-RMP-SMART", "Rampage Smart 7200 DPI Mouse", "periferik", "449.00", "290.00", "8598765432821", "Rampage", 60, 18),
    ("MOU-XTRIKE", "X-trike Me Wireless Gaming Mouse", "periferik", "699.00", "450.00", "8598765432822", "X-trike Me", 40, 12),
    ("MOU-RAZER-DA", "Razer DeathAdder Essential", "periferik", "1299.00", "980.00", "8598765432823", "Razer", 25, 8),
    ("MOU-STEEL-RVL", "SteelSeries Rival 3", "periferik", "1199.00", "900.00", "8598765432824", "SteelSeries", 20, 6),
    ("MOU-BLOODY-V7", "Bloody V7 Gaming Mouse", "periferik", "899.00", "620.00", "8598765432825", "Bloody", 35, 10),
    ("MOU-LOG-MXV", "Logitech MX Vertical Ergonomic", "periferik", "2499.00", "2050.00", "8598765432826", "Logitech", 12, 4),
    ("KEY-BLOODY-B820", "Bloody B820 Light Strike Klavye", "periferik", "1899.00", "1450.00", "8598765432830", "Bloody", 18, 5),
    ("KEY-RMP-RGB", "Rampage RGB Membrane Klavye", "periferik", "799.00", "520.00", "8598765432831", "Rampage", 28, 8),
    ("HS-RMP-7.1", "Rampage 7.1 USB Gaming Kulaklık", "periferik", "999.00", "720.00", "8598765432835", "Rampage", 22, 6),
    # — Konsol & oyun aksesuar —
    ("CON-PS4-PAD-B", "PS4 DualShock 4 Mavi", "konsol", "2499.00", "1850.00", "8598765432910", "Sony", 24, 8),
    ("CON-PS4-PAD-W", "PS4 DualShock 4 Beyaz", "konsol", "2499.00", "1850.00", "8598765432911", "Sony", 20, 6),
    # — Ağ & güvenlik kameraları —
    ("CAM-WIFI-SMART", "Wi-Fi Smart Camera 1080p", "ag-guvenlik", "1899.00", "1350.00", "8598765433101", "Generic", 30, 8),
    ("CAM-AI-SOLAR", "AI Smart Solar Camera", "ag-guvenlik", "3499.00", "2700.00", "8598765433102", "Generic", 18, 5),
    ("CAM-4G-PTZ", "4G Solar PTZ Security Camera", "ag-guvenlik", "5999.00", "4800.00", "8598765433103", "Generic", 10, 3),
    ("CAM-HD-DUAL", "HD Smart Camera Dual Lens", "ag-guvenlik", "2799.00", "2100.00", "8598765433104", "Generic", 15, 4),
    ("NET-TP-AX1800", "TP-Link Archer AX1800 Router", "ag-guvenlik", "2799.00", "2200.00", "8598765433110", "TP-Link", 14, 4),
    ("NET-TP-AX3000", "TP-Link AX3000 WiFi 6 Router", "ag-guvenlik", "3999.00", "3200.00", "8598765433111", "TP-Link", 10, 3),
    ("NET-ASUS-RT", "ASUS RT-AX55 WiFi 6 Router", "ag-guvenlik", "3499.00", "2850.00", "8598765433112", "ASUS", 8, 2),
    ("NET-SW-8", "8 Port Gigabit Switch", "ag-guvenlik", "899.00", "580.00", "8598765433113", "Generic", 25, 8),
    # — Ses —
    ("SPK-PLAT-4127", "Platoon PL-4127 RGB Portable Speaker", "ses", "1299.00", "850.00", "8598765433201", "Platoon", 20, 6),
    ("SPK-JBL-GO", "JBL Go 3 Bluetooth Hoparlör", "ses", "1499.00", "1100.00", "8598765433202", "JBL", 15, 5),
  # — Kablo & duvar aksesuar (yüksek adet) —
    ("ACC-HDMI-3M", "HDMI 2.1 Kablo 3m", "aksesuar", "399.00", "150.00", "8598765433010", "Generic", 100, 25),
    ("ACC-HDMI-5M", "HDMI 2.0 Kablo 5m", "aksesuar", "499.00", "200.00", "8598765433011", "Generic", 80, 20),
    ("ACC-USB-A-C", "USB-A to USB-C Kablo 1m", "aksesuar", "149.00", "45.00", "8598765433012", "Generic", 120, 30),
    ("ACC-USB-C-C", "USB-C to USB-C 100W 2m", "aksesuar", "299.00", "120.00", "8598765433013", "Generic", 90, 22),
    ("ACC-LAN-5M", "Cat6 Ethernet Kablo 5m", "aksesuar", "199.00", "70.00", "8598765433014", "Generic", 70, 18),
    ("ACC-SD-128", "MicroSD 128GB Class 10", "aksesuar", "599.00", "420.00", "8598765433015", "SanDisk", 45, 12),
    ("ACC-SD-64", "MicroSD 64GB Class 10", "aksesuar", "349.00", "240.00", "8598765433016", "SanDisk", 55, 15),
    ("ACC-WEBCAM-HD", "1080p USB Webcam", "aksesuar", "899.00", "580.00", "8598765433017", "Generic", 25, 8),
    ("ACC-MON-MOUNT", "Dual Monitor Desk Mount", "aksesuar", "1999.00", "1400.00", "8598765433018", "Generic", 12, 4),
    ("ACC-PHONE-C", "USB-C Hızlı Şarj Kablosu", "aksesuar", "129.00", "40.00", "8598765433019", "Generic", 150, 40),
    ("ACC-EAR-BT", "Bluetooth TWS Kulaklık", "aksesuar", "499.00", "280.00", "8598765433020", "Generic", 40, 12),
    # — Ofis —
    ("OFC-EPSON-L3250", "Epson EcoTank L3250 Yazıcı", "ofis", "8999.00", "7500.00", "8598765433301", "Epson", 5, 2),
    ("OFC-EPSON-L1250", "Epson L1250 Tek Fonksiyon", "ofis", "4999.00", "4100.00", "8598765433302", "Epson", 7, 2),
    ("OFC-CANON-G3410", "Canon G3410 Mürekkep Tank", "ofis", "6999.00", "5800.00", "8598765433303", "Canon", 4, 1),
]


def _ensure_permissions() -> dict[str, Permission]:
    perms = {}
    for codename, name in PERMISSION_CODENAMES:
        obj, _ = Permission.objects.get_or_create(codename=codename, defaults={"name": name})
        perms[codename] = obj
    return perms


def _mk_department(
    tenant: Tenant,
    key: str,
    name: str,
    codenames: list[str],
    perm_index: dict[str, Permission],
) -> Department:
    dept, _ = Department.objects.get_or_create(tenant=tenant, key=key, defaults={"name": name})
    dept.name = name
    dept.save()
    allowed = filter_codenames_for_tenant(codenames, tenant.enabled_modules)
    dept.permissions.set([perm_index[c] for c in allowed if c in perm_index])
    return dept


@transaction.atomic
def seed_hardware_retail_tenant(*, payment_currency=None) -> Tenant:
    """Create/update tenant 4500 with categories, products, stock, dynamic fields."""
    from apps.platform_billing.models import Currency

    perm_index = _ensure_permissions()
    try_currency = payment_currency or Currency.objects.filter(code="TRY", is_active=True).first()

    tenant, _ = Tenant.objects.update_or_create(
        customer_code=CUSTOMER_CODE,
        defaults={
            "name": TENANT_NAME,
            "default_language": Tenant.Language.TR,
            "is_active": True,
            "enabled_modules": HARDWARE_MODULES,
            "max_users": 15,
            "billing_period": Tenant.BillingPeriod.MONTHLY,
            "payment_currency": try_currency,
            "module_labels": {
                "products": "Ürünler",
                "inventory": "Depo & Stok",
                "barcode": "Barkod",
            },
        },
    )
    set_module_subscriptions(
        tenant,
        HARDWARE_MODULES,
        extra_modules=set(),
        module_parents=BARCODE_MODULE_PARENTS,
    )

    from apps.barcode.services.seed_templates import seed_default_templates

    seed_default_templates(tenant.id, skip_existing=True)

    from apps.barcode.models import LabelTemplate
    from apps.barcode.services.settings import get_or_create_settings

    get_or_create_settings(tenant.id)
    dept_template_map = {
        "depo_koli": ["warehouse"],
        "depo_raf": ["warehouse"],
        "magaza_fiyat": ["sales"],
        "magaza_mini": ["sales"],
        "blank": ["admin", "sales", "warehouse"],
    }
    for default_key, dept_keys in dept_template_map.items():
        LabelTemplate.objects.filter(tenant=tenant, default_key=default_key).update(
            allowed_department_keys=dept_keys
        )

    admin_codes = [c[0] for c in PERMISSION_CODENAMES]
    sales_codes = [
        "products.read",
        "products.write",
        "inventory.read",
        "inventory.write",
        "billing.read",
        "billing.write",
        "dashboard.read",
        "barcode.scan",
        "barcode.print",
        "barcode.labels",
        "barcode.generate",
    ]
    warehouse_codes = [
        "products.read",
        "inventory.read",
        "inventory.write",
        "dashboard.read",
        "barcode.scan",
        "barcode.print",
        "barcode.labels",
        "barcode.generate",
    ]

    dept_admin = _mk_department(tenant, "admin", "Yönetici", admin_codes, perm_index)
    _mk_department(tenant, "sales", "Satış", sales_codes, perm_index)
    _mk_department(tenant, "warehouse", "Depo", warehouse_codes, perm_index)

    categories: dict[str, Category] = {}
    for name, slug in CATEGORIES:
        cat, _ = Category.objects.get_or_create(tenant=tenant, slug=slug, defaults={"name": name})
        categories[slug] = cat

    seed_ui_config_for_tenant(tenant.id)

    field_defs = _ensure_field_definitions(tenant)
    wh_main, _ = Warehouse.objects.get_or_create(
        tenant=tenant, code="DEPO", defaults={"name": "Ana depo", "description": "Arka depo"}
    )
    wh_shop, _ = Warehouse.objects.get_or_create(
        tenant=tenant, code="MAGAZA", defaults={"name": "Mağaza satış", "description": "Tezgah önü"}
    )
    loc_a, _ = Location.objects.get_or_create(
        tenant=tenant, warehouse=wh_main, code="RAF-A", defaults={"name": "Raf A"}
    )
    Location.objects.get_or_create(
        tenant=tenant, warehouse=wh_main, code="RAF-B", defaults={"name": "Raf B"}
    )
    Location.objects.get_or_create(
        tenant=tenant, warehouse=wh_shop, code="TEZGAH", defaults={"name": "Tezgah"}
    )
    Location.objects.get_or_create(
        tenant=tenant, warehouse=wh_shop, code="DUVAR", defaults={"name": "Duvar askılık"}
    )

    for sku, name, cat_slug, price, cost, barcode, brand, qty, reorder in PRODUCTS:
        product, _ = Product.objects.update_or_create(
            tenant=tenant,
            sku=sku,
            defaults={
                "name": name,
                "category": categories[cat_slug],
                "unit_price": Decimal(price),
                "cost_price": Decimal(cost),
                "barcode": barcode,
                "is_active": True,
            },
        )
        _set_dynamic_values(product, field_defs, brand=brand)
        shop_qty = max(1, qty // 4)
        depo_qty = qty - shop_qty
        Stock.objects.update_or_create(
            tenant=tenant,
            product=product,
            warehouse=wh_shop,
            location=None,
            defaults={"quantity": shop_qty, "reserved_quantity": 0, "reorder_level": max(1, reorder // 2)},
        )
        Stock.objects.update_or_create(
            tenant=tenant,
            product=product,
            warehouse=wh_main,
            location=loc_a,
            defaults={"quantity": depo_qty, "reserved_quantity": 0, "reorder_level": reorder},
        )

    _ensure_users(tenant, dept_admin)
    return tenant


def _ensure_field_definitions(tenant: Tenant) -> dict[str, ProductFieldDefinition]:
    specs: list[dict[str, Any]] = [
        {
            "key": "marka",
            "label": "Marka",
            "field_type": FieldType.TEXT.value,
            "is_required": True,
            "show_in_list": True,
            "form_order": 1,
        },
        {
            "key": "garanti_ay",
            "label": "Garanti (ay)",
            "field_type": FieldType.NUMBER.value,
            "default_value": 24,
            "show_in_list": True,
            "form_order": 2,
        },
        {
            "key": "vram_gb",
            "label": "VRAM (GB)",
            "field_type": FieldType.NUMBER.value,
            "show_in_form": True,
            "show_in_list": False,
            "form_order": 3,
        },
        {
            "key": "watt",
            "label": "Güç (W)",
            "field_type": FieldType.NUMBER.value,
            "show_in_form": True,
            "form_order": 4,
        },
    ]
    result = {}
    for spec in specs:
        key = spec.pop("key")
        label = spec.pop("label")
        ft = spec.pop("field_type")
        obj, _ = ProductFieldDefinition.objects.update_or_create(
            tenant=tenant,
            key=key,
            defaults={"label": label, "field_type": ft, **spec},
        )
        result[key] = obj
    return result


def _set_dynamic_values(product: Product, field_defs: dict[str, ProductFieldDefinition], *, brand: str) -> None:
    values: dict[str, Any] = {"marka": brand, "garanti_ay": 24}
    if product.sku.startswith("GPU-"):
        values["vram_gb"] = 8 if "4060" in product.sku else 12
    if product.sku.startswith("PSU-"):
        values["watt"] = 650 if "650" in product.sku else 750
    for key, raw in values.items():
        definition = field_defs.get(key)
        if not definition:
            continue
        storage = validate_field_value(definition, raw, product=product, tenant_id=product.tenant_id)
        ProductFieldValue.objects.update_or_create(
            tenant_id=product.tenant_id,
            product=product,
            field_definition=definition,
            defaults=storage,
        )


def _ensure_users(tenant: Tenant, dept_admin: Department) -> None:
    users = [
        (f"yonetici@{EMAIL_DOMAIN}", "Yönetici"),
        (f"satis@{EMAIL_DOMAIN}", "Satış"),
        (f"depo@{EMAIL_DOMAIN}", "Depo"),
    ]
    depts = {
        users[0][0]: dept_admin,
        users[1][0]: Department.objects.get(tenant=tenant, key="sales"),
        users[2][0]: Department.objects.get(tenant=tenant, key="warehouse"),
    }
    active_emails = {email for email, _ in users}
    for email, _label in users:
        u, _created = User.all_tenants.get_or_create(
            tenant=tenant,
            email=email,
            defaults={"department": depts[email], "is_active": True},
        )
        u.department = depts[email]
        u.is_active = True
        u.set_password(DEFAULT_PASSWORD)
        u.save()
    User.all_tenants.filter(tenant=tenant).exclude(email__in=active_emails).update(is_active=False)

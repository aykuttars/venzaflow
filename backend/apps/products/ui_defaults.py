"""Default UI configuration rows for new tenants."""

from apps.products.models import FieldSource

DEFAULT_LIST_COLUMNS = [
    ("sku", FieldSource.CORE, "SKU", True, True, True, 0),
    ("name", FieldSource.CORE, "Name", True, True, True, 1),
    ("category", FieldSource.CORE, "Category", True, False, True, 2),
    ("unit_price", FieldSource.CORE, "Price", True, True, False, 3),
    ("barcode", FieldSource.CORE, "Barcode", True, False, True, 4),
    ("is_active", FieldSource.CORE, "Active", True, False, True, 5),
    ("total_stock", FieldSource.COMPUTED, "Stock", True, False, False, 6),
]

DEFAULT_FORM_FIELDS = [
    ("sku", FieldSource.CORE, "SKU", "Genel Bilgiler", True, 0),
    ("name", FieldSource.CORE, "Name", "Genel Bilgiler", True, 1),
    ("category", FieldSource.CORE, "Category", "Genel Bilgiler", True, 2),
    ("barcode", FieldSource.CORE, "Barcode", "Genel Bilgiler", False, 3),
    ("unit_price", FieldSource.CORE, "Unit price", "Fiyat Bilgileri", True, 10),
    ("cost_price", FieldSource.CORE, "Cost price", "Fiyat Bilgileri", False, 11),
    ("is_active", FieldSource.CORE, "Active", "Genel Bilgiler", False, 4),
]

DEFAULT_DETAIL_FIELDS = [
    ("sku", FieldSource.CORE, "SKU", "Genel Bilgiler", 0),
    ("name", FieldSource.CORE, "Name", "Genel Bilgiler", 1),
    ("category", FieldSource.CORE, "Category", "Genel Bilgiler", 2),
    ("barcode", FieldSource.CORE, "Barcode", "Genel Bilgiler", 3),
    ("unit_price", FieldSource.CORE, "Unit price", "Fiyat Bilgileri", 10),
    ("cost_price", FieldSource.CORE, "Cost price", "Fiyat Bilgileri", 11),
    ("is_active", FieldSource.CORE, "Active", "Genel Bilgiler", 4),
    ("total_stock", FieldSource.COMPUTED, "Total stock", "Stok Bilgileri", 20),
    ("available_stock", FieldSource.COMPUTED, "Available stock", "Stok Bilgileri", 21),
]


def seed_ui_config_for_tenant(tenant_id: int) -> None:
    from apps.products.models import (
        ProductDetailConfig,
        ProductFormConfig,
        ProductListColumnConfig,
    )

    if ProductListColumnConfig.objects.filter(tenant_id=tenant_id).exists():
        return

    ProductListColumnConfig.objects.bulk_create(
        [
            ProductListColumnConfig(
                tenant_id=tenant_id,
                field_key=key,
                field_source=src.value if isinstance(src, FieldSource) else src,
                label=label,
                is_visible=vis,
                is_sortable=sort,
                is_filterable=filt,
                order=order,
            )
            for key, src, label, vis, sort, filt, order in DEFAULT_LIST_COLUMNS
        ]
    )
    ProductFormConfig.objects.bulk_create(
        [
            ProductFormConfig(
                tenant_id=tenant_id,
                field_key=key,
                field_source=src.value if isinstance(src, FieldSource) else src,
                label=label,
                section=section,
                is_required=req,
                order=order,
            )
            for key, src, label, section, req, order in DEFAULT_FORM_FIELDS
        ]
    )
    ProductDetailConfig.objects.bulk_create(
        [
            ProductDetailConfig(
                tenant_id=tenant_id,
                field_key=key,
                field_source=src.value if isinstance(src, FieldSource) else src,
                label=label,
                section=section,
                order=order,
            )
            for key, src, label, section, order in DEFAULT_DETAIL_FIELDS
        ]
    )

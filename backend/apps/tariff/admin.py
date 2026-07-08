from django.contrib import admin

from apps.tariff.models import DentalTariff, DentalTariffItem, TenantTariffItemPrice


class DentalTariffItemInline(admin.TabularInline):
    model = DentalTariffItem
    extra = 0
    fields = ("code", "name", "section_no", "price_incl_vat")
    readonly_fields = fields
    can_delete = False
    max_num = 20
    show_change_link = True


@admin.register(DentalTariff)
class DentalTariffAdmin(admin.ModelAdmin):
    list_display = ("year", "title", "is_active", "imported_at")
    list_filter = ("is_active",)
    search_fields = ("title",)
    inlines = [DentalTariffItemInline]


@admin.register(DentalTariffItem)
class DentalTariffItemAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "section_no", "section_name", "price_incl_vat", "tariff")
    list_filter = ("tariff", "section_no")
    search_fields = ("code", "name")


@admin.register(TenantTariffItemPrice)
class TenantTariffItemPriceAdmin(admin.ModelAdmin):
    list_display = ("tenant", "tariff_item", "clinic_price_incl_vat", "updated_at")
    list_filter = ("tenant",)
    search_fields = ("tariff_item__code", "tariff_item__name")

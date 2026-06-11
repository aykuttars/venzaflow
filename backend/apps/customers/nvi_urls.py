from django.urls import path

from apps.customers.nvi_views import (
    NviAddressBuildingsView,
    NviAddressDistrictsView,
    NviAddressNeighborhoodsView,
    NviAddressOpenAddressView,
    NviAddressProvincesView,
    NviAddressStreetsView,
    NviAddressUnitsView,
    NviAddressVerifyResidenceView,
    NviIdentityVerifyView,
)

urlpatterns = [
    path("address/provinces/", NviAddressProvincesView.as_view(), name="nvi-address-provinces"),
    path("address/districts/", NviAddressDistrictsView.as_view(), name="nvi-address-districts"),
    path(
        "address/neighborhoods/",
        NviAddressNeighborhoodsView.as_view(),
        name="nvi-address-neighborhoods",
    ),
    path("address/streets/", NviAddressStreetsView.as_view(), name="nvi-address-streets"),
    path("address/buildings/", NviAddressBuildingsView.as_view(), name="nvi-address-buildings"),
    path("address/units/", NviAddressUnitsView.as_view(), name="nvi-address-units"),
    path("address/open/", NviAddressOpenAddressView.as_view(), name="nvi-address-open"),
    path(
        "address/verify-residence/",
        NviAddressVerifyResidenceView.as_view(),
        name="nvi-address-verify-residence",
    ),
    path("identity/verify/", NviIdentityVerifyView.as_view(), name="nvi-identity-verify"),
]

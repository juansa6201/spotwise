from django.urls import path

from .views import GeocodeView, RubroListView, ValidarUbicacionView

urlpatterns = [
    path("rubros/", RubroListView.as_view(), name="rubros"),
    path("validar-ubicacion/", ValidarUbicacionView.as_view(), name="validar-ubicacion"),
    path("geocode/", GeocodeView.as_view(), name="geocode"),
]

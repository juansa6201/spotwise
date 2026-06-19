from django.urls import path

from .views import AnalizarView, GuardadoDetailView, GuardadosView

urlpatterns = [
    path("analizar/", AnalizarView.as_view(), name="analizar"),
    path("guardados/", GuardadosView.as_view(), name="guardados"),
    path("guardados/<uuid:pk>/", GuardadoDetailView.as_view(), name="guardado-detail"),
]

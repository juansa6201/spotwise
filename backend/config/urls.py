"""Ruteo principal de la API de SpotWise."""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path


def health(_request):
    """Endpoint de verificación de estado del servicio."""
    return JsonResponse({"status": "ok", "service": "spotwise-api", "version": "0.1.0"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    # Las rutas de cada módulo se irán incorporando por fase:
    # path("api/auth/", include("apps.users.urls")),       # Fase 1
    # path("api/catalog/", include("apps.catalog.urls")),  # Fase 1
    # path("api/analysis/", include("apps.analysis.urls")),# Fase 3
]

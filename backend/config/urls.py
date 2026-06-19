"""Ruteo principal de la API de SpotWise."""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    """Endpoint de verificación de estado del servicio."""
    return JsonResponse({"status": "ok", "service": "spotwise-api", "version": "0.1.0"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("apps.users.urls")),        # HU-001, HU-002
    path("api/catalog/", include("apps.catalog.urls")),   # HU-003
    path("api/analysis/", include("apps.analysis.urls")),  # HU-006/007/008
]

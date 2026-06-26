"""Servicios geográficos del catálogo: validación de ubicación."""
from django.conf import settings

# Bounding box aproximado de la ciudad de Córdoba (lat_min, lat_max, lng_min, lng_max).
_BBOX_DEFAULT = (-31.55, -31.30, -64.36, -64.04)


def _bbox():
    return getattr(settings, "CORDOBA_BBOX", _BBOX_DEFAULT)


def esta_en_cordoba(lat, lng):
    """Indica si una coordenada cae dentro del área definida para la ciudad de Córdoba."""
    lat_min, lat_max, lng_min, lng_max = _bbox()
    return (lat_min <= lat <= lat_max) and (lng_min <= lng <= lng_max)

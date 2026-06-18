"""Servicios geográficos del catálogo: validación de ubicación y geocodificación."""
import requests
from django.conf import settings

# Bounding box aproximado de la ciudad de Córdoba (lat_min, lat_max, lng_min, lng_max).
_BBOX_DEFAULT = (-31.55, -31.30, -64.36, -64.04)


def _bbox():
    return getattr(settings, "CORDOBA_BBOX", _BBOX_DEFAULT)


def esta_en_cordoba(lat, lng):
    """Indica si una coordenada cae dentro del área definida para la ciudad de Córdoba."""
    lat_min, lat_max, lng_min, lng_max = _bbox()
    return (lat_min <= lat <= lat_max) and (lng_min <= lng <= lng_max)


def geocodificar(query):
    """
    Geocodifica una dirección con Nominatim (OpenStreetMap), acotando la búsqueda
    a la ciudad de Córdoba. Devuelve una lista de coincidencias {nombre, lat, lng}.
    """
    lat_min, lat_max, lng_min, lng_max = _bbox()
    params = {
        "q": query,
        "format": "json",
        "limit": 5,
        "addressdetails": 1,
        "countrycodes": "ar",
        # viewbox: left(lng_min), top(lat_max), right(lng_max), bottom(lat_min)
        "viewbox": f"{lng_min},{lat_max},{lng_max},{lat_min}",
        "bounded": 1,
    }
    headers = {"User-Agent": "SpotWise/0.1 (TFG UES21)"}
    resp = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params=params, headers=headers, timeout=8,
    )
    resp.raise_for_status()
    return [
        {
            "nombre": item.get("display_name"),
            "lat": float(item["lat"]),
            "lng": float(item["lon"]),
        }
        for item in resp.json()
    ]

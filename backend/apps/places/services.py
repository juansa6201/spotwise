"""
Servicio de Google Places (Nearby Search) con caché para controlar el costo de la API.
"""
import time
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from apps.places.models import CacheGooglePlaces

NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
CACHE_TTL_DIAS = 30
CELDA_DECIMALES = 3   # ~110 m: precisión de la celda de caché
MAX_PAGINAS = 3       # hasta 60 resultados por consulta (20 por página, tope de Google)


class PlacesError(RuntimeError):
    """Error al consultar Google Places (red, cuota, configuración, etc.)."""


def _celda(lat, lng):
    return round(lat, CELDA_DECIMALES), round(lng, CELDA_DECIMALES)


def _nearby(lat, lng, radius, place_type=None):
    """Nearby Search con paginación (hasta MAX_PAGINAS páginas)."""
    key = settings.GOOGLE_PLACES_API_KEY
    if not key:
        raise PlacesError("GOOGLE_PLACES_API_KEY no está configurada en el servidor.")

    resultados = []
    params = {"location": f"{lat},{lng}", "radius": radius, "key": key}
    if place_type:
        params["type"] = place_type

    for pagina in range(MAX_PAGINAS):
        try:
            resp = requests.get(NEARBY_URL, params=params, timeout=12)
            data = resp.json()
        except (requests.RequestException, ValueError) as exc:
            raise PlacesError(f"Error de red consultando Google Places: {exc}")

        estado = data.get("status")
        if estado == "ZERO_RESULTS":
            break
        if estado != "OK":
            msg = data.get("error_message", "")
            raise PlacesError(f"Google Places devolvió '{estado}'. {msg}".strip())

        for p in data.get("results", []):
            loc = p.get("geometry", {}).get("location", {})
            if loc.get("lat") is None:
                continue
            resultados.append({
                "nombre": p.get("name", ""),
                "lat": loc["lat"],
                "lng": loc["lng"],
                "tipos": p.get("types", []),
            })

        token = data.get("next_page_token")
        if not token or pagina >= MAX_PAGINAS - 1:
            break
        time.sleep(2)  # el next_page_token tarda ~2 s en activarse
        params = {"pagetoken": token, "key": key}

    return resultados


def analizar_zona(lat, lng, rubro, radius=None):
    """
    Devuelve la cantidad de competidores (mismo rubro), de comercios totales y la
    lista de lugares (con flag de competidor) para una ubicación. Usa caché por
    celda + rubro para no repetir llamadas a la API.
    """
    radius = radius or settings.ANALISIS_RADIO_METROS
    clat, clng = _celda(lat, lng)
    ahora = timezone.now()

    cache = CacheGooglePlaces.objects.filter(
        lat_celda=clat, lng_celda=clng, rubro=rubro, expira_at__gt=ahora,
    ).first()
    if cache:
        return {
            "cantidad_mismo_rubro": cache.cantidad_mismo_rubro,
            "cantidad_total_comercios": cache.cantidad_total_comercios,
            "lugares": cache.resultados,
            "cacheado": True,
        }

    competidores = (
        _nearby(lat, lng, radius, place_type=rubro.google_place_type)
        if rubro.google_place_type else []
    )
    comercios = _nearby(lat, lng, radius, place_type="establishment")

    # Unir ambas listas marcando los competidores (para el mapa analítico).
    por_clave = {}
    for c in comercios:
        por_clave[(c["nombre"], round(c["lat"], 6), round(c["lng"], 6))] = {**c, "competidor": False}
    for c in competidores:
        clave = (c["nombre"], round(c["lat"], 6), round(c["lng"], 6))
        por_clave[clave] = {**c, "competidor": True}
    lugares = list(por_clave.values())

    CacheGooglePlaces.objects.update_or_create(
        lat_celda=clat, lng_celda=clng, rubro=rubro,
        defaults={
            "cantidad_mismo_rubro": len(competidores),
            "cantidad_total_comercios": len(comercios),
            "resultados": lugares,
            "expira_at": ahora + timedelta(days=CACHE_TTL_DIAS),
        },
    )
    return {
        "cantidad_mismo_rubro": len(competidores),
        "cantidad_total_comercios": len(comercios),
        "lugares": lugares,
        "cacheado": False,
    }

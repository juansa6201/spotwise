"""
Motor de cálculo del score de viabilidad comercial (HU-006, HU-007).

Combina tres indicadores (0-100) en un score ponderado:
  - Poblacional / socioeconómico: nivel del barrio (IPS) + densidad poblacional.
  - Actividad económica: cantidad de comercios cercanos (Google Places).
  - Competencia: saturación de comercios del mismo rubro (inverso: menos = mejor).

Los pesos y los topes de normalización son PARÁMETROS CALIBRABLES.
"""
from django.conf import settings
from django.contrib.gis.geos import Point

from apps.catalog.models import Barrio
from apps.places.services import analizar_zona

# --- Pesos del score (suman 1.0) ---
PESO_POBLACIONAL = 0.35
PESO_ACTIVIDAD = 0.30
PESO_COMPETENCIA = 0.35

# --- Topes de normalización (calibrables con datos reales) ---
CAP_COMPETIDORES = 15      # 15+ competidores en el radio -> saturación máxima
CAP_COMERCIOS = 40         # 40+ comercios -> actividad máxima
CAP_DENSIDAD = 15000.0     # hab/km² de referencia para densidad máxima

# --- Cortes de decisión ---
UMBRAL_ALTA = 70
UMBRAL_MEDIA = 40


def _clamp(v, lo=0.0, hi=100.0):
    return max(lo, min(hi, v))


def _decision(score):
    if score >= UMBRAL_ALTA:
        return "ALTA"
    if score >= UMBRAL_MEDIA:
        return "MEDIA"
    return "BAJA"


def calcular(lat, lng, rubro):
    # 1. Barrio que contiene el punto (point-in-polygon en PostGIS).
    barrio = Barrio.objects.filter(poligono__contains=Point(lng, lat, srid=4326)).first()

    # 2. Indicador poblacional / socioeconómico (IPS + densidad).
    s_socio = (barrio.ips - 1) / 4 * 100 if (barrio and barrio.ips) else None
    s_dens = (
        _clamp(barrio.densidad_hab_km2 / CAP_DENSIDAD * 100)
        if (barrio and barrio.densidad_hab_km2) else None
    )
    if s_socio is not None and s_dens is not None:
        ind_poblacional = round(0.6 * s_socio + 0.4 * s_dens, 1)
    elif s_socio is not None:
        ind_poblacional = round(s_socio, 1)
    else:
        ind_poblacional = None

    # 3. Indicadores comerciales (Google Places).
    zona = analizar_zona(lat, lng, rubro)
    n_comp = zona["cantidad_mismo_rubro"]
    n_com = zona["cantidad_total_comercios"]
    ind_competencia = round(_clamp(100 * (1 - min(n_comp, CAP_COMPETIDORES) / CAP_COMPETIDORES)), 1)
    ind_actividad = round(_clamp(100 * min(n_com, CAP_COMERCIOS) / CAP_COMERCIOS), 1)

    # 4. Score ponderado (si el punto cae fuera de un barrio, poblacional = 50 neutral).
    pob = ind_poblacional if ind_poblacional is not None else 50.0
    score = round(
        PESO_POBLACIONAL * pob
        + PESO_ACTIVIDAD * ind_actividad
        + PESO_COMPETENCIA * ind_competencia,
        1,
    )

    return {
        "score": score,
        "decision": _decision(score),
        "radio_m": settings.ANALISIS_RADIO_METROS,
        "fuera_de_cordoba": barrio is None,
        "indicadores": {
            "poblacional": ind_poblacional,
            "actividad_economica": ind_actividad,
            "competencia": ind_competencia,
        },
        "barrio": None if barrio is None else {
            "nombre": barrio.nombre,
            "semaforo": barrio.semaforo,
            "ips": barrio.ips,
            "indice_socioeconomico": barrio.indice_socioeconomico,
            "densidad_hab_km2": barrio.densidad_hab_km2,
            "cantidad_habitantes": barrio.cantidad_habitantes,
        },
        "competencia": {
            "competidores_directos": n_comp,
            "comercios_totales": n_com,
        },
        "lugares": zona["lugares"],
        "cacheado": zona["cacheado"],
    }

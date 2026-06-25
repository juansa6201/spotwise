"""
ETL: importa y normaliza los barrios de la ciudad de Córdoba desde el KML del
Índice de Prioridad Social (IPS). El KML mezcla DOS esquemas de nombres de campo
(truncados estilo shapefile y nombres completos); este comando los unifica.

Uso:
    python manage.py importar_barrios [--kml <ruta>]
"""
import os
import re
import xml.etree.ElementTree as ET

from django.conf import settings
from django.contrib.gis.geos import LinearRing, MultiPolygon, Polygon
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.catalog.models import Barrio
from apps.catalog.views import BARRIOS_CACHE_KEY


def _local(tag):
    return tag.split("}")[-1]


def _iter_local(elem, name):
    return [e for e in elem.iter() if _local(e.tag) == name]


# Unificación de los dos esquemas de campos del KML.
FIELD_ALIASES = {
    "barrio": ["BARRIO"],
    "semaforo": ["SEMAFORO"],
    "ips": ["INDIC_IPS", "RESUMEN ÍNDICE DE PRIORIDAD SOCIAL (IPS)"],
    "poblacion": ["TOT_POBLAC", "TOTAL POBLACIÓN"],
    "hogares": ["TOT_HOGAR", "TOTAL HOGAR"],
    "nbi": ["NBI", "NECESIDADES BÁSICAS INSATISFECHAS (NBI)",
            " NECESIDADES BÁSICAS INSATISFECHAS (NBI)"],
    "ind_nbi": ["INDICADOR_", "INDICADOR NBI"],
    "ind_educacion": ["INDICADO_1", "INDICADOR EDUCACIÓN"],
    "ind_desempleo": ["INDICADO_2", "INDICADOR DESEMPLEO"],
    "ind_ninini": ["INDICADO_3", "INDICADOR NI-NI-NI"],
    "superficie_ha": ["SUP_HA"],
    "seccional": ["SECCIONAL"],
}

SEMAFORO_LABEL = {"ROJO": "Bajo", "AMARILLO": "Medio", "VERDE": "Alto"}


def _data_dict(placemark):
    out = {}
    for data in _iter_local(placemark, "Data"):
        name = data.get("name")
        value = next((( v.text or "").strip() for v in data if _local(v.tag) == "value"), "")
        if name is not None:
            out[name] = value
    return out


def _first(d, keys):
    for k in keys:
        if d.get(k):
            return d[k]
    return None


def _to_int(value):
    if not value:
        return None
    cleaned = re.sub(r"[^\d]", "", value)  # quita separadores de miles y texto
    return int(cleaned) if cleaned else None


def _to_float(value):
    if not value:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", value.replace(",", "."))
    return float(m.group()) if m else None


def _parse_coords(text):
    pts = []
    for tok in (text or "").split():
        parts = tok.split(",")
        if len(parts) >= 2:
            try:
                pts.append((float(parts[0]), float(parts[1])))
            except ValueError:
                continue
    return pts


def _ring(coords_elem):
    pts = _parse_coords(coords_elem.text)
    if len(pts) < 3:
        return None
    if pts[0] != pts[-1]:
        pts.append(pts[0])  # cerrar el anillo
    return LinearRing(pts, srid=4326)


def _build_multipolygon(placemark):
    polygons = []
    for poly_el in _iter_local(placemark, "Polygon"):
        shell, holes = None, []
        for boundary in poly_el:
            btag = _local(boundary.tag)
            if btag == "outerBoundaryIs":
                for c in _iter_local(boundary, "coordinates"):
                    shell = _ring(c)
            elif btag == "innerBoundaryIs":
                for c in _iter_local(boundary, "coordinates"):
                    r = _ring(c)
                    if r is not None:
                        holes.append(r)
        if shell is not None:
            polygons.append(Polygon(shell, *holes, srid=4326))
    if not polygons:
        return None
    return MultiPolygon(*polygons, srid=4326)


class Command(BaseCommand):
    help = "Importa y normaliza los barrios de Córdoba desde el KML del IPS."

    def add_arguments(self, parser):
        default_path = os.path.join(
            settings.BASE_DIR, "data", "IPS_-_BARRIOS_DE_LA_CIUDAD_DE_CORDOBA.kml"
        )
        parser.add_argument("--kml", default=default_path, help="Ruta al archivo KML.")

    @transaction.atomic
    def handle(self, *args, **opts):
        path = opts["kml"]
        if not os.path.exists(path):
            raise CommandError(f"No se encontró el KML en: {path}")

        root = ET.parse(path).getroot()
        placemarks = _iter_local(root, "Placemark")
        self.stdout.write(f"Placemarks en el KML: {len(placemarks)}")

        creados = actualizados = sin_geom = 0
        for pm in placemarks:
            data = _data_dict(pm)

            nombre = _first(data, FIELD_ALIASES["barrio"])
            if not nombre:
                raw = next((c.text for c in pm if _local(c.tag) == "name"), "") or ""
                nombre = re.sub(r"^\d+\s*-\s*", "", raw)
            nombre = (nombre or "").strip()
            if not nombre:
                continue

            geom = _build_multipolygon(pm)
            if geom is None:
                sin_geom += 1

            semaforo = (_first(data, FIELD_ALIASES["semaforo"]) or "").upper()
            ips = _to_int(_first(data, FIELD_ALIASES["ips"]))
            poblacion = _to_int(_first(data, FIELD_ALIASES["poblacion"]))
            superficie_ha = _to_float(_first(data, FIELD_ALIASES["superficie_ha"]))

            densidad = None
            if poblacion and superficie_ha:
                densidad = round(poblacion / (superficie_ha / 100.0), 1)  # hab/km²

            _, created = Barrio.objects.update_or_create(
                nombre=nombre,
                defaults={
                    "seccional": (_first(data, FIELD_ALIASES["seccional"]) or "").strip(),
                    "semaforo": semaforo if semaforo in SEMAFORO_LABEL else "",
                    "ips": ips,
                    "indice_socioeconomico": SEMAFORO_LABEL.get(semaforo, ""),
                    "indice_socioeconomico_num": round((ips - 1) / 4 * 100, 1) if ips else None,
                    "cantidad_habitantes": poblacion,
                    "total_hogares": _to_int(_first(data, FIELD_ALIASES["hogares"])),
                    "nbi": _to_int(_first(data, FIELD_ALIASES["nbi"])),
                    "superficie_ha": superficie_ha,
                    "densidad_hab_km2": densidad,
                    "ind_nbi": _to_int(_first(data, FIELD_ALIASES["ind_nbi"])),
                    "ind_educacion": _to_int(_first(data, FIELD_ALIASES["ind_educacion"])),
                    "ind_desempleo": _to_int(_first(data, FIELD_ALIASES["ind_desempleo"])),
                    "ind_ninini": _to_int(_first(data, FIELD_ALIASES["ind_ninini"])),
                    "poligono": geom,
                },
            )
            if created:
                creados += 1
            else:
                actualizados += 1

        # Los barrios cambiaron: descarta el GeoJSON cacheado para no servir
        # datos viejos hasta que venza el TTL.
        cache.delete(BARRIOS_CACHE_KEY)

        total = Barrio.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f"Importación finalizada. Creados: {creados} | Actualizados: {actualizados} | "
            f"Sin geometría: {sin_geom} | Total en la base: {total}"
        ))

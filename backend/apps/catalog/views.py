import json

from django.contrib.gis.geos import Point
from django.core.cache import cache
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Barrio, Rubro
from .serializers import BarrioResumenSerializer, RubroSerializer
from .services import esta_en_cordoba

# Tolerancia de simplificación de los polígonos (en grados, ~11 m). Reduce el
# tamaño del payload sin alterar de forma visible la delimitación en el mapa.
SIMPLIFY_TOLERANCIA = 0.0001

# Cache del GeoJSON de barrios: cambian rarísimo, así que se sirve desde memoria
# y se deja cachear en el navegador para que la próxima carga sea instantánea.
# El comando importar_barrios invalida esta clave al recargar los datos.
BARRIOS_CACHE_KEY = "barrios_geojson_v1"
BARRIOS_CACHE_TTL = 60 * 60 * 24  # 1 día


class RubroListView(generics.ListAPIView):
    """Lista de rubros disponibles para el análisis (alimenta el selector del frontend)."""

    queryset = Rubro.objects.all()
    serializer_class = RubroSerializer
    permission_classes = [permissions.AllowAny]


class BarriosGeoJSONView(APIView):
    """
    Devuelve los barrios de Córdoba como GeoJSON FeatureCollection para dibujar
    su delimitación en el mapa, con el nivel socioeconómico en las propiedades.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = cache.get(BARRIOS_CACHE_KEY)
        if data is None:
            data = self._construir_geojson()
            cache.set(BARRIOS_CACHE_KEY, data, BARRIOS_CACHE_TTL)
        response = Response(data)
        # Que el navegador también lo cachee: la próxima carga no pega al backend.
        response["Cache-Control"] = f"public, max-age={BARRIOS_CACHE_TTL}"
        return response

    @staticmethod
    def _construir_geojson():
        barrios = (
            Barrio.objects
            .exclude(poligono__isnull=True)
            .only("id", "nombre", "semaforo", "indice_socioeconomico", "ips", "poligono")
        )
        features = []
        for b in barrios:
            geom = b.poligono.simplify(SIMPLIFY_TOLERANCIA, preserve_topology=True)
            features.append({
                "type": "Feature",
                "geometry": json.loads(geom.geojson),
                "properties": {
                    "id": str(b.id),
                    "nombre": b.nombre,
                    "semaforo": b.semaforo,
                    "indice_socioeconomico": b.indice_socioeconomico,
                    "ips": b.ips,
                },
            })
        return {"type": "FeatureCollection", "features": features}


class ValidarUbicacionView(APIView):
    """HU-003: valida que una coordenada pertenezca a la ciudad de Córdoba."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            lat = float(request.data.get("lat"))
            lng = float(request.data.get("lng"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Debe indicar coordenadas válidas (lat, lng)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dentro = esta_en_cordoba(lat, lng)
        barrio = Barrio.objects.filter(
            poligono__contains=Point(lng, lat, srid=4326)
        ).first()
        return Response({
            "lat": lat,
            "lng": lng,
            "dentro_de_cordoba": dentro,
            "barrio": BarrioResumenSerializer(barrio).data if barrio else None,
            "mensaje": (
                "Ubicación válida dentro de la ciudad de Córdoba."
                if dentro
                else "La ubicación seleccionada está fuera del alcance "
                     "(ciudad de Córdoba)."
            ),
        })

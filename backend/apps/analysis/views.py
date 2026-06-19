from django.contrib.gis.geos import Point
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Barrio, Rubro
from apps.places.services import PlacesError

from . import scoring
from .models import AnalisisGuardado, Indicador
from .serializers import AnalisisGuardadoSerializer

# Mapea las claves del dict de scoring a los tipos del modelo Indicador.
TIPO_POR_CLAVE = {
    "poblacional": Indicador.Tipo.POBLACIONAL,
    "actividad_economica": Indicador.Tipo.ACTIVIDAD,
    "competencia": Indicador.Tipo.COMPETENCIA,
}


def _coordenadas(request):
    """Extrae (lat, lng) del request o devuelve None si son inválidas."""
    try:
        return float(request.data.get("lat")), float(request.data.get("lng"))
    except (TypeError, ValueError):
        return None


def _rubro(request):
    """Resuelve el rubro del request; None si falta o el id no es un UUID válido."""
    try:
        return Rubro.objects.filter(id=request.data.get("rubro_id")).first()
    except (DjangoValidationError, ValueError, TypeError):
        return None


class AnalizarView(APIView):
    """HU-006/007/008: calcula el score de viabilidad de una ubicación + rubro."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        coords = _coordenadas(request)
        if coords is None:
            return Response(
                {"detail": "Debe indicar coordenadas válidas (lat, lng)."}, status=400
            )
        lat, lng = coords

        rubro = _rubro(request)
        if rubro is None:
            return Response({"detail": "Debe seleccionar un rubro válido."}, status=400)

        try:
            resultado = scoring.calcular(lat, lng, rubro)
        except PlacesError as exc:
            return Response(
                {"detail": f"No se pudieron obtener los datos comerciales: {exc}"},
                status=502,
            )

        resultado["rubro"] = {"id": str(rubro.id), "nombre": rubro.nombre}
        resultado["lat"] = lat
        resultado["lng"] = lng
        return Response(resultado)


class GuardadosView(generics.ListCreateAPIView):
    """HU-009: guarda un análisis y lista los del usuario autenticado."""

    serializer_class = AnalisisGuardadoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            AnalisisGuardado.objects
            .filter(usuario=self.request.user)
            .select_related("rubro", "barrio")
            .prefetch_related("indicadores")
        )

    def create(self, request, *args, **kwargs):
        coords = _coordenadas(request)
        if coords is None:
            return Response(
                {"detail": "Debe indicar coordenadas válidas (lat, lng)."}, status=400
            )
        lat, lng = coords

        rubro = _rubro(request)
        if rubro is None:
            return Response({"detail": "Debe seleccionar un rubro válido."}, status=400)

        # Recalcula el score en el servidor: evita confiar en el cliente y
        # resuelve el barrio (point-in-polygon) para asociarlo como FK.
        try:
            resultado = scoring.calcular(lat, lng, rubro)
        except PlacesError as exc:
            return Response(
                {"detail": f"No se pudieron obtener los datos comerciales: {exc}"},
                status=502,
            )

        barrio = Barrio.objects.filter(
            poligono__contains=Point(lng, lat, srid=4326)
        ).first()

        with transaction.atomic():
            analisis = AnalisisGuardado.objects.create(
                usuario=request.user,
                rubro=rubro,
                barrio=barrio,
                nombre_referencia=(request.data.get("nombre_referencia") or "").strip()[:200],
                notas=(request.data.get("notas") or "").strip(),
                favorito=bool(request.data.get("favorito", False)),
                latitud=lat,
                longitud=lng,
                score=resultado["score"],
                decision=resultado["decision"],
            )
            Indicador.objects.bulk_create([
                Indicador(analisis=analisis, tipo=TIPO_POR_CLAVE[clave], score=valor)
                for clave, valor in resultado["indicadores"].items()
                if valor is not None
            ])

        serializer = self.get_serializer(analisis)
        return Response(serializer.data, status=201)


class GuardadoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """HU-010: consulta, edita (favorito/notas/nombre) o borra un análisis propio."""

    serializer_class = AnalisisGuardadoSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "delete"]

    def get_queryset(self):
        return (
            AnalisisGuardado.objects
            .filter(usuario=self.request.user)
            .select_related("rubro", "barrio")
            .prefetch_related("indicadores")
        )

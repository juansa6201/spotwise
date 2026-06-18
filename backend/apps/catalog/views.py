from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Rubro
from .serializers import RubroSerializer
from .services import esta_en_cordoba, geocodificar


class RubroListView(generics.ListAPIView):
    """Lista de rubros disponibles para el análisis (alimenta el selector del frontend)."""

    queryset = Rubro.objects.all()
    serializer_class = RubroSerializer
    permission_classes = [permissions.AllowAny]


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
        return Response({
            "lat": lat,
            "lng": lng,
            "dentro_de_cordoba": dentro,
            "mensaje": (
                "Ubicación válida dentro de la ciudad de Córdoba."
                if dentro
                else "La ubicación seleccionada está fuera del alcance del prototipo "
                     "(ciudad de Córdoba)."
            ),
        })


class GeocodeView(APIView):
    """Busca una dirección dentro de Córdoba y devuelve coordenadas (proxy a Nominatim)."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 3:
            return Response({"resultados": []})
        try:
            resultados = geocodificar(q)
        except Exception:
            return Response(
                {"detail": "No se pudo completar la búsqueda de la dirección en este momento."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"resultados": resultados})

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Rubro
from apps.places.services import PlacesError

from . import scoring


class AnalizarView(APIView):
    """HU-006/007/008: calcula el score de viabilidad de una ubicación + rubro."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            lat = float(request.data.get("lat"))
            lng = float(request.data.get("lng"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Debe indicar coordenadas válidas (lat, lng)."}, status=400
            )

        rubro = Rubro.objects.filter(id=request.data.get("rubro_id")).first()
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

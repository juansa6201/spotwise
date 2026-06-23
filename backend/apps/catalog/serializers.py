from rest_framework import serializers

from .models import Barrio, Rubro


class RubroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rubro
        fields = ["id", "nombre", "google_place_type", "descripcion"]


class BarrioResumenSerializer(serializers.ModelSerializer):
    """Datos del barrio para la mini-ventana al marcar una ubicación (sin geometría)."""

    semaforo_display = serializers.CharField(source="get_semaforo_display", read_only=True)

    class Meta:
        model = Barrio
        fields = [
            "id", "nombre", "seccional",
            "semaforo", "semaforo_display", "ips",
            "indice_socioeconomico", "indice_socioeconomico_num",
            "cantidad_habitantes", "total_hogares", "nbi",
            "superficie_ha", "densidad_hab_km2",
        ]

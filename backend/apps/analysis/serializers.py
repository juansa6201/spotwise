from rest_framework import serializers

from .models import AnalisisGuardado, Indicador


class IndicadorSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Indicador
        fields = ["tipo", "tipo_display", "score"]


class AnalisisGuardadoSerializer(serializers.ModelSerializer):
    """
    Salida de un análisis guardado y, en PATCH, edición de los campos que el
    usuario controla (nombre de referencia, notas, favorito). El score, la
    decisión, el rubro y el barrio se fijan al guardar y son de solo lectura.
    """

    rubro_id = serializers.CharField(source="rubro.id", default=None, read_only=True)
    rubro_nombre = serializers.CharField(source="rubro.nombre", default=None, read_only=True)
    barrio_nombre = serializers.CharField(source="barrio.nombre", default=None, read_only=True)
    decision_display = serializers.CharField(source="get_decision_display", read_only=True)
    indicadores = IndicadorSerializer(many=True, read_only=True)

    class Meta:
        model = AnalisisGuardado
        fields = [
            "id", "nombre_referencia", "notas", "favorito",
            "latitud", "longitud", "score", "decision", "decision_display",
            "rubro_id", "rubro_nombre", "barrio_nombre",
            "indicadores", "guardado_at",
        ]
        read_only_fields = [
            "id", "latitud", "longitud", "score", "decision", "guardado_at",
        ]

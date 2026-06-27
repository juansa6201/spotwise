import uuid

from django.conf import settings
from django.db import models

from apps.catalog.models import Barrio, Rubro


class AnalisisGuardado(models.Model):
    """
    Análisis de viabilidad guardado por un usuario, asociado a una ubicación
    (lat/lng), un rubro y el barrio donde cae. Almacena el score final y la
    decisión interpretada (ALTA / MEDIA / BAJA viabilidad).
    """

    class Decision(models.TextChoices):
        ALTA = "ALTA", "Alta viabilidad"
        MEDIA = "MEDIA", "Viabilidad media"
        BAJA = "BAJA", "Baja viabilidad"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="analisis",
    )
    rubro = models.ForeignKey(
        Rubro, on_delete=models.SET_NULL, null=True, related_name="analisis",
    )
    barrio = models.ForeignKey(
        Barrio, on_delete=models.SET_NULL, null=True, blank=True, related_name="analisis",
    )

    nombre_referencia = models.CharField("nombre de referencia", max_length=200, blank=True)
    notas = models.TextField(blank=True)
    favorito = models.BooleanField(default=False)

    latitud = models.FloatField()
    longitud = models.FloatField()
    direccion = models.CharField("dirección (calle y número)", max_length=255, blank=True)

    score = models.FloatField("score de viabilidad (0–100)")
    decision = models.CharField(max_length=10, choices=Decision.choices, blank=True)

    # Snapshot de los competidores directos del análisis (nombre, lat, lng,
    # rating, reseñas), para dibujarlos en el mapa del detalle sin re-consultar
    # Google Places.
    competidores = models.JSONField("competidores directos", default=list, blank=True)

    guardado_at = models.DateTimeField("guardado", auto_now_add=True)

    class Meta:
        db_table = "analisis_guardados"
        verbose_name = "análisis guardado"
        verbose_name_plural = "análisis guardados"
        ordering = ["-guardado_at"]

    def __str__(self):
        return self.nombre_referencia or f"Análisis {self.id}"


class Indicador(models.Model):
    """
    Indicador parcial que compone el score de un análisis. Cada análisis tiene
    a lo sumo un indicador de cada tipo (poblacional, actividad económica,
    competencia), tal como en el diagrama de clases.
    """

    class Tipo(models.TextChoices):
        POBLACIONAL = "poblacional", "Poblacional"
        ACTIVIDAD = "actividad_economica", "Actividad económica"
        COMPETENCIA = "competencia", "Competencia"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    analisis = models.ForeignKey(
        AnalisisGuardado, on_delete=models.CASCADE, related_name="indicadores",
    )
    tipo = models.CharField(max_length=30, choices=Tipo.choices)
    score = models.FloatField("score del indicador (0–100)")

    class Meta:
        db_table = "indicadores"
        verbose_name = "indicador"
        verbose_name_plural = "indicadores"
        constraints = [
            models.UniqueConstraint(fields=["analisis", "tipo"], name="unique_indicador_por_tipo"),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()}: {self.score}"

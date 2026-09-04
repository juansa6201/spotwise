import uuid

from django.db import models

from apps.catalog.models import Rubro


class CacheGooglePlaces(models.Model):
    """
    Caché de consultas a Google Places para controlar costos de la API.
    Cada entrada representa el resultado para una celda geográfica (lat/lng
    redondeadas) y un rubro, con una fecha de expiración.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rubro = models.ForeignKey(
        Rubro, on_delete=models.CASCADE, related_name="cache_entries",
        null=True, blank=True,
    )
    lat_celda = models.FloatField("latitud de celda")
    lng_celda = models.FloatField("longitud de celda")
    cantidad_mismo_rubro = models.IntegerField("cantidad del mismo rubro", default=0)
    cantidad_total_comercios = models.IntegerField("cantidad total de comercios", default=0)
    resultados = models.JSONField("lugares (caché para el mapa)", default=list, blank=True)
    consultado_at = models.DateTimeField("consultado", auto_now_add=True)
    expira_at = models.DateTimeField("expira")

    class Meta:
        db_table = "cache_google_places"
        verbose_name = "caché de Google Places"
        verbose_name_plural = "caché de Google Places"
        indexes = [
            models.Index(fields=["lat_celda", "lng_celda", "rubro"]),
        ]

    def __str__(self):
        return f"Caché ({self.lat_celda}, {self.lng_celda})"

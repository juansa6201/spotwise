import uuid

from django.contrib.gis.db import models as gis_models
from django.db import models


class Rubro(models.Model):
    """
    Rubro o categoría comercial a analizar (p. ej. "Restaurante", "Farmacia").
    `google_place_type` mapea el rubro con el tipo de lugar de Google Places
    para poder contar competidores directos.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=120, unique=True)
    google_place_type = models.CharField(
        "tipo de Google Places", max_length=80, blank=True,
        help_text="Ej.: restaurant, pharmacy, cafe. Ver tipos de Google Places.",
    )
    descripcion = models.TextField("descripción", blank=True)

    class Meta:
        db_table = "rubros"
        verbose_name = "rubro"
        verbose_name_plural = "rubros"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Barrio(models.Model):
    """
    Barrio de la ciudad de Córdoba con sus indicadores demográficos
    (provenientes de datos abiertos normalizados vía ETL) y su geometría PostGIS.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=150)
    indice_socioeconomico = models.CharField(
        "índice socioeconómico (categoría)", max_length=40, blank=True,
        help_text="Categoría textual, p. ej. 'Medio-Alto'.",
    )
    indice_socioeconomico_num = models.FloatField(
        "índice socioeconómico (valor)", null=True, blank=True,
        help_text="Valor numérico normalizado (0–1 o 0–100).",
    )
    cantidad_habitantes = models.IntegerField("cantidad de habitantes", null=True, blank=True)
    poligono = gis_models.MultiPolygonField("polígono", srid=4326, null=True, blank=True)

    class Meta:
        db_table = "barrios"
        verbose_name = "barrio"
        verbose_name_plural = "barrios"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

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
    Barrio de la ciudad de Córdoba con sus indicadores demográficos y
    socioeconómicos (Índice de Prioridad Social, datos abiertos 2020,
    normalizados vía ETL) y su geometría PostGIS.
    """

    class Semaforo(models.TextChoices):
        ROJO = "ROJO", "Rojo (bajo)"
        AMARILLO = "AMARILLO", "Amarillo (medio)"
        VERDE = "VERDE", "Verde (alto)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=150)
    seccional = models.CharField(max_length=20, blank=True)

    # --- Nivel socioeconómico (IPS) ---
    semaforo = models.CharField(max_length=10, choices=Semaforo.choices, blank=True)
    ips = models.PositiveSmallIntegerField(
        "Índice de Prioridad Social (1-5)", null=True, blank=True,
        help_text="1 = más vulnerable, 5 = mejor nivel socioeconómico.",
    )
    indice_socioeconomico = models.CharField(
        "índice socioeconómico (categoría)", max_length=40, blank=True,
        help_text="Etiqueta de visualización: Bajo / Medio / Alto.",
    )
    indice_socioeconomico_num = models.FloatField(
        "índice socioeconómico (0-100)", null=True, blank=True,
        help_text="IPS normalizado a 0-100 (1→0, 5→100).",
    )

    # --- Demografía ---
    cantidad_habitantes = models.IntegerField("cantidad de habitantes", null=True, blank=True)
    total_hogares = models.IntegerField("total de hogares", null=True, blank=True)
    nbi = models.IntegerField("hogares con NBI", null=True, blank=True)
    superficie_ha = models.FloatField("superficie (ha)", null=True, blank=True)
    densidad_hab_km2 = models.FloatField("densidad (hab/km²)", null=True, blank=True)

    # --- Indicadores componentes del IPS (1-5) ---
    ind_nbi = models.PositiveSmallIntegerField("indicador NBI", null=True, blank=True)
    ind_educacion = models.PositiveSmallIntegerField("indicador educación", null=True, blank=True)
    ind_desempleo = models.PositiveSmallIntegerField("indicador desempleo", null=True, blank=True)
    ind_ninini = models.PositiveSmallIntegerField("indicador NI-NI-NI", null=True, blank=True)

    poligono = gis_models.MultiPolygonField("polígono", srid=4326, null=True, blank=True)

    class Meta:
        db_table = "barrios"
        verbose_name = "barrio"
        verbose_name_plural = "barrios"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

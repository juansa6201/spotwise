from django.contrib import admin
from django.contrib.gis import admin as gis_admin

from .models import Barrio, Rubro


@admin.register(Rubro)
class RubroAdmin(admin.ModelAdmin):
    list_display = ["nombre", "google_place_type"]
    search_fields = ["nombre", "google_place_type"]


@admin.register(Barrio)
class BarrioAdmin(gis_admin.GISModelAdmin):
    list_display = [
        "nombre", "semaforo", "ips", "indice_socioeconomico",
        "cantidad_habitantes", "densidad_hab_km2", "seccional",
    ]
    list_filter = ["semaforo", "ips"]
    search_fields = ["nombre", "seccional"]
    ordering = ["nombre"]
    list_per_page = 50

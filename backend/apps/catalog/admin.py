from django.contrib import admin
from django.contrib.gis import admin as gis_admin

from .models import Barrio, Rubro


@admin.register(Rubro)
class RubroAdmin(admin.ModelAdmin):
    list_display = ["nombre", "google_place_type"]
    search_fields = ["nombre", "google_place_type"]


@admin.register(Barrio)
class BarrioAdmin(gis_admin.GISModelAdmin):
    list_display = ["nombre", "indice_socioeconomico", "cantidad_habitantes"]
    search_fields = ["nombre"]
    list_filter = ["indice_socioeconomico"]

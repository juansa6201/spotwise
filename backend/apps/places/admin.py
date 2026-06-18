from django.contrib import admin

from .models import CacheGooglePlaces


@admin.register(CacheGooglePlaces)
class CacheGooglePlacesAdmin(admin.ModelAdmin):
    list_display = [
        "lat_celda", "lng_celda", "rubro",
        "cantidad_mismo_rubro", "cantidad_total_comercios",
        "consultado_at", "expira_at",
    ]
    list_filter = ["rubro"]
    readonly_fields = ["consultado_at"]

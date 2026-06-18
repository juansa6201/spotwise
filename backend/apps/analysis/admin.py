from django.contrib import admin

from .models import AnalisisGuardado, Indicador


class IndicadorInline(admin.TabularInline):
    model = Indicador
    extra = 0


@admin.register(AnalisisGuardado)
class AnalisisGuardadoAdmin(admin.ModelAdmin):
    list_display = [
        "nombre_referencia", "usuario", "rubro", "score", "decision",
        "favorito", "guardado_at",
    ]
    list_filter = ["decision", "favorito", "rubro"]
    search_fields = ["nombre_referencia", "usuario__email"]
    readonly_fields = ["guardado_at"]
    inlines = [IndicadorInline]

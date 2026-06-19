"""
Analiza la DISTRIBUCION de los indicadores del score sobre la ciudad, para
calibrar los parametros de `scoring.py` (pesos, topes/caps, umbrales).

- Modo demografico (por defecto, GRATIS): recorre los barrios ya cargados y
  muestra como se reparten el indicador socioeconomico (IPS), el de densidad
  y el poblacional combinado. Revela si un cap deja de discriminar (se "clava"
  en 0 o 100) o si hay poca dispersion.

- Modo comercial (--places N, TIENE COSTO): toma N barrios repartidos por
  densidad, usa sus centroides y corre el score completo consultando Google
  Places (reutiliza la cache). Muestra la distribucion de actividad,
  competencia, score final y la reparticion de decisiones.

Ejemplos:
    python manage.py calibrar_score
    python manage.py calibrar_score --places 12 --rubro Restaurante
"""
from collections import Counter

from django.core.management.base import BaseCommand

from apps.analysis import scoring
from apps.catalog.models import Barrio, Rubro
from apps.places.services import PlacesError


def _percentil(ordenados, p):
    """Percentil p (0-100) por interpolacion lineal sobre una lista ordenada."""
    if not ordenados:
        return 0.0
    k = (len(ordenados) - 1) * (p / 100)
    f = int(k)
    c = min(f + 1, len(ordenados) - 1)
    if f == c:
        return ordenados[f]
    return ordenados[f] + (ordenados[c] - ordenados[f]) * (k - f)


def _histograma(valores, ancho=42):
    """Histograma ASCII en 10 buckets de ancho 10 (0-10, 10-20, ... 90-100)."""
    buckets = [0] * 10
    for v in valores:
        buckets[min(9, max(0, int(v // 10)))] += 1
    mx = max(buckets) or 1
    filas = []
    for i, c in enumerate(buckets):
        barra = "#" * round(c / mx * ancho)
        filas.append(f"    {i * 10:3d}-{i * 10 + 10:<3d}| {barra} {c}")
    return "\n".join(filas)


class Command(BaseCommand):
    help = "Analiza la distribucion de los indicadores del score para calibrar scoring.py"

    def add_arguments(self, parser):
        parser.add_argument(
            "--places", type=int, default=0, metavar="N",
            help="Tambien analiza N puntos con Google Places (TIENE COSTO).",
        )
        parser.add_argument(
            "--rubro", type=str, default="Restaurante",
            help="Rubro para el modo --places (por nombre). Default: Restaurante.",
        )

    def _reporte(self, nombre, valores, lo=0.0, hi=100.0, es_cap=True, nota=None):
        """Imprime estadisticos + histograma + diagnostico de un indicador."""
        n = len(valores)
        if n == 0:
            self.stdout.write(f"\n-- {nombre}: sin datos --")
            return
        s = sorted(valores)
        prom = sum(s) / n
        desv = (sum((v - prom) ** 2 for v in s) / n) ** 0.5
        clip_lo = sum(1 for v in s if v <= lo + 1e-6)
        clip_hi = sum(1 for v in s if v >= hi - 1e-6)

        self.stdout.write(self.style.HTTP_INFO(f"\n-- {nombre}  (n={n}) --"))
        self.stdout.write(
            f"    min {s[0]:.1f} | p25 {_percentil(s, 25):.1f} | "
            f"mediana {_percentil(s, 50):.1f} | p75 {_percentil(s, 75):.1f} | max {s[-1]:.1f}"
        )
        self.stdout.write(f"    media {prom:.1f} +/- {desv:.1f} (desvio)")
        self.stdout.write(
            f"    en extremos:  ={lo:.0f} -> {clip_lo} ({clip_lo / n:.0%})   "
            f"={hi:.0f} -> {clip_hi} ({clip_hi / n:.0%})"
        )
        self.stdout.write(_histograma(s))
        if nota:
            self.stdout.write(f"    nota: {nota}")

        # Diagnostico
        if es_cap and clip_hi / n > 0.30:
            self.stdout.write(self.style.WARNING(
                f"    [!] {clip_hi / n:.0%} se clava en {hi:.0f}: el tope quedo chico; "
                "subilo o usa una curva logaritmica."
            ))
        elif es_cap and clip_lo / n > 0.30:
            self.stdout.write(self.style.WARNING(
                f"    [!] {clip_lo / n:.0%} se clava en {lo:.0f}: revisar el tope/curva por abajo."
            ))
        elif desv < 10:
            self.stdout.write(self.style.WARNING(
                f"    [!] desvio bajo ({desv:.1f}): casi no discrimina entre zonas."
            ))
        else:
            self.stdout.write(self.style.SUCCESS("    [ok] dispersion razonable."))

    def handle(self, *args, **opts):
        self.stdout.write(self.style.MIGRATE_HEADING("Parametros actuales (scoring.py):"))
        self.stdout.write(
            f"  PESOS   poblacional={scoring.PESO_POBLACIONAL}  "
            f"actividad={scoring.PESO_ACTIVIDAD}  competencia={scoring.PESO_COMPETENCIA}"
        )
        self.stdout.write(
            f"  SUB-POB socio={scoring.PESO_SOCIO_POBL}  densidad={scoring.PESO_DENS_POBL}"
        )
        self.stdout.write(
            f"  CAPS    competidores={scoring.CAP_COMPETIDORES}  "
            f"resenas={scoring.CAP_RESENAS}  densidad={scoring.CAP_DENSIDAD:.0f} hab/km2"
        )
        self.stdout.write(
            f"  UMBRAL  ALTA>={scoring.UMBRAL_ALTA}  MEDIA>={scoring.UMBRAL_MEDIA}"
        )

        # ---------- Modo demografico (gratis) ----------
        self.stdout.write(self.style.MIGRATE_HEADING(
            "\n== Indicadores demograficos (sobre los barrios cargados) =="
        ))
        socio, dens, pobl = [], [], []
        sin_ips = sin_dens = 0
        for b in Barrio.objects.all():
            s = (b.ips - 1) / 4 * 100 if b.ips else None
            d = (
                scoring._clamp(b.densidad_hab_km2 / scoring.CAP_DENSIDAD * 100)
                if b.densidad_hab_km2 else None
            )
            if s is not None:
                socio.append(s)
            else:
                sin_ips += 1
            if d is not None:
                dens.append(d)
            else:
                sin_dens += 1
            p = scoring.indicador_poblacional(b)
            if p is not None:
                pobl.append(p)

        self._reporte(
            "Socioeconomico (IPS)", socio, es_cap=False,
            nota="el IPS aporta solo 5 niveles discretos (1-5); el detalle fino lo da la densidad.",
        )
        self._reporte("Densidad poblacional", dens)
        self._reporte("Poblacional combinado", pobl, es_cap=False)
        if sin_ips or sin_dens:
            self.stdout.write(f"\n  (barrios sin IPS: {sin_ips} | sin densidad: {sin_dens})")

        # ---------- Modo comercial (con costo) ----------
        n_places = opts["places"]
        if not n_places:
            self.stdout.write(self.style.HTTP_INFO(
                "\nPara incluir actividad/competencia (Google Places, con costo):"
                "\n    manage.py calibrar_score --places 12"
            ))
            return

        rubro = (
            Rubro.objects.filter(nombre__iexact=opts["rubro"]).first()
            or Rubro.objects.first()
        )
        if rubro is None:
            self.stderr.write("No hay rubros cargados.")
            return

        qs = list(
            Barrio.objects.exclude(poligono=None)
            .exclude(densidad_hab_km2=None)
            .order_by("densidad_hab_km2")
        )
        if len(qs) > n_places:
            paso = len(qs) / n_places
            muestra = [qs[int(i * paso)] for i in range(n_places)]
        else:
            muestra = qs

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n== Indicadores comerciales | rubro {rubro.nombre} | "
            f"{len(muestra)} puntos (Google Places) =="
        ))
        self.stdout.write(self.style.WARNING(
            "  Consultando Places (los puntos no cacheados consumen cuota)...\n"
        ))

        actividad, competencia, scores = [], [], []
        decisiones = Counter()
        for b in muestra:
            centro = b.poligono.centroid
            try:
                r = scoring.calcular(centro.y, centro.x, rubro)
            except PlacesError as exc:
                self.stderr.write(f"    {b.nombre}: error Places ({exc})")
                continue
            ind = r["indicadores"]
            actividad.append(ind["actividad_economica"])
            competencia.append(ind["competencia"])
            scores.append(r["score"])
            decisiones[r["decision"]] += 1
            origen = "cache" if r["cacheado"] else " API "
            self.stdout.write(
                f"    [{origen}] {b.nombre[:22]:<22} score={r['score']:>5}  "
                f"act={ind['actividad_economica']:>5}  comp={ind['competencia']:>5}  "
                f"(dir={r['competencia']['competidores_directos']}, "
                f"com={r['competencia']['comercios_totales']}, "
                f"res={r['competencia']['resenas_totales']})"
            )

        self._reporte("Actividad economica", actividad)
        self._reporte("Competencia", competencia)
        self._reporte("Score final", scores, es_cap=False)
        self.stdout.write(
            f"\n  Decisiones:  ALTA {decisiones['ALTA']} | "
            f"MEDIA {decisiones['MEDIA']} | BAJA {decisiones['BAJA']}"
        )

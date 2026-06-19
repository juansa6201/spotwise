"""
Tests del motor de score (`scoring`) y de los endpoints de análisis.

Las consultas a Google Places se mockean siempre (`scoring.analizar_zona`),
así los tests no dependen de la red ni consumen cuota.
"""
import math
from unittest.mock import patch

from django.contrib.gis.geos import MultiPolygon, Polygon
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.analysis import scoring
from apps.analysis.models import AnalisisGuardado
from apps.catalog.models import Barrio, Rubro
from apps.users.models import Usuario

# Punto de prueba (centro aproximado de Córdoba) y un barrio que lo contiene.
LAT, LNG = -31.42, -64.19


def _multipoligono(lng, lat, d=0.02):
    """Cuadrado simple alrededor de (lng, lat) como MultiPolygon SRID 4326."""
    ring = (
        (lng - d, lat - d), (lng + d, lat - d),
        (lng + d, lat + d), (lng - d, lat + d), (lng - d, lat - d),
    )
    return MultiPolygon(Polygon(ring, srid=4326), srid=4326)


def _zona(competidores=0, comercios=0, resenas=0):
    """Dict con la forma que devuelve `places.services.analizar_zona`."""
    return {
        "cantidad_mismo_rubro": competidores,
        "cantidad_total_comercios": comercios,
        "total_resenas": resenas,
        "lugares": [],
        "cacheado": False,
    }


class IndicadorPoblacionalTest(TestCase):
    """El indicador poblacional combina IPS (1-5) y densidad, o None sin datos."""

    def test_sin_barrio_es_none(self):
        self.assertIsNone(scoring.indicador_poblacional(None))

    def test_solo_ips_sin_densidad(self):
        # IPS 5 -> s_socio = 100; sin densidad usa solo el socioeconómico.
        barrio = Barrio(nombre="X", ips=5)
        self.assertEqual(scoring.indicador_poblacional(barrio), 100.0)

    def test_ips_minimo_es_cero(self):
        barrio = Barrio(nombre="X", ips=1)
        self.assertEqual(scoring.indicador_poblacional(barrio), 0.0)

    def test_combina_ips_y_densidad(self):
        # IPS 3 -> 50 ; densidad = CAP -> 100 ; 0.6*50 + 0.4*100 = 70
        barrio = Barrio(nombre="X", ips=3, densidad_hab_km2=scoring.CAP_DENSIDAD)
        self.assertEqual(scoring.indicador_poblacional(barrio), 70.0)


class ScoringCalcularTest(TestCase):
    """`scoring.calcular` integra los tres indicadores, los pondera y decide."""

    def setUp(self):
        self.rubro = Rubro.objects.get_or_create(
            nombre="Restaurante", defaults={"google_place_type": "restaurant"})[0]
        self.barrio = Barrio.objects.create(
            nombre="Centro", ips=4, densidad_hab_km2=9000,
            poligono=_multipoligono(LNG, LAT),
        )

    def _calcular(self, **zona_kwargs):
        with patch.object(scoring, "analizar_zona", return_value=_zona(**zona_kwargs)):
            return scoring.calcular(LAT, LNG, self.rubro)

    def test_indicadores_y_score_ponderado(self):
        res = self._calcular(competidores=3, comercios=10, resenas=2000)
        ind = res["indicadores"]

        # Poblacional: IPS 4 -> 75 ; densidad 9000 -> 60 ; 0.6*75 + 0.4*60 = 69
        self.assertEqual(ind["poblacional"], 69.0)
        # Competencia inversa: 1 - 3/15 = 0.8 -> 80
        self.assertEqual(ind["competencia"], 80.0)
        # Actividad: curva log sobre las reseñas
        act_esperada = round(100 * math.log1p(2000) / math.log1p(scoring.CAP_RESENAS), 1)
        self.assertEqual(ind["actividad_economica"], act_esperada)
        # Score = suma ponderada con los pesos vigentes
        esperado = round(
            scoring.PESO_POBLACIONAL * 69.0
            + scoring.PESO_ACTIVIDAD * act_esperada
            + scoring.PESO_COMPETENCIA * 80.0,
            1,
        )
        self.assertEqual(res["score"], esperado)
        self.assertFalse(res["fuera_de_cordoba"])
        self.assertEqual(res["competencia"]["resenas_totales"], 2000)

    def test_competencia_sin_competidores_es_maxima(self):
        res = self._calcular(competidores=0, comercios=5, resenas=100)
        self.assertEqual(res["indicadores"]["competencia"], 100.0)

    def test_competencia_saturada_es_cero(self):
        res = self._calcular(competidores=scoring.CAP_COMPETIDORES + 5)
        self.assertEqual(res["indicadores"]["competencia"], 0.0)

    def test_actividad_cero_sin_resenas(self):
        res = self._calcular(resenas=0)
        self.assertEqual(res["indicadores"]["actividad_economica"], 0.0)

    def test_actividad_se_satura_en_cien(self):
        res = self._calcular(resenas=scoring.CAP_RESENAS * 10)
        self.assertEqual(res["indicadores"]["actividad_economica"], 100.0)

    def test_fuera_de_barrio_usa_poblacional_neutro(self):
        # Punto lejos de cualquier barrio cargado.
        with patch.object(scoring, "analizar_zona", return_value=_zona()):
            res = scoring.calcular(10.0, 10.0, self.rubro)
        self.assertTrue(res["fuera_de_cordoba"])
        self.assertIsNone(res["indicadores"]["poblacional"])
        self.assertIsNone(res["barrio"])

    def test_decision_segun_umbrales(self):
        self.assertEqual(scoring._decision(scoring.UMBRAL_ALTA), "ALTA")
        self.assertEqual(scoring._decision(scoring.UMBRAL_MEDIA), "MEDIA")
        self.assertEqual(scoring._decision(scoring.UMBRAL_MEDIA - 1), "BAJA")


class AnalizarEndpointTest(APITestCase):
    """POST /api/analysis/analizar/ (público)."""

    def setUp(self):
        self.rubro = Rubro.objects.get_or_create(
            nombre="Cafetería", defaults={"google_place_type": "cafe"})[0]
        Barrio.objects.create(nombre="Centro", ips=4, densidad_hab_km2=9000,
                              poligono=_multipoligono(LNG, LAT))
        self.url = "/api/analysis/analizar/"

    def test_analiza_y_devuelve_score(self):
        with patch.object(scoring, "analizar_zona", return_value=_zona(2, 10, 1500)):
            resp = self.client.post(self.url, {"lat": LAT, "lng": LNG, "rubro_id": str(self.rubro.id)})
        self.assertEqual(resp.status_code, 200)
        self.assertIn("score", resp.data)
        self.assertIn("decision", resp.data)
        self.assertEqual(resp.data["rubro"]["nombre"], "Cafetería")

    def test_coordenadas_invalidas(self):
        resp = self.client.post(self.url, {"lat": "x", "lng": LNG, "rubro_id": str(self.rubro.id)})
        self.assertEqual(resp.status_code, 400)

    def test_rubro_inexistente(self):
        # UUID válido pero que no corresponde a ningún rubro -> 400
        resp = self.client.post(self.url, {
            "lat": LAT, "lng": LNG, "rubro_id": "00000000-0000-0000-0000-000000000000"})
        self.assertEqual(resp.status_code, 400)

    def test_rubro_id_malformado(self):
        # Un rubro_id que no es UUID no debe romper (400 limpio, no 500).
        resp = self.client.post(self.url, {"lat": LAT, "lng": LNG, "rubro_id": "no-es-uuid"})
        self.assertEqual(resp.status_code, 400)


class GuardadosEndpointTest(APITestCase):
    """CRUD de análisis guardados (requiere autenticación, acotado al usuario)."""

    def setUp(self):
        self.user = Usuario.objects.create_user(
            email="a@test.com", password="Spotwise123", nombre="Ana", apellido="A",
        )
        self.otro = Usuario.objects.create_user(
            email="b@test.com", password="Spotwise123", nombre="Beto", apellido="B",
        )
        self.rubro = Rubro.objects.get_or_create(
            nombre="Bar", defaults={"google_place_type": "bar"})[0]
        Barrio.objects.create(nombre="Centro", ips=4, densidad_hab_km2=9000,
                              poligono=_multipoligono(LNG, LAT))
        self.url = "/api/analysis/guardados/"

    def _guardar(self):
        with patch.object(scoring, "analizar_zona", return_value=_zona(1, 8, 1200)):
            return self.client.post(self.url, {
                "lat": LAT, "lng": LNG, "rubro_id": str(self.rubro.id),
                "nombre_referencia": "Local centro",
            })

    def test_listar_sin_token_da_401(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_guardar_persiste_analisis_e_indicadores(self):
        self.client.force_authenticate(self.user)
        resp = self._guardar()
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(AnalisisGuardado.objects.filter(usuario=self.user).count(), 1)
        analisis = AnalisisGuardado.objects.get(usuario=self.user)
        self.assertEqual(analisis.nombre_referencia, "Local centro")
        # 3 indicadores (poblacional, actividad, competencia) persistidos
        self.assertEqual(analisis.indicadores.count(), 3)
        self.assertEqual(resp.data["barrio_nombre"], "Centro")

    def test_solo_lista_los_propios(self):
        AnalisisGuardado.objects.create(usuario=self.otro, rubro=self.rubro,
                                        latitud=LAT, longitud=LNG, score=50, decision="MEDIA")
        self.client.force_authenticate(self.user)
        self._guardar()
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)  # solo el de Ana

    def test_favorito_y_borrado(self):
        self.client.force_authenticate(self.user)
        creado = self._guardar()
        detalle = f"{self.url}{creado.data['id']}/"

        patch_resp = self.client.patch(detalle, {"favorito": True}, format="json")
        self.assertEqual(patch_resp.status_code, 200)
        self.assertTrue(patch_resp.data["favorito"])

        del_resp = self.client.delete(detalle)
        self.assertEqual(del_resp.status_code, 204)
        self.assertEqual(AnalisisGuardado.objects.count(), 0)

    def test_no_accede_a_los_de_otro(self):
        ajeno = AnalisisGuardado.objects.create(usuario=self.otro, rubro=self.rubro,
                                                latitud=LAT, longitud=LNG, score=50, decision="MEDIA")
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(f"{self.url}{ajeno.id}/").status_code, 404)

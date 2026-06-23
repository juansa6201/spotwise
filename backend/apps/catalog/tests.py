"""Tests de catálogo: listado de rubros y validación de ubicación (bbox Córdoba)."""
from django.contrib.gis.geos import MultiPolygon, Polygon
from rest_framework.test import APITestCase

from apps.catalog.models import Barrio, Rubro


def _multipoligono(lng, lat, d=0.01):
    """Cuadrado pequeño alrededor de (lng, lat) como MultiPolygon."""
    anillo = ((lng - d, lat - d), (lng - d, lat + d), (lng + d, lat + d),
              (lng + d, lat - d), (lng - d, lat - d))
    return MultiPolygon(Polygon(anillo), srid=4326)


class RubroListTest(APITestCase):
    def test_lista_rubros(self):
        resp = self.client.get("/api/catalog/rubros/")
        self.assertEqual(resp.status_code, 200)
        # Devuelve todos los rubros cargados (el seed inicial trae 12).
        self.assertEqual(len(resp.data), Rubro.objects.count())
        self.assertGreaterEqual(len(resp.data), 1)


class ValidarUbicacionTest(APITestCase):
    url = "/api/catalog/validar-ubicacion/"

    def test_dentro_de_cordoba(self):
        resp = self.client.post(self.url, {"lat": -31.42, "lng": -64.19})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["dentro_de_cordoba"])

    def test_fuera_de_cordoba(self):
        resp = self.client.post(self.url, {"lat": 0, "lng": 0})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["dentro_de_cordoba"])

    def test_coordenadas_invalidas(self):
        resp = self.client.post(self.url, {"lat": "x", "lng": "y"})
        self.assertEqual(resp.status_code, 400)

    def test_incluye_el_barrio_del_punto(self):
        Barrio.objects.create(
            nombre="Centro", semaforo="VERDE", indice_socioeconomico="Alto", ips=5,
            cantidad_habitantes=12000, densidad_hab_km2=9000,
            poligono=_multipoligono(-64.19, -31.42),
        )
        resp = self.client.post(self.url, {"lat": -31.42, "lng": -64.19})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["barrio"]["nombre"], "Centro")
        self.assertEqual(resp.data["barrio"]["semaforo"], "VERDE")

    def test_sin_barrio_devuelve_null(self):
        resp = self.client.post(self.url, {"lat": -31.42, "lng": -64.19})
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.data["barrio"])


class BarriosGeoJSONTest(APITestCase):
    url = "/api/catalog/barrios/"

    def test_devuelve_featurecollection_con_props_socioeconomicas(self):
        Barrio.objects.create(
            nombre="Centro", semaforo="VERDE", indice_socioeconomico="Alto", ips=5,
            poligono=_multipoligono(-64.19, -31.42),
        )
        # Un barrio sin polígono no debe aparecer en el GeoJSON.
        Barrio.objects.create(nombre="Sin geometría", semaforo="ROJO")

        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["type"], "FeatureCollection")
        self.assertEqual(len(resp.data["features"]), 1)

        feature = resp.data["features"][0]
        self.assertIn(feature["geometry"]["type"], ("Polygon", "MultiPolygon"))
        self.assertEqual(feature["properties"]["nombre"], "Centro")
        self.assertEqual(feature["properties"]["semaforo"], "VERDE")
        self.assertEqual(feature["properties"]["indice_socioeconomico"], "Alto")

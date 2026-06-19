"""Tests de catálogo: listado de rubros y validación de ubicación (bbox Córdoba)."""
from rest_framework.test import APITestCase

from apps.catalog.models import Rubro


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

"""
Tests del servicio de Google Places. Nunca se llama a la red real: se mockea
`requests.get` (para `_nearby`) o directamente `_nearby` (para `analizar_zona`).
"""
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from apps.catalog.models import Rubro
from apps.places import services
from apps.places.models import CacheGooglePlaces

LAT, LNG = -31.42, -64.19


class FakeResp:
    """Respuesta HTTP falsa con `.json()`."""

    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


@override_settings(GOOGLE_PLACES_API_KEY="test-key")
class NearbyTest(TestCase):
    """`_nearby` parsea resultados y captura las reseñas (user_ratings_total)."""

    def test_parsea_resultados_y_resenas(self):
        data = {
            "status": "OK",
            "results": [
                {"name": "A", "geometry": {"location": {"lat": LAT, "lng": LNG}},
                 "types": ["restaurant"], "user_ratings_total": 120},
                {"name": "B", "geometry": {"location": {"lat": LAT, "lng": LNG}},
                 "types": ["cafe"]},  # sin user_ratings_total -> 0
            ],
        }
        with patch.object(services.requests, "get", return_value=FakeResp(data)):
            res = services._nearby(LAT, LNG, 500, place_type="restaurant")
        self.assertEqual(len(res), 2)
        self.assertEqual(res[0]["resenas"], 120)
        self.assertEqual(res[1]["resenas"], 0)

    def test_zero_results_devuelve_vacio(self):
        with patch.object(services.requests, "get", return_value=FakeResp({"status": "ZERO_RESULTS"})):
            self.assertEqual(services._nearby(LAT, LNG, 500), [])

    def test_status_no_ok_lanza_error(self):
        data = {"status": "REQUEST_DENIED", "error_message": "clave inválida"}
        with patch.object(services.requests, "get", return_value=FakeResp(data)):
            with self.assertRaises(services.PlacesError):
                services._nearby(LAT, LNG, 500)

    @override_settings(GOOGLE_PLACES_API_KEY="")
    def test_sin_api_key_lanza_error(self):
        with self.assertRaises(services.PlacesError):
            services._nearby(LAT, LNG, 500)


class AnalizarZonaTest(TestCase):
    """`analizar_zona` agrega reseñas, cuenta competidores y cachea por celda."""

    def setUp(self):
        self.rubro = Rubro.objects.get_or_create(
            nombre="Bar", defaults={"google_place_type": "bar"})[0]
        self.competidores = [
            {"nombre": "R1", "lat": LAT, "lng": LNG, "tipos": ["bar"], "resenas": 50},
        ]
        self.comercios = [
            {"nombre": "R1", "lat": LAT, "lng": LNG, "tipos": ["bar"], "resenas": 50},
            {"nombre": "C2", "lat": LAT, "lng": LNG, "tipos": ["store"], "resenas": 200},
        ]

    def test_cache_miss_consulta_suma_resenas_y_guarda(self):
        with patch.object(services, "_nearby", side_effect=[self.competidores, self.comercios]):
            res = services.analizar_zona(LAT, LNG, self.rubro)

        self.assertFalse(res["cacheado"])
        self.assertEqual(res["cantidad_mismo_rubro"], 1)
        self.assertEqual(res["cantidad_total_comercios"], 2)
        self.assertEqual(res["total_resenas"], 250)  # 50 + 200
        # Quedó cacheado por celda + rubro
        cache = CacheGooglePlaces.objects.get(rubro=self.rubro)
        self.assertEqual(cache.total_resenas, 250)

    def test_cache_hit_no_consulta_la_api(self):
        CacheGooglePlaces.objects.create(
            rubro=self.rubro,
            lat_celda=round(LAT, services.CELDA_DECIMALES),
            lng_celda=round(LNG, services.CELDA_DECIMALES),
            cantidad_mismo_rubro=2, cantidad_total_comercios=9, total_resenas=999,
            resultados=[], expira_at=timezone.now() + timedelta(days=1),
        )
        with patch.object(services, "_nearby") as mock_nearby:
            res = services.analizar_zona(LAT, LNG, self.rubro)

        mock_nearby.assert_not_called()
        self.assertTrue(res["cacheado"])
        self.assertEqual(res["total_resenas"], 999)

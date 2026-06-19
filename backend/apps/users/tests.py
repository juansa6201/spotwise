"""Tests de autenticación: validador de contraseña, registro, login y /me."""
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.users.models import Usuario
from apps.users.validators import UpperLowerCaseValidator


class UpperLowerCaseValidatorTest(TestCase):
    """Exige al menos una mayúscula y una minúscula."""

    def setUp(self):
        self.validator = UpperLowerCaseValidator()

    def test_rechaza_sin_mayuscula(self):
        with self.assertRaises(ValidationError):
            self.validator.validate("todominuscula1")

    def test_rechaza_sin_minuscula(self):
        with self.assertRaises(ValidationError):
            self.validator.validate("TODOMAYUSCULA1")

    def test_acepta_mixta(self):
        self.assertIsNone(self.validator.validate("Spotwise123"))


class RegistroTest(APITestCase):
    url = "/api/auth/register/"

    def _payload(self, **over):
        data = {
            "email": "nuevo@test.com", "nombre": "Juan", "apellido": "Mare",
            "password": "Spotwise123", "password2": "Spotwise123",
        }
        data.update(over)
        return data

    def test_registro_exitoso(self):
        resp = self.client.post(self.url, self._payload())
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Usuario.objects.filter(email="nuevo@test.com").exists())

    def test_password_sin_mayuscula_falla(self):
        resp = self.client.post(self.url, self._payload(password="spotwise123", password2="spotwise123"))
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Usuario.objects.filter(email="nuevo@test.com").exists())

    def test_passwords_no_coinciden(self):
        resp = self.client.post(self.url, self._payload(password2="Otra123456"))
        self.assertEqual(resp.status_code, 400)

    def test_email_duplicado(self):
        Usuario.objects.create_user(email="dup@test.com", password="Spotwise123", nombre="A", apellido="B")
        resp = self.client.post(self.url, self._payload(email="dup@test.com"))
        self.assertEqual(resp.status_code, 400)


class LoginMeTest(APITestCase):
    def setUp(self):
        self.user = Usuario.objects.create_user(
            email="log@test.com", password="Spotwise123", nombre="Log", apellido="In",
        )

    def test_login_devuelve_tokens_y_usuario(self):
        resp = self.client.post("/api/auth/login/", {"email": "log@test.com", "password": "Spotwise123"})
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertEqual(resp.data["user"]["email"], "log@test.com")

    def test_login_credenciales_invalidas(self):
        resp = self.client.post("/api/auth/login/", {"email": "log@test.com", "password": "incorrecta"})
        self.assertEqual(resp.status_code, 401)

    def test_me_requiere_token(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_me_con_token(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "log@test.com")

import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UsuarioManager


class Usuario(AbstractBaseUser, PermissionsMixin):
    """
    Usuario del sistema. El email funciona como identificador único
    (no existe nombre de usuario). La contraseña se guarda hasheada.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField("correo electrónico", unique=True)
    nombre = models.CharField("nombre", max_length=150)
    apellido = models.CharField("apellido", max_length=150)
    telefono = models.CharField("teléfono", max_length=30, blank=True)

    # Se mapea al campo `activo` del DER, manteniendo el nombre que espera Django.
    is_active = models.BooleanField("activo", default=True, db_column="activo")
    is_staff = models.BooleanField("equipo", default=False)
    created_at = models.DateTimeField("creado", auto_now_add=True)
    # `last_login` y `password` los aporta AbstractBaseUser.

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombre", "apellido"]

    class Meta:
        db_table = "usuarios"
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
        ordering = ["email"]

    def __str__(self):
        return self.email

    @property
    def nombre_completo(self):
        return f"{self.nombre} {self.apellido}".strip()

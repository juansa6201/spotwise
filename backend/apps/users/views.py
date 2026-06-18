from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import LoginSerializer, RegistroSerializer, UsuarioSerializer

Usuario = get_user_model()


class RegistroView(generics.CreateAPIView):
    """HU-001: registro de usuario."""

    queryset = Usuario.objects.all()
    serializer_class = RegistroSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(TokenObtainPairView):
    """HU-002: inicio de sesión (devuelve access, refresh y datos del usuario)."""

    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveAPIView):
    """Datos del usuario autenticado (para que el frontend conozca la sesión activa)."""

    serializer_class = UsuarioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

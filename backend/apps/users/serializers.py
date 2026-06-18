from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

Usuario = get_user_model()


class UsuarioSerializer(serializers.ModelSerializer):
    """Datos públicos del usuario que se devuelven al frontend."""

    class Meta:
        model = Usuario
        fields = ["id", "email", "nombre", "apellido", "telefono"]
        read_only_fields = ["id"]


class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    password2 = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = Usuario
        fields = ["id", "email", "nombre", "apellido", "telefono", "password", "password2"]
        read_only_fields = ["id"]
        extra_kwargs = {
            "nombre": {"required": True, "allow_blank": False},
            "apellido": {"required": True, "allow_blank": False},
        }

    def validate_email(self, value):
        value = value.lower().strip()
        if Usuario.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "Ya existe una cuenta registrada con este correo electrónico."
            )
        return value

    def validate(self, attrs):
        if attrs.get("password") != attrs.get("password2"):
            raise serializers.ValidationError(
                {"password2": "Las contraseñas no coinciden."}
            )
        # Política de contraseñas del prototipo (mín. 8, mayúscula, minúscula).
        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2", None)
        password = validated_data.pop("password")
        return Usuario.objects.create_user(password=password, **validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """Inicio de sesión por email + contraseña; agrega los datos del usuario."""

    default_error_messages = {
        "no_active_account": "El correo electrónico o la contraseña son incorrectos.",
    }

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UsuarioSerializer(self.user).data
        return data

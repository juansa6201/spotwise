import re

from django.core.exceptions import ValidationError


class UpperLowerCaseValidator:
    """
    Exige que la contraseña tenga al menos una letra mayúscula y una minúscula,
    según los requisitos de seguridad del prototipo (sección Acceso a la aplicación).
    """

    def validate(self, password, user=None):
        if not re.search(r"[A-Z]", password):
            raise ValidationError(
                "La contraseña debe contener al menos una letra mayúscula.",
                code="password_no_upper",
            )
        if not re.search(r"[a-z]", password):
            raise ValidationError(
                "La contraseña debe contener al menos una letra minúscula.",
                code="password_no_lower",
            )

    def get_help_text(self):
        return "Tu contraseña debe contener al menos una letra mayúscula y una minúscula."

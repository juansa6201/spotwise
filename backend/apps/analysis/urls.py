from django.urls import path

from .views import AnalizarView

urlpatterns = [
    path("analizar/", AnalizarView.as_view(), name="analizar"),
]

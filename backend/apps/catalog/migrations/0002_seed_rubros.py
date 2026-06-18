from django.db import migrations

RUBROS = [
    ("Restaurante", "restaurant", "Restaurantes y casas de comida."),
    ("Cafetería", "cafe", "Cafeterías y casas de café."),
    ("Bar", "bar", "Bares y cervecerías."),
    ("Panadería", "bakery", "Panaderías y confiterías."),
    ("Farmacia", "pharmacy", "Farmacias."),
    ("Supermercado", "supermarket", "Supermercados y autoservicios."),
    ("Kiosco / Maxikiosco", "convenience_store", "Kioscos y tiendas de conveniencia."),
    ("Indumentaria", "clothing_store", "Tiendas de ropa e indumentaria."),
    ("Gimnasio", "gym", "Gimnasios y centros de fitness."),
    ("Peluquería / Estética", "hair_care", "Peluquerías y centros de estética."),
    ("Ferretería", "hardware_store", "Ferreterías."),
    ("Librería / Papelería", "book_store", "Librerías y papelerías."),
]


def cargar_rubros(apps, schema_editor):
    Rubro = apps.get_model("catalog", "Rubro")
    for nombre, gtype, descripcion in RUBROS:
        Rubro.objects.get_or_create(
            nombre=nombre,
            defaults={"google_place_type": gtype, "descripcion": descripcion},
        )


def borrar_rubros(apps, schema_editor):
    Rubro = apps.get_model("catalog", "Rubro")
    Rubro.objects.filter(nombre__in=[r[0] for r in RUBROS]).delete()


class Migration(migrations.Migration):
    dependencies = [("catalog", "0001_initial")]
    operations = [migrations.RunPython(cargar_rubros, borrar_rubros)]

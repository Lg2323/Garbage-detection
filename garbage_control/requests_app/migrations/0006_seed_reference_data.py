from django.db import migrations


def seed_reference_data(apps, schema_editor):
    OrganizationType = apps.get_model("requests_app", "OrganizationType")
    TerritoryType = apps.get_model("requests_app", "TerritoryType")
    OwnershipType = apps.get_model("requests_app", "OwnershipType")

    organization_types = [
        ("MUNICIPAL_SERVICE", "Муниципальная служба", "Муниципальная служба, выполняющая уборку и благоустройство."),
        ("CONTRACTOR", "Подрядная организация", "Внешний подрядчик, привлекаемый к уборке."),
        ("DISTRICT_ADMINISTRATION", "Администрация района", "Муниципальный орган, отвечающий за территорию района."),
        ("ROAD_SERVICE", "Дорожная служба", "Организация, отвечающая за дорожную инфраструктуру."),
        ("PROPERTY_OWNER", "Собственник или балансодержатель", "Юридическое или физическое лицо, владеющее участком."),
        ("OTHER", "Иная организация", "Иной адресат или исполнитель."),
    ]

    territory_types = [
        ("MUNICIPAL_LAND", "Муниципальная территория", "Территория, обслуживаемая муниципальным контуром.", False),
        ("PRIVATE_LAND", "Частная территория", "Территория частного собственника.", True),
        ("FOREST_FUND", "Лесной фонд", "Территория лесного фонда.", True),
        ("WATER_PROTECTION_ZONE", "Водоохранная зона", "Территория в границах водоохранной зоны.", True),
        ("ROAD_INFRASTRUCTURE", "Дорожная инфраструктура", "Полоса отвода дорог и дорожные объекты.", True),
        ("OTHER", "Иная территория", "Иная категория территории.", False),
    ]

    ownership_types = [
        ("MUNICIPAL", "Муниципальная", "Муниципальная собственность."),
        ("PRIVATE", "Частная", "Частная собственность."),
        ("STATE", "Государственная", "Государственная собственность."),
        ("REGIONAL", "Региональная", "Собственность субъекта РФ."),
        ("FEDERAL", "Федеральная", "Федеральная собственность."),
        ("MIXED", "Смешанная", "Смешанный режим собственности."),
        ("UNKNOWN", "Не определена", "Форма собственности пока не определена."),
    ]

    for code, name, description in organization_types:
        OrganizationType.objects.update_or_create(
            code=code,
            defaults={"name": name, "description": description, "is_active": True},
        )

    for code, name, description, requires_external_transfer in territory_types:
        TerritoryType.objects.update_or_create(
            code=code,
            defaults={
                "name": name,
                "description": description,
                "requires_external_transfer": requires_external_transfer,
                "is_active": True,
            },
        )

    for code, name, description in ownership_types:
        OwnershipType.objects.update_or_create(
            code=code,
            defaults={"name": name, "description": description, "is_active": True},
        )


def unseed_reference_data(apps, schema_editor):
    OrganizationType = apps.get_model("requests_app", "OrganizationType")
    TerritoryType = apps.get_model("requests_app", "TerritoryType")
    OwnershipType = apps.get_model("requests_app", "OwnershipType")

    OrganizationType.objects.filter(
        code__in=[
            "MUNICIPAL_SERVICE",
            "CONTRACTOR",
            "DISTRICT_ADMINISTRATION",
            "ROAD_SERVICE",
            "PROPERTY_OWNER",
            "OTHER",
        ]
    ).delete()
    TerritoryType.objects.filter(
        code__in=[
            "MUNICIPAL_LAND",
            "PRIVATE_LAND",
            "FOREST_FUND",
            "WATER_PROTECTION_ZONE",
            "ROAD_INFRASTRUCTURE",
            "OTHER",
        ]
    ).delete()
    OwnershipType.objects.filter(
        code__in=[
            "MUNICIPAL",
            "PRIVATE",
            "STATE",
            "REGIONAL",
            "FEDERAL",
            "MIXED",
            "UNKNOWN",
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("requests_app", "0005_federalsubject_locality_organizationtype_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_reference_data, unseed_reference_data),
    ]

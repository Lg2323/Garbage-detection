from rest_framework import serializers
from django.contrib.gis.geos import Point
from .models import Request, VerificationResult
from .geocoding import detect_city_by_coordinates


class RequestCreateSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True)
    longitude = serializers.FloatField(write_only=True)
    city = serializers.CharField(required=False, allow_blank=True, max_length=120)

    class Meta:
        model = Request
        fields = ("id", "title", "latitude", "longitude", "city", "location", "before_photo", "created_at")
        read_only_fields = ("id", "location", "created_at")

    def create(self, validated_data):
        lat = validated_data.pop("latitude")
        lon = validated_data.pop("longitude")
        provided_city = (validated_data.pop("city", "") or "").strip()
        detected_city = detect_city_by_coordinates(lat, lon)
        validated_data["city"] = detected_city or provided_city
        validated_data["location"] = Point(lon, lat)
        return super().create(validated_data)


class RequestListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = (
            "id", "title", "status", "city", "location",
            "created_by", "assigned_worker", "coordinator",
            "created_at", "updated_at"
        )


class VerificationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = VerificationResult
        fields = ("is_clean", "score", "details", "created_at")


class RequestDetailSerializer(serializers.ModelSerializer):
    verification = VerificationResultSerializer(read_only=True)

    class Meta:
        model = Request
        fields = (
            "id", "title", "status", "city", "location",
            "created_by", "assigned_worker", "coordinator",
            "before_photo", "after_photo", "verification",
            "created_at", "updated_at"
        )


class RequestCompletedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = (
            "id",
            "title",
            "status",
            "city",
            "before_photo",
            "after_photo",
            "created_at",
            "updated_at",
        )


class AssignWorkerSerializer(serializers.Serializer):
    worker_id = serializers.IntegerField(min_value=1)

class UploadAfterPhotoSerializer(serializers.Serializer):
    after_photo = serializers.ImageField()

class VerifyRequestSerializer(serializers.Serializer):
    force = serializers.BooleanField(required=False, default=False)

class AdminSetStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Request.Status.choices)

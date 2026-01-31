from rest_framework import serializers
from django.contrib.gis.geos import Point
from .models import Request, VerificationResult


class RequestCreateSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True)
    longitude = serializers.FloatField(write_only=True)

    class Meta:
        model = Request
        fields = ("id", "title", "latitude", "longitude", "location", "before_photo", "created_at")
        read_only_fields = ("id", "location", "created_at")

    def create(self, validated_data):
        lat = validated_data.pop("latitude")
        lon = validated_data.pop("longitude")
        validated_data["location"] = Point(lon, lat)  # важно: lon, lat
        return super().create(validated_data)


class RequestListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = (
            "id", "title", "status", "location",
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
            "id", "title", "status", "location",
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

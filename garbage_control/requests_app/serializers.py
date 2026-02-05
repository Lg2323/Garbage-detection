from django.contrib.gis.geos import Point
from rest_framework import serializers

from .geocoding import detect_city_by_coordinates
from .models import Request, RequestRework, VerificationResult


class RequestReworkSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    previous_worker_username = serializers.CharField(source="previous_worker.username", read_only=True)
    new_worker_username = serializers.CharField(source="new_worker.username", read_only=True)

    class Meta:
        model = RequestRework
        fields = (
            "id",
            "comment",
            "created_at",
            "previous_status",
            "created_by",
            "created_by_username",
            "previous_worker",
            "previous_worker_username",
            "new_worker",
            "new_worker_username",
        )


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
    last_rework_comment = serializers.SerializerMethodField()
    rework_count = serializers.SerializerMethodField()

    class Meta:
        model = Request
        fields = (
            "id",
            "title",
            "status",
            "city",
            "location",
            "created_by",
            "assigned_worker",
            "coordinator",
            "created_at",
            "updated_at",
            "last_rework_comment",
            "rework_count",
        )

    def get_last_rework_comment(self, obj):
        event = obj.rework_events.order_by("-created_at").first()
        return event.comment if event else ""

    def get_rework_count(self, obj):
        return obj.rework_events.count()


class VerificationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = VerificationResult
        fields = ("is_clean", "score", "details", "created_at")


class RequestDetailSerializer(serializers.ModelSerializer):
    verification = VerificationResultSerializer(read_only=True)
    rework_events = RequestReworkSerializer(many=True, read_only=True)

    class Meta:
        model = Request
        fields = (
            "id",
            "title",
            "status",
            "city",
            "location",
            "created_by",
            "assigned_worker",
            "coordinator",
            "before_photo",
            "after_photo",
            "verification",
            "rework_events",
            "created_at",
            "updated_at",
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


class ReturnToWorkSerializer(serializers.Serializer):
    comment = serializers.CharField(min_length=5, max_length=2000)
    reassign_worker_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)

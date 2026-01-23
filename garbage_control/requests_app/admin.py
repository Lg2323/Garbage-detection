from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import Request

@admin.register(Request)
class RequestAdmin(GISModelAdmin):
    list_display = ("id", "title", "status", "created_at")
    search_fields = ("title",)
    list_filter = ("status",)

    class Media:
        js = ("admin/lock_location_map.js",)

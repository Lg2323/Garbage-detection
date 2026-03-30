from django.contrib import admin
from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'username', 'email', 'role', 'organization', 'department', 'is_active')
    list_filter = ('role', 'organization')
    search_fields = ('username', 'email', 'organization__name', 'department__name')

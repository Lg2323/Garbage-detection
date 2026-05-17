from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RequestViewSet
from .route_views import RouteViewSet

router = DefaultRouter()
router.register(r"requests", RequestViewSet, basename="requests")
router.register(r"routes", RouteViewSet, basename="routes")

urlpatterns = [
    path("", include(router.urls)),
]

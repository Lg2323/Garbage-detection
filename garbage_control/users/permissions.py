from rest_framework.permissions import BasePermission


class IsCoordinator(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'COORDINATOR'


class IsWorker(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'WORKER'


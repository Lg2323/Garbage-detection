from rest_framework.permissions import BasePermission


class HasRole(BasePermission):
    allowed_roles: set[str] = set()

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return getattr(user, "role", None) in self.allowed_roles


class IsCitizen(HasRole):
    allowed_roles = {"CITIZEN"}


class IsCitizenOrAdmin(HasRole):
    allowed_roles = {"CITIZEN", "ADMIN"}


class IsWorker(HasRole):
    allowed_roles = {"WORKER"}


class IsCoordinator(HasRole):
    allowed_roles = {"COORDINATOR"}


class IsCoordinatorOrAdmin(HasRole):
    allowed_roles = {"COORDINATOR", "ADMIN"}


class IsOrgManager(HasRole):
    allowed_roles = {"ORG_MANAGER"}


class IsOrgManagerOrAdmin(HasRole):
    allowed_roles = {"ORG_MANAGER", "ADMIN"}


class IsDepartmentManager(HasRole):
    allowed_roles = {"DEPARTMENT_MANAGER"}


class IsDepartmentManagerOrAdmin(HasRole):
    allowed_roles = {"DEPARTMENT_MANAGER", "ADMIN"}


class IsAdminRole(HasRole):
    allowed_roles = {"ADMIN"}

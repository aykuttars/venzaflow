from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from django.utils.translation import gettext as _
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Department

User = get_user_model()


def department_permission_codenames(department: Department | None) -> set[str]:
    if department is None:
        return set()
    return set(department.permissions.values_list("codename", flat=True))


def effective_permissions_for(
    department: Department | None,
    extra_codenames: list[str] | set[str] | None = None,
) -> set[str]:
    codes = department_permission_codenames(department)
    if extra_codenames:
        codes.update(extra_codenames)
    return codes


def is_tenant_manager(user: User) -> bool:
    if user.is_platform_admin:
        return True
    if user.has_permission_codename("settings.write"):
        return True
    if user.department_id and user.department.key == "admin":
        return True
    return False


def is_strict_subset(subset: set[str], superset: set[str]) -> bool:
    return subset < superset


def can_manage_target(
    actor: User,
    target: User,
    proposed_permissions: set[str] | None = None,
) -> bool:
    if actor.pk == target.pk:
        return True
    if is_tenant_manager(actor):
        return True
    actor_perms = actor.effective_permission_codenames()
    target_perms = (
        proposed_permissions
        if proposed_permissions is not None
        else target.effective_permission_codenames()
    )
    return is_strict_subset(target_perms, actor_perms)


def filter_grantable_codenames(actor: User, codes: list[str]) -> list[str]:
    if is_tenant_manager(actor):
        return list(codes)
    actor_perms = actor.effective_permission_codenames()
    return [c for c in codes if c in actor_perms]


def filter_assignable_departments(actor: User, queryset: QuerySet[Department]) -> QuerySet[Department]:
    if is_tenant_manager(actor):
        return queryset
    actor_perms = actor.effective_permission_codenames()
    assignable_ids: list[int] = []
    for dept in queryset.prefetch_related("permissions"):
        if dept.key == "admin":
            continue
        dept_perms = department_permission_codenames(dept)
        if is_strict_subset(dept_perms, actor_perms):
            assignable_ids.append(dept.pk)
    return queryset.filter(pk__in=assignable_ids)


def can_assign_department(actor: User, dept: Department | None) -> bool:
    if dept is None:
        return True
    if is_tenant_manager(actor):
        return True
    if dept.key == "admin":
        return False
    actor_perms = actor.effective_permission_codenames()
    dept_perms = department_permission_codenames(dept)
    return is_strict_subset(dept_perms, actor_perms)


def validate_self_no_escalation(
    actor: User,
    new_department: Department | None,
    new_extra_codenames: list[str] | None,
) -> None:
    current = actor.effective_permission_codenames()
    if new_extra_codenames is None:
        extras = list(actor.extra_permissions.values_list("codename", flat=True))
    else:
        extras = new_extra_codenames
    new_perms = effective_permissions_for(new_department, extras)
    if not new_perms <= current:
        raise ValidationError({"detail": _("You cannot increase your own permissions.")})


def assert_can_manage_target(
    actor: User,
    target: User,
    proposed_permissions: set[str] | None = None,
) -> None:
    if not can_manage_target(actor, target, proposed_permissions):
        raise PermissionDenied(_("You do not have permission to manage this user."))


def department_manageable_by(
    actor: User,
    dept: Department,
    proposed_codenames: list[str] | None = None,
) -> bool:
    if dept.key == "admin" and not is_tenant_manager(actor):
        return False
    if is_tenant_manager(actor):
        return True
    actor_perms = actor.effective_permission_codenames()
    dept_perms = (
        set(proposed_codenames)
        if proposed_codenames is not None
        else department_permission_codenames(dept)
    )
    return is_strict_subset(dept_perms, actor_perms)


def assert_department_manageable(
    actor: User,
    dept: Department,
    proposed_codenames: list[str] | None = None,
) -> None:
    if not department_manageable_by(actor, dept, proposed_codenames):
        raise PermissionDenied(_("You do not have permission to manage this department."))

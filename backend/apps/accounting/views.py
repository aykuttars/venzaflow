from apps.common.viewsets import TenantScopedViewSet
from apps.accounting.models import Account, Expense, Transaction
from apps.accounting.serializers import AccountSerializer, ExpenseSerializer, TransactionSerializer


class AccountViewSet(TenantScopedViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    required_module = "accounting"
    action_permission_map = {
        "list": "accounting.read",
        "retrieve": "accounting.read",
        "create": "accounting.write",
        "update": "accounting.write",
        "partial_update": "accounting.write",
        "destroy": "accounting.write",
    }
    search_fields = ("code", "name")
    ordering_fields = ("code",)


class ExpenseViewSet(TenantScopedViewSet):
    queryset = Expense.objects.select_related("account", "tenant")
    serializer_class = ExpenseSerializer
    required_module = "accounting"
    action_permission_map = {
        "list": "accounting.read",
        "retrieve": "accounting.read",
        "create": "accounting.write",
        "update": "accounting.write",
        "partial_update": "accounting.write",
        "destroy": "accounting.write",
    }
    ordering_fields = ("incurred_on", "amount")


class TransactionViewSet(TenantScopedViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    required_module = "accounting"
    action_permission_map = {
        "list": "accounting.read",
        "retrieve": "accounting.read",
        "create": "accounting.write",
        "update": "accounting.write",
        "partial_update": "accounting.write",
        "destroy": "accounting.write",
    }
    filterset_fields = ("kind",)
    ordering_fields = ("occurred_at", "amount")

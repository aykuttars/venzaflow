from rest_framework import serializers

from apps.accounting.models import Account, Expense, Transaction


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ("id", "code", "name", "kind")


class ExpenseSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True, allow_null=True)

    class Meta:
        model = Expense
        fields = ("id", "account", "account_code", "description", "amount", "incurred_on")


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ("id", "kind", "amount", "description", "occurred_at")

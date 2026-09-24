import re

from django.utils import timezone
from rest_framework import serializers

from .models import (
    Action,
    Assessment,
    Company,
    Contact,
    FuturePlan,
    Interaction,
    Opportunity,
)


def _normalize_text(value):
    return " ".join(str(value or "").split()).strip()


def _normalize_phone(value):
    return re.sub(r"\D+", "", str(value or ""))


class ModelValidationMixin:
    def _validate_model(self, instance):
        try:
            instance.full_clean()
        except Exception as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise
        return instance

    def create(self, validated_data):
        return self._validate_model(self.Meta.model(**validated_data))

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        return self._validate_model(instance)

    def save(self, **kwargs):
        instance = super().save(**kwargs)
        if instance.pk is None:
            instance.save()
        else:
            instance.save()
        return instance


class CompanySerializer(ModelValidationMixin, serializers.ModelSerializer):
    primary_opportunity_id = serializers.UUIDField(read_only=True)

    def validate_name(self, value):
        normalized_name = _normalize_text(value).casefold()
        queryset = Company.objects.exclude(pk=getattr(self.instance, "pk", None))
        for company in queryset.iterator():
            if _normalize_text(company.name).casefold() == normalized_name:
                raise serializers.ValidationError(
                    "A company with this name already exists."
                )
        return value

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "industry",
            "website",
            "location",
            "source",
            "general_notes",
            "lifecycle_status",
            "primary_opportunity_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ContactSerializer(ModelValidationMixin, serializers.ModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        company = attrs.get("company") or getattr(self.instance, "company", None)
        if company is None:
            return attrs

        email = attrs.get("email", getattr(self.instance, "email", ""))
        phone = attrs.get("phone", getattr(self.instance, "phone", ""))
        queryset = Contact.objects.filter(company=company).exclude(pk=getattr(self.instance, "pk", None))

        if email:
            normalized_email = str(email).strip().lower()
            for contact in queryset.iterator():
                if str(contact.email or "").strip().lower() == normalized_email:
                    raise serializers.ValidationError(
                        {"email": "A contact with this email already exists for this company."}
                    )

        if phone:
            normalized_phone = _normalize_phone(phone)
            for contact in queryset.iterator():
                if _normalize_phone(contact.phone) == normalized_phone:
                    raise serializers.ValidationError(
                        {"phone": "A contact with this phone already exists for this company."}
                    )

        return attrs

    class Meta:
        model = Contact
        fields = [
            "id",
            "company",
            "name",
            "designation",
            "phone",
            "email",
            "whatsapp",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class OpportunitySerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Opportunity
        fields = [
            "id",
            "company",
            "title",
            "description",
            "estimated_value",
            "currency",
            "status",
            "priority",
            "expected_decision_date",
            "notes",
            "lost_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class InteractionSerializer(ModelValidationMixin, serializers.ModelSerializer):
    def validate_occurred_at(self, value):
        if value is None or timezone.is_aware(value):
            return value
        return timezone.make_aware(value, timezone.get_current_timezone())

    class Meta:
        model = Interaction
        fields = [
            "id",
            "company",
            "opportunity",
            "occurred_at",
            "interaction_type",
            "subject",
            "details",
            "outcome",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AssessmentSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = [
            "id",
            "opportunity",
            "thoughts",
            "concerns",
            "opportunity_level",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ActionSerializer(ModelValidationMixin, serializers.ModelSerializer):
    company_name = serializers.CharField(source="opportunity.company.name", read_only=True)
    opportunity_title = serializers.CharField(source="opportunity.title", read_only=True)

    class Meta:
        model = Action
        fields = [
            "id",
            "opportunity",
            "action_description",
            "due_date",
            "priority",
            "status",
            "completion_date",
            "notes",
            "company_name",
            "opportunity_title",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class FuturePlanSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = FuturePlan
        fields = [
            "id",
            "opportunity",
            "plan",
            "target_date",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

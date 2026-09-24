from datetime import date, timedelta

from django.db import transaction
from django.db.models import OuterRef, Q, Subquery
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (
    Action,
    Assessment,
    Company,
    Contact,
    FuturePlan,
    Interaction,
    Opportunity,
)
from .dashboard import dashboard_data
from .serializers import (
    ActionSerializer,
    AssessmentSerializer,
    CompanySerializer,
    ContactSerializer,
    InteractionSerializer,
    OpportunitySerializer,
    FuturePlanSerializer,
)

class OptionalPagePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class OptionalPaginationMixin:
    pagination_class = OptionalPagePagination

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        if "page" not in request.query_params and "page_size" not in request.query_params:
            return Response(self.get_serializer(queryset, many=True).data)
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)


class CompanyViewSet(OptionalPaginationMixin, viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    queryset = Company.objects.annotate(
        primary_opportunity_id=Subquery(
            Opportunity.objects.filter(company_id=OuterRef("pk"))
            .order_by("-created_at")
            .values("id")[:1]
        )
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        industry = self.request.query_params.get("industry")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(contacts__name__icontains=search)
                | Q(contacts__phone__icontains=search)
                | Q(contacts__whatsapp__icontains=search)
                | Q(contacts__email__icontains=search)
            ).distinct()
        if industry:
            queryset = queryset.filter(industry__iexact=industry)
        return queryset

    def destroy(self, request, *args, **kwargs):
        company = self.get_object()
        company.lifecycle_status = Company.LifecycleStatus.ARCHIVED
        company.save(update_fields=["lifecycle_status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContactViewSet(OptionalPaginationMixin, viewsets.ModelViewSet):
    serializer_class = ContactSerializer
    queryset = Contact.objects.select_related("company").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        company = self.request.query_params.get("company")
        search = self.request.query_params.get("search")
        if company:
            queryset = queryset.filter(company_id=company)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(designation__icontains=search)
            )
        return queryset


class OpportunityViewSet(OptionalPaginationMixin, viewsets.ModelViewSet):
    serializer_class = OpportunitySerializer
    queryset = Opportunity.objects.select_related("company").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        status = self.request.query_params.get("status")
        priority = self.request.query_params.get("priority")
        company = self.request.query_params.get("company")
        industry = self.request.query_params.get("industry")
        source = self.request.query_params.get("source")
        search = self.request.query_params.get("search")
        expected_decision_date = (
            self.request.query_params.get("due_date")
            or self.request.query_params.get("expected_decision_date")
        )
        if status:
            queryset = queryset.filter(status=status)
        if priority:
            queryset = queryset.filter(priority=priority)
        if company:
            queryset = queryset.filter(company_id=company)
        if industry:
            queryset = queryset.filter(company__industry__iexact=industry)
        if source:
            queryset = queryset.filter(company__source__iexact=source)
        if expected_decision_date:
            queryset = queryset.filter(expected_decision_date=expected_decision_date)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(company__name__icontains=search)
            )
        return queryset


class InteractionViewSet(OptionalPaginationMixin, viewsets.ModelViewSet):
    serializer_class = InteractionSerializer
    queryset = Interaction.objects.select_related("company", "opportunity").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        company = self.request.query_params.get("company")
        opportunity = self.request.query_params.get("opportunity")
        if company:
            queryset = queryset.filter(company_id=company)
        if opportunity:
            queryset = queryset.filter(opportunity_id=opportunity)
        return queryset


class AssessmentViewSet(OptionalPaginationMixin, viewsets.ModelViewSet):
    serializer_class = AssessmentSerializer
    queryset = Assessment.objects.select_related("opportunity").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        opportunity = self.request.query_params.get("opportunity")
        if opportunity:
            queryset = queryset.filter(opportunity_id=opportunity)
        return queryset


class ActionViewSet(OptionalPaginationMixin, viewsets.ModelViewSet):
    serializer_class = ActionSerializer
    queryset = Action.objects.select_related("opportunity").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        status = self.request.query_params.get("status")
        priority = self.request.query_params.get("priority")
        opportunity = self.request.query_params.get("opportunity")
        due_filter = self.request.query_params.get("due")
        if due_filter is None:
            for name in ("overdue", "today", "upcoming"):
                if self.request.query_params.get(name, "").lower() == "true":
                    due_filter = name
                    break
        if self.request.query_params.get("completed", "").lower() == "true":
            due_filter = "completed"
        if status:
            queryset = queryset.filter(status=status)
        if priority:
            queryset = queryset.filter(priority=priority)
        if opportunity:
            queryset = queryset.filter(opportunity_id=opportunity)
        if due_filter and due_filter != "completed":
            today = timezone.localdate()
            if due_filter == "overdue":
                queryset = queryset.filter(
                    due_date__lt=today,
                    status=Action.Status.OPEN,
                )
            elif due_filter == "today":
                queryset = queryset.filter(
                    due_date=today,
                    status=Action.Status.OPEN,
                )
            elif due_filter == "upcoming":
                queryset = queryset.filter(
                    due_date__gt=today,
                    status=Action.Status.OPEN,
                )
        elif due_filter == "completed":
            queryset = queryset.filter(status=Action.Status.COMPLETED)
        return queryset

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        with transaction.atomic():
            action_record = Action.objects.select_for_update().get(pk=pk)
            if action_record.status != Action.Status.COMPLETED:
                action_record.status = Action.Status.COMPLETED
                action_record.completion_date = timezone.now()
                action_record.full_clean()
                action_record.save(update_fields=["status", "completion_date", "updated_at"])
        return Response(self.get_serializer(action_record).data)


class FuturePlanViewSet(OptionalPaginationMixin, viewsets.ModelViewSet):
    serializer_class = FuturePlanSerializer
    queryset = FuturePlan.objects.select_related("opportunity", "opportunity__company").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        opportunity = self.request.query_params.get("opportunity")
        if opportunity:
            queryset = queryset.filter(opportunity_id=opportunity)
        return queryset


@api_view(["GET"])
def dashboard(request):
    return Response(dashboard_data(), status=status.HTTP_200_OK)

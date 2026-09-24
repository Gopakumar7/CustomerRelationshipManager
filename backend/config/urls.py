from django.urls import include, path
from rest_framework.routers import DefaultRouter

from crm.api import (
    ActionViewSet,
    AssessmentViewSet,
    CompanyViewSet,
    ContactViewSet,
    InteractionViewSet,
    OpportunityViewSet,
    FuturePlanViewSet,
)
from crm.views import health
from crm.api import dashboard

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="company")
router.register("contacts", ContactViewSet, basename="contact")
router.register("opportunities", OpportunityViewSet, basename="opportunity")
router.register("interactions", InteractionViewSet, basename="interaction")
router.register("assessments", AssessmentViewSet, basename="assessment")
router.register("actions", ActionViewSet, basename="action")
router.register("future-plans", FuturePlanViewSet, basename="future-plan")

urlpatterns = [
    path("api/v1/health/", health, name="health"),
    path("api/v1/dashboard/", dashboard, name="dashboard"),
    path("api/v1/", include(router.urls)),
]

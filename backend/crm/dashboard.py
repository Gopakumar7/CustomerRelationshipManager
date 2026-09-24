from datetime import timedelta

from django.utils import timezone

from .models import Action, Interaction, Opportunity
from .serializers import ActionSerializer, InteractionSerializer, OpportunitySerializer


def dashboard_data():
    today = timezone.localdate()
    upcoming_end = today + timedelta(days=7)
    open_actions = Action.objects.select_related(
        "opportunity", "opportunity__company"
    ).filter(status=Action.Status.OPEN)

    def action_queryset(queryset):
        return [
            {
                **ActionSerializer(action).data,
                "company_name": action.opportunity.company.name,
                "opportunity_title": action.opportunity.title,
                "opportunity_id": str(action.opportunity_id),
            }
            for action in queryset
        ]

    active_opportunities = Opportunity.objects.select_related("company").filter(
        status__in=[
            Opportunity.Status.IDENTIFIED,
            Opportunity.Status.QUALIFIED,
            Opportunity.Status.PROPOSAL,
            Opportunity.Status.NEGOTIATION,
            Opportunity.Status.PAUSED,
        ]
    ).order_by("company__name", "title")
    return {
        "overdue": action_queryset(
            open_actions.filter(due_date__lt=today).order_by("due_date", "-priority")
        ),
        "today": action_queryset(
            open_actions.filter(due_date=today).order_by("-priority", "created_at")
        ),
        "upcoming": action_queryset(
            open_actions.filter(
                due_date__gt=today,
                due_date__lte=upcoming_end,
            ).order_by("due_date", "-priority")
        ),
        "recent_activity": InteractionSerializer(
            Interaction.objects.select_related("company", "opportunity")
            .order_by("-occurred_at")[:10],
            many=True,
        ).data,
        "important_opportunities": [
            {
                **OpportunitySerializer(opportunity).data,
                "company_name": opportunity.company.name,
            }
            for opportunity in Opportunity.objects.select_related("company")
            .filter(
                priority=Opportunity.Priority.HIGH,
                status__in=[
                    Opportunity.Status.IDENTIFIED,
                    Opportunity.Status.QUALIFIED,
                    Opportunity.Status.PROPOSAL,
                    Opportunity.Status.NEGOTIATION,
                    Opportunity.Status.PAUSED,
                ],
            )
            .order_by("-updated_at")[:10]
        ],
        "opportunity_options": [
            {
                "id": str(opportunity.id),
                "title": opportunity.title,
                "company_name": opportunity.company.name,
            }
            for opportunity in active_opportunities
        ],
    }

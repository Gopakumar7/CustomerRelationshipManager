from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from crm.models import Action, Assessment, Company, Contact, FuturePlan, Interaction, Opportunity


@pytest.fixture
def company(db):
    return Company.objects.create(
        name="Example Company",
        industry="Software",
        source="Referral",
    )


@pytest.fixture
def opportunity(company):
    return Opportunity.objects.create(
        company=company,
        title="CRM opportunity",
        estimated_value=Decimal("12500.00"),
        expected_decision_date=date(2026, 10, 1),
    )


@pytest.mark.django_db
def test_company_and_contact_creation(company):
    contact = Contact.objects.create(
        company=company,
        name="Ada Lovelace",
        designation="Director",
        phone="+1 555 0100",
        email="ada@example.com",
        whatsapp="+1 555 0100",
    )

    assert company.name == "Example Company"
    assert company.created_at is not None
    assert company.updated_at is not None
    assert contact.company == company
    assert company.contacts.get() == contact


@pytest.mark.django_db
def test_required_fields_are_enforced(company):
    with pytest.raises(ValidationError):
        Company(name="").full_clean()

    with pytest.raises(ValidationError):
        Contact(company=company, name="").full_clean()

    with pytest.raises(ValidationError):
        Opportunity(company=company, title="").full_clean()

    with pytest.raises(ValidationError):
        Interaction(
            company=company,
            occurred_at=datetime.now(tz=timezone.utc),
            interaction_type=Interaction.InteractionType.CALL,
            subject="",
            details="",
        ).full_clean()


@pytest.mark.django_db
def test_opportunity_and_child_relationships(opportunity):
    interaction = Interaction.objects.create(
        company=opportunity.company,
        opportunity=opportunity,
        occurred_at=datetime(2026, 9, 18, 12, 30, tzinfo=timezone.utc),
        interaction_type=Interaction.InteractionType.MEETING,
        subject="Requirements meeting",
        details="Discussed requirements.",
        outcome="Proposal requested.",
    )
    assessment = Assessment.objects.create(
        opportunity=opportunity,
        thoughts="Strong fit.",
        concerns="Budget timing.",
        opportunity_level=Assessment.OpportunityLevel.HIGH,
    )
    action = Action.objects.create(
        opportunity=opportunity,
        action_description="Send proposal",
        due_date=date(2026, 9, 25),
        priority=Action.Priority.HIGH,
    )
    plan = FuturePlan.objects.create(
        opportunity=opportunity,
        plan="Revisit expansion after the first phase.",
    )

    assert opportunity.company.opportunities.get() == opportunity
    assert list(opportunity.interactions.all()) == [interaction]
    assert list(opportunity.assessments.all()) == [assessment]
    assert list(opportunity.actions.all()) == [action]
    assert list(opportunity.future_plans.all()) == [plan]


@pytest.mark.django_db
def test_interaction_can_be_company_level(company):
    interaction = Interaction.objects.create(
        company=company,
        occurred_at=datetime(2026, 9, 18, 12, tzinfo=timezone.utc),
        interaction_type=Interaction.InteractionType.EMAIL,
        subject="Introduction",
        details="Sent an introduction email.",
    )

    assert interaction.opportunity is None
    assert interaction.company == company


@pytest.mark.django_db
def test_interaction_rejects_opportunity_from_another_company(company, opportunity):
    other_company = Company.objects.create(name="Other Company")
    interaction = Interaction(
        company=other_company,
        opportunity=opportunity,
        occurred_at=datetime(2026, 9, 18, 12, tzinfo=timezone.utc),
        interaction_type=Interaction.InteractionType.CALL,
        subject="Call",
        details="Call attempt.",
    )

    with pytest.raises(ValidationError, match="must belong"):
        interaction.full_clean()


@pytest.mark.django_db
def test_lost_opportunity_requires_reason(company):
    opportunity = Opportunity(
        company=company,
        title="Lost opportunity",
        status=Opportunity.Status.LOST,
    )

    with pytest.raises(ValidationError, match="lost opportunity requires a reason"):
        opportunity.full_clean()

    opportunity.lost_reason = "Budget was frozen."
    opportunity.full_clean()


@pytest.mark.django_db
def test_action_status_transition_requires_and_clears_completion_date(opportunity):
    action = Action(
        opportunity=opportunity,
        action_description="Follow up",
        status=Action.Status.COMPLETED,
    )

    with pytest.raises(ValidationError, match="completion date"):
        action.full_clean()

    action.completion_date = datetime(2026, 9, 20, 12, tzinfo=timezone.utc)
    action.full_clean()
    action.save()

    action.status = Action.Status.OPEN
    action.completion_date = None
    action.full_clean()


@pytest.mark.django_db
def test_date_and_datetime_values_are_persisted(opportunity):
    occurred_at = datetime(2026, 9, 18, 8, 45, tzinfo=timezone.utc)
    decision_date = date(2026, 10, 15)

    interaction = Interaction.objects.create(
        company=opportunity.company,
        opportunity=opportunity,
        occurred_at=occurred_at,
        interaction_type=Interaction.InteractionType.CALL,
        subject="Follow-up call",
        details="Reviewed next steps.",
    )
    opportunity.expected_decision_date = decision_date
    opportunity.save()

    interaction.refresh_from_db()
    opportunity.refresh_from_db()
    assert interaction.occurred_at == occurred_at
    assert opportunity.expected_decision_date == decision_date


@pytest.mark.django_db
def test_cascade_deletion_removes_company_records(company, opportunity):
    Contact.objects.create(company=company, name="Contact")
    Interaction.objects.create(
        company=company,
        opportunity=opportunity,
        occurred_at=datetime.now(tz=timezone.utc),
        interaction_type=Interaction.InteractionType.NOTE,
        subject="Note",
        details="Details",
    )
    Assessment.objects.create(opportunity=opportunity, thoughts="Assessment")
    Action.objects.create(
        opportunity=opportunity,
        action_description="Action",
    )

    company.delete()

    assert Company.objects.count() == 0
    assert Contact.objects.count() == 0
    assert Opportunity.objects.count() == 0
    assert Interaction.objects.count() == 0
    assert Assessment.objects.count() == 0
    assert Action.objects.count() == 0


@pytest.mark.django_db
def test_database_rejects_missing_company_relationship():
    with pytest.raises(IntegrityError):
        Contact.objects.create(name="Orphan contact")

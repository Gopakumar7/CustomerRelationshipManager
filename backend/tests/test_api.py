from datetime import date, timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from crm.models import Action, Company, Opportunity


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def company(db):
    return Company.objects.create(
        name="Acme Software",
        industry="Software",
        source="Referral",
    )


@pytest.fixture
def second_company(db):
    return Company.objects.create(
        name="Beta Manufacturing",
        industry="Manufacturing",
    )


@pytest.fixture
def opportunity(company):
    return Opportunity.objects.create(
        company=company,
        title="CRM implementation",
        status=Opportunity.Status.QUALIFIED,
        priority=Opportunity.Priority.HIGH,
    )


def endpoint(name, pk=None):
    suffix = f"{pk}/" if pk else ""
    return f"/api/v1/{name}/{suffix}"


@pytest.mark.django_db
def test_company_list_and_retrieve(api_client, company):
    response = api_client.get(endpoint("companies"))

    assert response.status_code == 200
    assert response.data[0]["id"] == str(company.id)
    assert response.data[0]["name"] == company.name

    detail = api_client.get(endpoint("companies", company.id))
    assert detail.status_code == 200
    assert detail.data["industry"] == "Software"


@pytest.mark.django_db
def test_company_create_update_and_archive(api_client):
    created = api_client.post(
        endpoint("companies"),
        {"name": "New Company", "industry": "Healthcare"},
        format="json",
    )
    assert created.status_code == 201
    company_id = created.data["id"]

    updated = api_client.patch(
        endpoint("companies", company_id),
        {"location": "London"},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.data["location"] == "London"

    deleted = api_client.delete(endpoint("companies", company_id))
    assert deleted.status_code == 204

    company = Company.objects.get(pk=company_id)
    assert company.lifecycle_status == Company.LifecycleStatus.ARCHIVED


@pytest.mark.django_db
def test_duplicate_company_names_and_contact_details_are_rejected(api_client, company):
    duplicate_company = api_client.post(
        endpoint("companies"),
        {"name": "   ACME SOFTWARE   ", "industry": "Software"},
        format="json",
    )
    assert duplicate_company.status_code == 400
    assert "name" in duplicate_company.data

    contact = api_client.post(
        endpoint("contacts"),
        {
            "company": str(company.id),
            "name": "Grace Hopper",
            "phone": "+1 (555) 0100",
            "email": "grace@example.com",
        },
        format="json",
    )
    assert contact.status_code == 201

    duplicate_contact = api_client.post(
        endpoint("contacts"),
        {
            "company": str(company.id),
            "name": "Grace Hopper 2",
            "phone": "+1 555 0100",
            "email": "another@example.com",
        },
        format="json",
    )
    assert duplicate_contact.status_code == 400
    assert "phone" in duplicate_contact.data


@pytest.mark.django_db
def test_company_search_and_industry_filter(api_client, company, second_company):
    search = api_client.get(endpoint("companies"), {"search": "acme"})
    assert search.status_code == 200
    assert [item["id"] for item in search.data] == [str(company.id)]

    filtered = api_client.get(
        endpoint("companies"),
        {"industry": "manufacturing"},
    )
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.data] == [str(second_company.id)]


@pytest.mark.django_db
def test_company_search_matches_contact_name_phone_and_email(api_client, company):
    from crm.models import Contact

    Contact.objects.create(
        company=company,
        name="Grace Hopper",
        phone="555-1234",
        email="grace@example.com",
    )
    for term in ("Grace", "555-1234", "grace@example.com"):
        response = api_client.get(endpoint("companies"), {"search": term})
        assert response.status_code == 200
        assert [item["id"] for item in response.data] == [str(company.id)]


@pytest.mark.django_db
def test_contact_create_and_filter_by_company(api_client, company):
    created = api_client.post(
        endpoint("contacts"),
        {
            "company": str(company.id),
            "name": "Ada Lovelace",
            "designation": "Director",
            "email": "ada@example.com",
            "whatsapp": "+1 555 0100",
        },
        format="json",
    )
    assert created.status_code == 201

    listed = api_client.get(endpoint("contacts"), {"company": str(company.id)})
    assert listed.status_code == 200
    assert listed.data[0]["name"] == "Ada Lovelace"


@pytest.mark.django_db
def test_opportunity_create_update_search_and_filters(
    api_client, company, second_company, opportunity
):
    other = Opportunity.objects.create(
        company=second_company,
        title="Factory software",
        status=Opportunity.Status.PROPOSAL,
        priority=Opportunity.Priority.LOW,
    )

    response = api_client.get(
        endpoint("opportunities"),
        {"status": "qualified", "priority": "high"},
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.data] == [str(opportunity.id)]

    search = api_client.get(endpoint("opportunities"), {"search": "manufacturing"})
    assert search.status_code == 200
    assert [item["id"] for item in search.data] == [str(other.id)]

    updated = api_client.patch(
        endpoint("opportunities", opportunity.id),
        {"status": "lost", "lost_reason": "Budget frozen."},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.data["status"] == "lost"


@pytest.mark.django_db
def test_opportunity_filters_by_industry_source_and_decision_date(
    api_client, company, opportunity
):
    opportunity.expected_decision_date = date(2026, 10, 1)
    opportunity.save()
    response = api_client.get(
        endpoint("opportunities"),
        {
            "industry": "software",
            "source": "referral",
            "expected_decision_date": "2026-10-01",
        },
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.data] == [str(opportunity.id)]


@pytest.mark.django_db
def test_paginated_lists_return_metadata(api_client, company):
    response = api_client.get(endpoint("companies"), {"page": 1, "page_size": 1})

    assert response.status_code == 200
    assert set(response.data) == {"count", "next", "previous", "results"}
    assert response.data["count"] == 1
    assert len(response.data["results"]) == 1


@pytest.mark.django_db
def test_opportunity_invalid_data_returns_field_errors(api_client, company):
    response = api_client.post(
        endpoint("opportunities"),
        {
            "company": str(company.id),
            "title": "Invalid lost opportunity",
            "status": "lost",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "lost_reason" in response.data


@pytest.mark.django_db
def test_interaction_naive_datetime_uses_local_timezone(api_client, company, settings):
    settings.TIME_ZONE = "Asia/Kolkata"
    with timezone.override("Asia/Kolkata"):
        response = api_client.post(
            endpoint("interactions"),
            {
                "company": str(company.id),
                "occurred_at": "2026-09-18T20:00:00",
                "interaction_type": "meeting",
                "subject": "Local time",
                "details": "Discussed timezone handling.",
            },
            format="json",
        )

    assert response.status_code == 201
    assert response.data["occurred_at"].endswith("+05:30")


@pytest.mark.django_db
def test_company_listing_avoids_n_plus_one_queries(api_client, company):
    for idx in range(3):
        Opportunity.objects.create(
            company=company,
            title=f"Opportunity {idx}",
            status=Opportunity.Status.QUALIFIED,
        )

    with CaptureQueriesContext(connection) as context:
        response = api_client.get(endpoint("companies"))

    assert response.status_code == 200
    assert len(response.data) == 1
    assert len(context.captured_queries) <= 3


@pytest.mark.django_db
def test_interaction_create_and_relationship_validation(api_client, company, opportunity):
    created = api_client.post(
        endpoint("interactions"),
        {
            "company": str(company.id),
            "opportunity": str(opportunity.id),
            "occurred_at": "2026-09-18T12:00:00Z",
            "interaction_type": "meeting",
            "subject": "Discovery",
            "details": "Discussed requirements.",
        },
        format="json",
    )
    assert created.status_code == 201
    assert str(created.data["opportunity"]) == str(opportunity.id)

    other_company = Company.objects.create(name="Other Company")
    invalid = api_client.post(
        endpoint("interactions"),
        {
            "company": str(other_company.id),
            "opportunity": str(opportunity.id),
            "occurred_at": "2026-09-18T12:00:00Z",
            "interaction_type": "call",
            "subject": "Call",
            "details": "Call details.",
        },
        format="json",
    )
    assert invalid.status_code == 400
    assert "opportunity" in invalid.data


@pytest.mark.django_db
def test_assessment_create_and_delete(api_client, opportunity):
    created = api_client.post(
        endpoint("assessments"),
        {
            "opportunity": str(opportunity.id),
            "thoughts": "Strong fit.",
            "concerns": "Timing.",
            "opportunity_level": "high",
        },
        format="json",
    )
    assert created.status_code == 201

    deleted = api_client.delete(endpoint("assessments", created.data["id"]))
    assert deleted.status_code == 204


@pytest.mark.django_db
def test_future_plan_create_and_filter(api_client, opportunity):
    created = api_client.post(
        endpoint("future-plans"),
        {
            "opportunity": str(opportunity.id),
            "plan": "Revisit expansion next quarter.",
            "target_date": "2027-01-01",
            "status": "planned",
        },
        format="json",
    )

    assert created.status_code == 201
    listed = api_client.get(
        endpoint("future-plans"),
        {"opportunity": str(opportunity.id)},
    )
    assert listed.status_code == 200
    assert listed.data[0]["plan"] == "Revisit expansion next quarter."


@pytest.mark.django_db
def test_action_crud_and_due_date_filters(api_client, opportunity):
    today = timezone.localdate()
    actions = {
        "overdue": Action.objects.create(
            opportunity=opportunity,
            action_description="Overdue action",
            due_date=today - timedelta(days=1),
        ),
        "today": Action.objects.create(
            opportunity=opportunity,
            action_description="Today's action",
            due_date=today,
        ),
        "upcoming": Action.objects.create(
            opportunity=opportunity,
            action_description="Upcoming action",
            due_date=today + timedelta(days=1),
        ),
        "completed": Action.objects.create(
            opportunity=opportunity,
            action_description="Completed action",
            status=Action.Status.COMPLETED,
            completion_date=timezone.now(),
            due_date=today,
        ),
    }

    for filter_name, action in actions.items():
        response = api_client.get(endpoint("actions"), {"due": filter_name})
        assert response.status_code == 200
        assert [item["id"] for item in response.data] == [str(action.id)]

    boolean_alias = api_client.get(endpoint("actions"), {"overdue": "true"})
    assert [item["id"] for item in boolean_alias.data] == [str(actions["overdue"].id)]

    created = api_client.post(
        endpoint("actions"),
        {
            "opportunity": str(opportunity.id),
            "action_description": "New follow-up",
            "due_date": str(today),
            "priority": "high",
        },
        format="json",
    )
    assert created.status_code == 201
    updated = api_client.patch(
        endpoint("actions", created.data["id"]),
        {
            "status": "completed",
            "completion_date": "2026-09-18T12:00:00Z",
        },
        format="json",
    )
    assert updated.status_code == 200


@pytest.mark.django_db
def test_follow_up_filters_support_all_dashboard_buckets(api_client, opportunity):
    today = timezone.localdate()
    values = [
        ("overdue", today - timedelta(days=1), Action.Status.OPEN),
        ("today", today, Action.Status.OPEN),
        ("upcoming", today + timedelta(days=2), Action.Status.OPEN),
        ("completed", today, Action.Status.COMPLETED),
    ]
    created = [
        Action.objects.create(
            opportunity=opportunity,
            action_description=label,
            due_date=due_date,
            status=status,
            completion_date=timezone.now() if status == Action.Status.COMPLETED else None,
        )
        for label, due_date, status in values
    ]
    for (label, _, _), action in zip(values, created):
        response = api_client.get(endpoint("actions"), {"due": label})
        assert response.status_code == 200
        assert [item["id"] for item in response.data] == [str(action.id)]


@pytest.mark.django_db
def test_dashboard_groups_actions_and_excludes_completed(api_client, opportunity, company):
    today = timezone.localdate()
    overdue = Action.objects.create(
        opportunity=opportunity,
        action_description="Overdue",
        due_date=today - timedelta(days=1),
    )
    due_today = Action.objects.create(
        opportunity=opportunity,
        action_description="Today",
        due_date=today,
    )
    upcoming = Action.objects.create(
        opportunity=opportunity,
        action_description="Upcoming",
        due_date=today + timedelta(days=3),
    )
    Action.objects.create(
        opportunity=opportunity,
        action_description="Done",
        due_date=today,
        status=Action.Status.COMPLETED,
        completion_date=timezone.now(),
    )

    response = api_client.get("/api/v1/dashboard/")

    assert response.status_code == 200
    assert [item["id"] for item in response.data["overdue"]] == [str(overdue.id)]
    assert [item["id"] for item in response.data["today"]] == [str(due_today.id)]
    assert [item["id"] for item in response.data["upcoming"]] == [str(upcoming.id)]
    assert response.data["overdue"][0]["company_name"] == company.name
    assert response.data["overdue"][0]["opportunity_title"] == opportunity.title


@pytest.mark.django_db
def test_dashboard_timezone_boundary_uses_local_date(api_client, opportunity, settings):
    settings.TIME_ZONE = "Asia/Kolkata"
    with timezone.override("Asia/Kolkata"):
        local_today = timezone.localdate()
        action = Action.objects.create(
            opportunity=opportunity,
            action_description="Local today",
            due_date=local_today,
        )

        response = api_client.get("/api/v1/dashboard/")

    assert [item["id"] for item in response.data["today"]] == [str(action.id)]


@pytest.mark.django_db
def test_action_complete_endpoint_is_atomic_under_concurrency(api_client, opportunity):
    action = Action.objects.create(
        opportunity=opportunity,
        action_description="Complete under concurrency",
        due_date=timezone.localdate(),
    )

    responses = [
        api_client.post(f"/api/v1/actions/{action.id}/complete/"),
        api_client.post(f"/api/v1/actions/{action.id}/complete/"),
    ]

    assert all(response.status_code == 200 for response in responses)
    action.refresh_from_db()
    assert action.status == Action.Status.COMPLETED
    assert action.completion_date is not None


@pytest.mark.django_db
def test_action_complete_endpoint_records_timestamp(api_client, opportunity):
    action = Action.objects.create(
        opportunity=opportunity,
        action_description="Complete me",
        due_date=timezone.localdate(),
    )

    response = api_client.post(f"/api/v1/actions/{action.id}/complete/")

    assert response.status_code == 200
    assert response.data["status"] == Action.Status.COMPLETED
    assert response.data["completion_date"] is not None
    action.refresh_from_db()
    assert action.status == Action.Status.COMPLETED
    assert action.completion_date is not None


@pytest.mark.django_db
def test_nonexistent_records_return_not_found(api_client):
    missing_id = "00000000-0000-0000-0000-000000000000"

    assert api_client.get(endpoint("companies", missing_id)).status_code == 404
    assert api_client.patch(
        endpoint("actions", missing_id),
        {"notes": "No record"},
        format="json",
    ).status_code == 404
    assert api_client.delete(endpoint("opportunities", missing_id)).status_code == 404

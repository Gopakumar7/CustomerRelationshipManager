import uuid

from django.core.exceptions import ValidationError
from django.db import models


class TimestampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Company(TimestampedModel):
    class LifecycleStatus(models.TextChoices):
        PROSPECT = "prospect", "Prospect"
        CUSTOMER = "customer", "Customer"
        INACTIVE = "inactive", "Inactive"
        ARCHIVED = "archived", "Archived"

    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=150, blank=True)
    website = models.URLField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=100, blank=True)
    general_notes = models.TextField(blank=True)
    lifecycle_status = models.CharField(
        max_length=20,
        choices=LifecycleStatus.choices,
        default=LifecycleStatus.PROSPECT,
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["lifecycle_status"]),
        ]

    def __str__(self):
        return self.name


class Contact(TimestampedModel):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="contacts",
    )
    name = models.CharField(max_length=255)
    designation = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    whatsapp = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["company", "name"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        return self.name


class Opportunity(TimestampedModel):
    class Status(models.TextChoices):
        IDENTIFIED = "identified", "Identified"
        QUALIFIED = "qualified", "Qualified"
        PROPOSAL = "proposal", "Proposal"
        NEGOTIATION = "negotiation", "Negotiation"
        WON = "won", "Won"
        LOST = "lost", "Lost"
        PAUSED = "paused", "Paused"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="opportunities",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    estimated_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    currency = models.CharField(max_length=3, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IDENTIFIED,
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    expected_decision_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    lost_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["expected_decision_date"]),
        ]

    def clean(self):
        if self.status == self.Status.LOST and not self.lost_reason.strip():
            raise ValidationError({"lost_reason": "A lost opportunity requires a reason."})
        if self.status != self.Status.LOST and self.lost_reason.strip():
            raise ValidationError(
                {"lost_reason": "A lost reason is only valid for lost opportunities."}
            )

    def __str__(self):
        return self.title


class Interaction(TimestampedModel):
    class InteractionType(models.TextChoices):
        CALL = "call", "Call"
        EMAIL = "email", "Email"
        MEETING = "meeting", "Meeting"
        MESSAGE = "message", "Message"
        DEMO = "demo", "Demo"
        NOTE = "note", "Note"
        OTHER = "other", "Other"

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="interactions",
    )
    opportunity = models.ForeignKey(
        Opportunity,
        on_delete=models.CASCADE,
        related_name="interactions",
        null=True,
        blank=True,
    )
    occurred_at = models.DateTimeField()
    interaction_type = models.CharField(
        max_length=20,
        choices=InteractionType.choices,
    )
    subject = models.CharField(max_length=255)
    details = models.TextField()
    outcome = models.TextField(blank=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["company", "-occurred_at"]),
            models.Index(fields=["opportunity", "-occurred_at"]),
        ]

    def clean(self):
        if self.opportunity_id and self.opportunity.company_id != self.company_id:
            raise ValidationError(
                {"opportunity": "The opportunity must belong to the interaction's company."}
            )


class Assessment(TimestampedModel):
    class OpportunityLevel(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    opportunity = models.ForeignKey(
        Opportunity,
        on_delete=models.CASCADE,
        related_name="assessments",
    )
    thoughts = models.TextField()
    concerns = models.TextField(blank=True)
    opportunity_level = models.CharField(
        max_length=10,
        choices=OpportunityLevel.choices,
        default=OpportunityLevel.MEDIUM,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["opportunity", "-created_at"]),
        ]


class Action(TimestampedModel):
    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    opportunity = models.ForeignKey(
        Opportunity,
        on_delete=models.CASCADE,
        related_name="actions",
    )
    action_description = models.TextField()
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    completion_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["status", "due_date", "-created_at"]
        indexes = [
            models.Index(fields=["opportunity", "status"]),
            models.Index(fields=["status", "due_date"]),
        ]

    def clean(self):
        if self.status == self.Status.COMPLETED and self.completion_date is None:
            raise ValidationError(
                {"completion_date": "A completed action requires a completion date."}
            )
        if self.status != self.Status.COMPLETED and self.completion_date is not None:
            raise ValidationError(
                {
                    "completion_date": (
                        "Only completed actions can have a completion date."
                    )
                }
            )


class FuturePlan(TimestampedModel):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        ABANDONED = "abandoned", "Abandoned"

    opportunity = models.ForeignKey(
        Opportunity,
        on_delete=models.CASCADE,
        related_name="future_plans",
    )
    plan = models.TextField()
    target_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNED,
    )

    class Meta:
        ordering = ["status", "target_date", "-created_at"]
        indexes = [
            models.Index(fields=["opportunity", "status"]),
            models.Index(fields=["target_date"]),
        ]

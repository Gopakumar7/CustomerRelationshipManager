# Personal CRM Architecture Proposal

## 1. Goals and guiding principles

This application is a local-first, single-user CRM for managing prospects and the
business opportunities associated with them. The first version should optimize for:

- Fast entry and retrieval on one Windows laptop.
- A clear timeline of what actually happened.
- A clear separation between facts, personal interpretation, and planned work.
- A small, conventional technology stack that can later be extracted into a
  MindZ business module.
- Explicit data ownership and straightforward backups.

The initial system should be a local Django application exposing a REST API to a
Vite/React frontend. PostgreSQL is the source of truth. There is no need for
multi-tenant infrastructure, background job infrastructure, real-time updates,
external integrations, or offline synchronization in the first release.

“Local-first” means the application is usable without an internet connection and
all primary data is stored locally. It does not require a second client-side
database or synchronization protocol at this stage.

## 2. Overall architecture

Use a modular monolith:

```text
React + TypeScript + Vite + Tailwind CSS
                |
                | JSON over HTTP (same-machine development/runtime)
                v
Django + Django REST Framework
                |
                v
           PostgreSQL
```

### Backend

Organize the Django project into a CRM domain app rather than scattering logic
across generic utility apps. A possible initial boundary is `crm`, containing:

- Models and relationships.
- Serializers and API views/viewsets.
- Domain validation.
- Filtering, ordering, and pagination.
- API tests.

Keep the API and domain model independent of browser-specific concerns so the
CRM can later be mounted inside a larger MindZ backend.

### Frontend

Use a feature-oriented React structure. Keep pages, reusable UI components, API
client functions, and domain types separate. The frontend should call the
backend through a small typed API client rather than embedding fetch calls in
individual components.

For the first version, use local React state for form state and a small server
data layer for loading and invalidating API data. Avoid introducing a global
state framework until there is a demonstrated need for shared client state.

### Runtime

For local development, run PostgreSQL, Django, and Vite as separate processes.
In a later convenience step, provide a simple local startup script or
Docker Compose configuration, but do not make containers a prerequisite for
understanding or using the application.

## 3. Domain model

The domain should distinguish the following concepts:

### Company / customer

The organization or individual being pursued. This is factual identity and
contact information, not an opportunity or an opinion.

Suggested fields:

- Name (required).
- Type: company or individual.
- Website.
- Industry.
- Location.
- Phone and general email.
- Address.
- Notes for factual/general information only.
- Lifecycle status: prospect, customer, inactive, or archived.
- Created and updated timestamps.

The term “company” can remain the internal entity name while supporting
individual prospects through the type field.

### Contact

A person associated with a company/customer.

Suggested fields:

- Company/customer reference (required).
- Full name (required).
- Job title.
- Email.
- Phone.
- Preferred contact method.
- Is primary contact.
- Factual notes.
- Created and updated timestamps.

A company can have many contacts. Contact information belongs here, not in an
interaction or assessment record.

### Opportunity

A potential piece of business involving a company/customer. A company may have
multiple opportunities over time.

Suggested fields:

- Company/customer reference (required).
- Name/title (required).
- Description of the potential business.
- Estimated value and currency (optional).
- Expected close date (optional).
- Status: identified, qualified, proposal, negotiation, won, lost, or paused.
- Lost reason (required when status is lost).
- Created and updated timestamps.

An opportunity is the main unit for tracking progress and status. Company-level
relationships and interactions may exist even when they are not tied to one
specific opportunity.

### Interaction

A factual record of something that happened or was attempted. It must not be
used as a substitute for an assessment or a future plan.

Suggested fields:

- Company/customer reference (required).
- Optional opportunity reference.
- Optional contact reference.
- Interaction type: call, email, meeting, message, demo, note, or other.
- Occurred at (required).
- Direction: inbound, outbound, or internal.
- Subject.
- Summary of what was said/done (factual).
- Outcome.
- Created timestamp.

Interactions are append-oriented history. Editing should be allowed for
corrections, but the UI should make it easy to add a new interaction rather
than rewriting history.

### Assessment

My personal interpretation of the prospect or opportunity at a point in time.
This is explicitly subjective and must not be mixed into factual company or
interaction fields.

Suggested fields:

- Company/customer reference (required).
- Optional opportunity reference.
- Assessment text (required).
- Confidence: low, medium, or high (optional).
- Created at and updated at.

Use one current assessment per opportunity in the simplest first version, with
an optional company-level assessment when no opportunity exists. If preserving
assessment history becomes important, evolve this to a versioned assessment
history without changing the core distinction.

### Next action

The concrete action I currently believe should happen next. This is separate
from an assessment: the assessment explains my thinking; the next action says
what I intend to do.

Suggested fields:

- Company/customer reference (required).
- Optional opportunity reference.
- Action title (required).
- Action details.
- Due date (optional).
- Status: open, completed, or cancelled.
- Completed at (optional).
- Created and updated timestamps.

The first version can support one current open next action per opportunity.
Allow company-level actions for work not tied to one opportunity. Enforce this
rule in the domain/service layer if the UI presents a single “next action”
field.

### Future plan

A longer-horizon intention or planned direction, distinct from the immediate
next action.

Suggested fields:

- Company/customer reference (required).
- Optional opportunity reference.
- Plan text (required).
- Target date (optional).
- Status: planned, active, completed, or abandoned.
- Created and updated timestamps.

Examples include “revisit partnership after their budget cycle” or “introduce
the enterprise offering next quarter.” A future plan should not be represented
as an interaction or hidden in free-form assessment text.

### Reminder

A date-based prompt that requires attention. A reminder may point to a next
action, opportunity, company, contact, or stand alone.

Suggested fields:

- Title (required).
- Due at (required).
- Optional company, opportunity, contact, or next-action reference.
- Status: pending, dismissed, or completed.
- Notes.
- Created and updated timestamps.

Do not introduce a notification delivery service initially. The application can
show due and overdue reminders when opened.

## 4. Database entities and relationships

Use PostgreSQL with UUID primary keys, timezone-aware timestamps, and database
constraints for important invariants.

Core tables:

- `companies`
- `contacts`
- `opportunities`
- `interactions`
- `assessments`
- `next_actions`
- `future_plans`
- `reminders`

Relationships:

```text
Company 1 ---- * Contact
Company 1 ---- * Opportunity
Company 1 ---- * Interaction
Company 1 ---- * Assessment
Company 1 ---- * NextAction
Company 1 ---- * FuturePlan
Company 1 ---- * Reminder

Opportunity 1 ---- * Interaction
Opportunity 1 ---- * Assessment
Opportunity 1 ---- * NextAction
Opportunity 1 ---- * FuturePlan
Opportunity 1 ---- * Reminder

Contact 1 ---- * Interaction
Contact 1 ---- * Reminder
NextAction 1 ---- * Reminder (optional)
```

Use nullable foreign keys where a record can validly be company-level. Enforce
that an opportunity or contact belongs to the same company as the parent
record. Prefer soft archival through status fields over destructive deletion
for companies, opportunities, and interactions. A deliberate delete endpoint
can be added later with stronger confirmation and audit requirements.

Recommended indexes:

- Company name.
- Opportunity status and expected close date.
- Interaction occurred-at descending.
- Reminder status and due-at.
- Open next actions by due date.

## 5. REST API structure

Prefix the API with `/api/v1/` from the beginning to leave room for compatible
future versions.

Resource endpoints:

```text
GET    /api/v1/companies
POST   /api/v1/companies
GET    /api/v1/companies/{id}
PATCH  /api/v1/companies/{id}

GET    /api/v1/contacts
POST   /api/v1/contacts
GET    /api/v1/contacts/{id}
PATCH  /api/v1/contacts/{id}

GET    /api/v1/opportunities
POST   /api/v1/opportunities
GET    /api/v1/opportunities/{id}
PATCH  /api/v1/opportunities/{id}

GET    /api/v1/interactions
POST   /api/v1/interactions
GET    /api/v1/interactions/{id}
PATCH  /api/v1/interactions/{id}

GET    /api/v1/assessments
POST   /api/v1/assessments
PATCH  /api/v1/assessments/{id}

GET    /api/v1/next-actions
POST   /api/v1/next-actions
PATCH  /api/v1/next-actions/{id}

GET    /api/v1/future-plans
POST   /api/v1/future-plans
PATCH  /api/v1/future-plans/{id}

GET    /api/v1/reminders
POST   /api/v1/reminders
PATCH  /api/v1/reminders/{id}
```

Also provide read-focused endpoints that map directly to common screens:

```text
GET /api/v1/dashboard
GET /api/v1/companies/{id}/summary
GET /api/v1/opportunities/{id}/timeline
```

The company summary should combine factual details, contacts, opportunities,
open actions, plans, reminders, and recent interactions while keeping those
sections separately labeled. The timeline should return interactions ordered
by occurred time and should not silently merge assessments or plans into
interaction text.

Support simple query parameters:

- `search` for company/contact/opportunity text.
- `status` for status filtering.
- `company` and `opportunity` for relationship filtering.
- `due_before`, `due_after`, and `overdue` for reminders/actions.
- `ordering` with an allowlist.
- `page` and `page_size` if result sets grow.

Return consistent validation errors using DRF’s standard field error shape.
Use ISO 8601 timestamps and explicit currency/value fields. Since the first
version is single-user and local, authentication can be deferred, but the API
boundary should not assume that every future caller is trusted.

## 6. Frontend page structure

Keep the first information architecture small:

1. **Dashboard**
   - Overdue and upcoming reminders.
   - Open next actions.
   - Opportunities by status.
   - Recently updated companies and interactions.

2. **Companies**
   - Searchable company list.
   - Filters by lifecycle status.
   - Create/edit company form.

3. **Company detail**
   - Factual company information.
   - Contacts.
   - Opportunities.
   - Recent interaction timeline.
   - Current assessment.
   - Current next action.
   - Future plans.
   - Reminders.

4. **Opportunity detail**
   - Opportunity facts and status.
   - Linked contacts.
   - Interaction timeline.
   - Assessment.
   - Next action.
   - Future plans and reminders.

5. **Global reminders/actions**
   - A focused list of due and upcoming work.

Use focused forms or drawers for adding interactions, assessments, actions,
plans, and reminders. Do not make the user navigate away from the company or
opportunity context to record a follow-up.

## 7. Navigation structure

Use a simple persistent sidebar:

```text
Dashboard
Companies
Opportunities
Tasks & Reminders
```

Within a company, use tabs or clearly separated sections:

```text
Overview | Contacts | Opportunities | Interactions | Planning
```

The overview should prioritize the next decision: what is known, what I think,
what I will do next, and what is planned later. Keep the visual labels
“Facts,” “Interactions,” “My assessment,” “Next action,” and “Future plan”
explicit so these concepts cannot be confused.

## 8. State management approach

Use three categories of state:

- **Server state:** companies, contacts, opportunities, and all CRM records.
  Fetch through a small API/data-access layer and invalidate or refetch after
  mutations.
- **Form state:** keep local to each form using React state or the simplest
  existing form abstraction. Forms should own dirty state and submission
  errors.
- **UI state:** selected tab, drawer visibility, filters, and temporary
  notifications can remain local to the relevant page/layout.

Avoid Redux, a client-side database, event sourcing, and optimistic updates in
the first version. Optimistic updates are unnecessary for a local application
and can make validation failures harder to understand. If repeated server
state patterns emerge, add one dedicated server-state library rather than
several overlapping solutions.

## 9. Validation rules

Apply validation in both the frontend for usability and the backend for
correctness. Backend rules are authoritative.

General rules:

- Required names/titles and non-empty meaningful text.
- Trim leading/trailing whitespace.
- Normalize email addresses to lowercase for comparison/storage where
  appropriate.
- Validate email, URL, phone, date, and currency formats without overrestricting
  legitimate international values.
- Store timestamps with timezone information.
- Reject references to records belonging to a different company.

Domain rules:

- A contact must belong to a company.
- An opportunity must belong to a company.
- An interaction must have an occurred time and factual summary; it may link to
  a company, opportunity, and contact.
- A linked contact must belong to the interaction’s company.
- A lost opportunity requires a lost reason.
- A completed next action requires a completed timestamp.
- A reminder requires a due time and title.
- An assessment is subjective text and must be labeled as such in the UI.
- A next action is an actionable statement, not a status update or assessment.
- A future plan has a longer-horizon intent and should not be required to have
  an immediate due date.

Avoid making estimated value, expected close date, phone, or email mandatory
unless actual usage proves they are always available.

## 10. Testing strategy

### Backend: pytest + pytest-django

Test in layers:

- Model tests for constraints, defaults, relationships, and status rules.
- Serializer tests for field validation and cross-company relationship checks.
- API tests for CRUD behavior, filtering, ordering, pagination, and error
  responses.
- Service/domain tests for transitions such as marking an opportunity lost or
  completing a next action.
- Dashboard/summary/timeline tests to ensure the response keeps facts,
  interactions, assessments, actions, plans, and reminders distinct.

Use factories or small fixtures to keep test data readable. Test timezone
behavior explicitly.

### Frontend: Vitest + React Testing Library

Test:

- Page rendering and loading/error/empty states.
- Forms, validation messages, and successful submissions.
- Company detail section labels and separation of content types.
- Filters and status changes.
- Reminder and next-action completion behavior.

Prefer user-visible behavior over implementation details. Mock the API at the
boundary.

### End-to-end: Playwright

Start with a small set of critical journeys:

1. Create a company and contact.
2. Create an opportunity and change its status.
3. Record an interaction.
4. Add an assessment, next action, and future plan.
5. Create and complete a reminder.
6. Reopen the company and verify the data remains in the correct sections.

Run E2E tests against an isolated test database and deterministic local
services. Keep the suite small and high-value initially.

## 11. Local development strategy

Use a documented Windows-friendly setup:

1. Install a supported Python version, Node.js, and PostgreSQL.
2. Create a Python virtual environment.
3. Install backend dependencies from a pinned requirements/lock file.
4. Install frontend dependencies from the package lock file.
5. Create a local `.env` file from a documented example; never commit secrets.
6. Create the PostgreSQL database and run Django migrations.
7. Start Django and Vite in separate terminals.

Use environment variables for database URL, Django secret key, debug mode,
allowed hosts, and frontend API base URL. Keep development, test, and future
production settings separable. Add a health endpoint such as
`/api/v1/health` for local diagnostics.

The development server can use Vite’s proxy to route `/api` requests to
Django, avoiding CORS complexity during local development. A later packaged
local distribution can build the frontend and serve static assets through
Django or a small local reverse proxy.

## 12. Backup strategy

PostgreSQL remains the authoritative local data store. The initial backup plan
should be explicit and easy to operate:

- Provide a documented `pg_dump` command for a complete logical backup.
- Store backups outside the project directory, preferably on a second local
  drive or encrypted cloud storage.
- Use timestamped backup filenames.
- Keep multiple rotating copies, such as daily backups for a week and weekly
  backups for a month.
- Do not include `.env` files or credentials in backups.
- Periodically perform a restore into a separate local database and verify that
  the application can read it.

An in-app export/import feature can later produce a versioned JSON or CSV
archive, but it should not replace a real PostgreSQL backup. If cloud backup is
introduced, encrypt before upload and make the destination an explicit user
choice.

## 13. Future extensibility

Design for extension without implementing it now:

- Keep `/api/v1` and domain-oriented serializers stable.
- Use UUIDs and explicit timestamps.
- Keep CRM domain logic in an app that can later be mounted in MindZ.
- Avoid coupling models to UI route names.
- Keep company, contact, opportunity, and activity concepts generic enough for
  future accounts or workspaces.
- Add authentication, authorization, and tenant/workspace ownership before
  exposing the API beyond the local user.
- Add an audit log if multiple users or compliance requirements appear.
- Add configurable custom fields only after the fixed model proves
  insufficient.
- Add email/calendar integrations through explicit integration adapters, not
  by putting provider-specific fields into core entities.
- Add notification scheduling only when passive reminders are no longer
  sufficient.
- Preserve the distinction between factual records, subjective assessments,
  immediate next actions, and longer-term plans in any future reporting or
  automation module.

Potential later modules include activity templates, pipeline reporting,
calendar sync, email capture, document attachments, team collaboration,
permissions, and workspace-level settings. None is required for the initial
single-user CRM.

## 14. Deliberate first-version scope

The first implementation should include:

- Company and contact management.
- Opportunity management with a small fixed status set.
- Interaction timeline.
- One current assessment per company/opportunity context.
- Open/completed next actions.
- Future plans.
- Reminders shown on the dashboard and task list.
- Search, basic filters, and a useful company detail page.
- PostgreSQL persistence, migrations, validation, tests, and documented local
  backups.

Defer authentication, multi-user access, attachments, email/calendar sync,
notifications outside the application, custom fields, analytics dashboards,
offline synchronization, and deployment automation until real usage
demonstrates a need for them.

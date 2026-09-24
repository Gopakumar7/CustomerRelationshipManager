# QA Review

## Scope and approach

This was a read-only review of the Django/DRF backend, React frontend, Docker
configuration, API surface, model relationships, and Playwright coverage. The
review focused on the requested failure modes and security concerns. No
application code or data was changed.

Severity:

- **Critical**: straightforward compromise or destructive impact.
- **High**: significant data exposure, data loss, or common workflow failure.
- **Medium**: material correctness, reliability, or usability problem.
- **Low**: limited impact or edge-case behavior.

## Findings

### QA-01 — Unauthenticated CRUD API is exposed on the host

- **Severity:** High
- **Issue:** Every CRM endpoint permits unauthenticated list, create, update,
  and delete requests. No authentication or permission classes are configured.
  Docker publishes PostgreSQL and Django ports on all host interfaces.
- **Evidence:** `backend/config/settings.py` configures no DRF default
  authentication or permission policy; `backend/config/urls.py` registers
  `ModelViewSet`s directly; `docker-compose.yml` publishes ports `8000` and
  `5432` as `0.0.0.0` bindings.
- **Reproduction steps:**
  1. Start the Compose stack.
  2. From another machine on the same network, send
     `GET http://<laptop-ip>:8000/api/v1/companies/`.
  3. Send an unauthenticated `DELETE` to a known company UUID.
  4. Observe that the API does not require a user, token, or session.
- **Recommended fix:** Keep the local single-user mode explicit, but bind
  services to `127.0.0.1` by default and add authentication/permissions before
  any non-local deployment. At minimum, document that exposing port 8000 is
  unsafe and add a deployment-safe permission configuration.

### QA-02 — Debug mode and fallback secret are unsafe defaults

- **Severity:** High
- **Issue:** `DEBUG` defaults to true and the Django secret key falls back to a
  known literal value. If the application is run with omitted or incomplete
  environment variables, error pages can disclose configuration, paths, and
  stack traces, while the predictable secret weakens signed-cookie and
  cryptographic protections.
- **Evidence:** `backend/config/settings.py:6-7`.
- **Reproduction steps:**
  1. Unset `DJANGO_DEBUG` and `DJANGO_SECRET_KEY`.
  2. Start Django.
  3. Trigger a server error or visit a malformed endpoint.
  4. Observe development-mode behavior and the deterministic fallback secret.
- **Recommended fix:** Default `DEBUG` to false outside an explicitly selected
  development profile and fail startup when a production secret is absent or
  unchanged. Do not ship a known fallback secret in a deployable configuration.

### QA-03 — Interaction datetime loses the user's timezone

- **Severity:** High
- **Issue:** The interaction form uses `datetime-local`, which has no timezone
  offset, but the backend stores timezone-aware datetimes in UTC. The entered
  wall-clock time is therefore interpreted as UTC rather than as the user's
  local time.
- **Evidence:** `frontend/src/App.tsx:438` submits the raw `datetime-local`
  value; `backend/config/settings.py` sets `USE_TZ = True` and
  `TIME_ZONE = "UTC"`.
- **Reproduction steps:**
  1. Use a browser configured for a non-UTC timezone such as
     `Asia/Kolkata`.
  2. Add an interaction at `2026-09-18 20:00`.
  3. Reload the opportunity detail.
  4. Observe that the timeline displays a shifted time (typically several
     hours later), because the naive value was treated as UTC.
- **Recommended fix:** Convert the browser-local value to an ISO timestamp with
  an explicit offset before submission, or collect a timezone-aware timestamp
  using a shared date/time helper. Add tests around DST and non-UTC zones.

### QA-04 — List API failures produce a blank/incorrect page

- **Severity:** High
- **Issue:** Prospect, opportunity, and follow-up list requests have no rejection
  handler. On a network interruption, 500 response, database outage, or invalid
  pagination response, the promise rejects and only `loading` is cleared. The
  UI then renders no error state, leaving the user with an empty area that
  looks like an empty database.
- **Evidence:** `frontend/src/App.tsx:178`, `frontend/src/App.tsx:197`, and
  `frontend/src/App.tsx:209` use `.then(...).finally(...)` without `.catch(...)`.
- **Reproduction steps:**
  1. Open `/?view=prospects`.
  2. Block `/api/v1/companies/` in browser DevTools or stop the backend.
  3. Wait for the request to fail.
  4. Observe that no actionable error message or retry control is shown.
- **Recommended fix:** Add explicit request error state to each list page,
  distinguish an empty successful response from a failed request, and provide a
  retry action. Abort stale requests when filters change.

### QA-05 — Create-form failures are unhandled and can leave misleading state

- **Severity:** High
- **Issue:** `submitRecord` awaits the POST without a `try/catch`. Validation,
  network, and server failures become unhandled promise rejections. The modal
  remains open without an inline error, and the user cannot tell whether the
  record was persisted.
- **Evidence:** `frontend/src/App.tsx:319-330`; the modal form invokes
  `void submitRecord(event)` at line 438.
- **Reproduction steps:**
  1. Open an opportunity and click **Add interaction**.
  2. Stop the backend or use DevTools to return HTTP 500 for the POST.
  3. Submit the form.
  4. Observe no user-facing error or retry guidance.
- **Recommended fix:** Track `submitting` and `formError` state, catch failures,
  keep valid input in the modal, disable submit while pending, and show the
  backend validation message.

### QA-06 — Double-clicking Save creates duplicate records

- **Severity:** High
- **Issue:** Save buttons are not disabled while a create request is pending and
  there is no idempotency key or duplicate-request guard. Two rapid clicks can
  create two interactions, assessments, actions, or future plans.
- **Evidence:** The modal form renders a plain Save button at
  `frontend/src/App.tsx:438`; `submitRecord` has no in-flight guard.
- **Reproduction steps:**
  1. Open any add-record modal.
  2. Fill valid data.
  3. Double-click **Save** or click it repeatedly during a slow request.
  4. Observe duplicate rows in the timeline/action/assessment data.
- **Recommended fix:** Disable the button immediately on submit and re-enable on
  failure. Add server-side idempotency for retried commands where duplicate
  creation is unacceptable.

### QA-07 — Exact duplicate companies and contacts are accepted

- **Severity:** Medium
- **Issue:** There is no uniqueness constraint, duplicate detection, or warning
  for companies with the same name or contacts with the same identifying
  details. Accidental repeated submissions create separate records and make
  search results ambiguous.
- **Evidence:** `Company.name` and `Contact` identifying fields in
  `backend/crm/models.py` have no uniqueness constraints; the serializers do
  not implement duplicate validation.
- **Reproduction steps:**
  1. POST the same company payload twice to `/api/v1/companies/`.
  2. POST the same contact payload twice for that company to
     `/api/v1/contacts/`.
  3. Observe two successful `201 Created` responses and two records.
- **Recommended fix:** Decide the business rule explicitly. At minimum, warn
  on normalized duplicate company names and duplicate contact email/phone
  within a company. Use database constraints only for fields whose uniqueness
  is truly guaranteed.

### QA-08 — Deleting a company irreversibly deletes its full history

- **Severity:** High
- **Issue:** Deleting a company cascades to contacts, opportunities,
  interactions, assessments, actions, and future plans. The API exposes DELETE
  without confirmation, soft-delete, archive, or undo.
- **Evidence:** Foreign keys in `backend/crm/models.py` use
  `on_delete=models.CASCADE` for related CRM records; all viewsets inherit
  `ModelViewSet`, which exposes DELETE.
- **Reproduction steps:**
  1. Create a company with a contact, opportunity, interaction, assessment, and
     action.
  2. DELETE the company through `/api/v1/companies/{id}/`.
  3. Observe a successful `204` and that all related history is gone.
- **Recommended fix:** Prefer archive/inactive behavior for normal UI actions.
  If hard deletion is retained, require explicit confirmation, clearly
  communicate the cascade, and provide a backup/restore path.

### QA-09 — Company list has an N+1 query path at scale

- **Severity:** Medium
- **Issue:** `primary_opportunity_id` is calculated by a separate related query
  for every serialized company. A paginated page of 20 companies therefore
  performs one list query plus up to 20 opportunity queries, and larger
  exports/pages scale linearly.
- **Evidence:** `backend/crm/serializers.py:41-45` uses
  `SerializerMethodField` and calls `obj.opportunities.order_by(...).first()`;
  `CompanyViewSet` does not prefetch or annotate opportunities.
- **Reproduction steps:**
  1. Load `/api/v1/companies/?page=1&page_size=20` with Django query logging
     enabled.
  2. Observe one query per returned company in addition to the base query.
  3. Repeat with a large dataset and observe latency increase.
- **Recommended fix:** Annotate the latest opportunity ID or use a constrained
  prefetch, and add a query-count regression test.

### QA-10 — Concurrent completion requests can overwrite completion time

- **Severity:** Medium
- **Issue:** The complete endpoint reads the action, checks its status, sets
  `completion_date`, and saves without a row lock or conditional update. Two
  concurrent requests can both pass the open check and write different
  completion timestamps. The final result is nondeterministic.
- **Evidence:** `backend/crm/api.py:164-172`.
- **Reproduction steps:**
  1. Create one open action.
  2. Send two simultaneous POST requests to `/actions/{id}/complete/`.
  3. Observe both requests can return success and the stored completion time is
     whichever write finishes last.
- **Recommended fix:** Use `transaction.atomic()` with `select_for_update()`,
  or an atomic conditional update that only transitions `open` to
  `completed`.

### QA-11 — Filter state uses URL replacement and does not create navigable history

- **Severity:** Low
- **Issue:** List filters call `history.replaceState`, so typing/searching or
  changing filters replaces the current history entry. Browser Back cannot step
  through prior filter states. Detail return behavior preserves the current
  state, but normal browser navigation does not provide filter history.
- **Evidence:** `frontend/src/App.tsx:176`, `195`, and `209`.
- **Reproduction steps:**
  1. Open the opportunities list.
  2. Apply status, priority, and search filters.
  3. Press the browser Back button.
  4. Observe that prior filter states are not restored.
- **Recommended fix:** Choose and document the intended behavior. If filter
  states should be navigable, use `pushState` for deliberate filter changes
  and handle `popstate` to restore component state.

### QA-12 — User-controlled return URL can navigate outside the application

- **Severity:** Low
- **Issue:** The detail page assigns the decoded `returnTo` query value directly
  to `window.location.href`. A crafted link can cause the Back button to
  navigate to an arbitrary external URL.
- **Evidence:** `frontend/src/App.tsx:374`.
- **Reproduction steps:**
  1. Open a detail URL containing
     `returnTo=https%3A%2F%2Fexample.com`.
  2. Click **Back to list**.
  3. Observe navigation to the external origin.
- **Recommended fix:** Accept only same-origin relative paths beginning with
  `/`, or construct the return URL from a validated allow-list of view/filter
  parameters.

## Areas reviewed with no concrete defect identified

- **SQL injection:** No raw SQL is used for user-controlled filters. Query
  construction uses Django ORM expressions. The health check's `SELECT 1` has
  no user input.
- **Stored/reflected XSS:** React renders values through normal JSX escaping and
  no `dangerouslySetInnerHTML` was found. User text is not inserted as HTML.
- **Invalid enum/date input:** DRF serializers and model validation reject
  invalid choices and malformed dates with HTTP 400. The main issue is that the
  frontend does not present those errors well (QA-05).
- **Past dates:** Past follow-up dates are intentionally supported because they
  are required for overdue work. This is not classified as a defect.
- **Empty database:** The dashboard and list empty states are present. A failed
  request can look like an empty state, covered separately by QA-04.
- **Pagination bounds:** DRF applies the configured maximum page size. Invalid
  or out-of-range requests still need frontend error handling, covered by
  QA-04.
- **Sensitive fields in normal JSON:** API serializers expose CRM fields
  expected by the application and do not expose database credentials or the
  Django secret.

## Recommended priority

1. QA-01 and QA-02 before any use beyond a trusted local machine.
2. QA-03, QA-04, QA-05, and QA-06 for data correctness and reliable daily use.
3. QA-08 and QA-10 to protect history and state transitions.
4. QA-07, QA-09, QA-11, and QA-12 as product hardening.

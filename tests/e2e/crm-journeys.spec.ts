import { expect, test, type APIRequestContext } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const API_BASE = "http://127.0.0.1:8000/api/v1";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const companyName = `E2E Company ${suffix}`;
const contactName = `E2E Contact ${suffix}`;
const opportunityTitle = `E2E Opportunity ${suffix}`;
const actionDescription = `E2E follow-up ${suffix}`;
const overdueActionDescription = `E2E overdue action ${suffix}`;
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

let companyId = "";
let opportunityId = "";

function detailUrl() {
  return `/?opportunity=${opportunityId}`;
}

async function create(request: APIRequestContext, path: string, data: object) {
  const response = await request.post(`${API_BASE}/${path}/`, { data });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("1. create an isolated company", async ({ request }) => {
  const company = await create(request, "companies", {
    name: companyName,
    industry: "E2E Software",
    source: "E2E",
    location: "Local test environment",
  });
  companyId = company.id;
  expect(company.name).toBe(companyName);
});

test("2. create a contact for the company", async ({ request }) => {
  const contact = await create(request, "contacts", {
    company: companyId,
    name: contactName,
    designation: "Decision Maker",
    email: `${suffix}@example.test`,
    phone: "+1 555 0100",
  });
  expect(contact.company).toBe(companyId);
  expect(contact.name).toBe(contactName);
});

test("3. create an opportunity", async ({ request }) => {
  const opportunity = await create(request, "opportunities", {
    company: companyId,
    title: opportunityTitle,
    description: "Created by an isolated Playwright journey.",
    status: "qualified",
    priority: "high",
    expected_decision_date: today,
  });
  opportunityId = opportunity.id;
  expect(opportunity.title).toBe(opportunityTitle);
});

test("4. add an interaction", async ({ page }) => {
  await page.goto(`/?opportunity=${opportunityId}`);
  await expect(page.getByRole("heading", { name: companyName })).toBeVisible();
  await page.getByRole("button", { name: "Add interaction" }).first().click();
  await page.getByLabel("Date and time").fill(`${today}T10:00`);
  await page.getByLabel("Subject").fill("E2E discovery call");
  await page.getByLabel("Details").fill("Confirmed the implementation scope.");
  await page.getByLabel("Outcome").fill("Proceed to proposal.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("E2E discovery call")).toBeVisible();
});

test("5. add my assessment", async ({ page }) => {
  await page.goto(detailUrl());
  await expect(page.getByRole("heading", { name: companyName })).toBeVisible();
  await page.getByRole("button", { name: "Add assessment" }).click();
  await page.getByLabel("My assessment / thoughts").fill("Strong fit and good timing.");
  await page.getByLabel("Concerns").fill("Budget approval is still pending.");
  await page.getByLabel("Opportunity level").selectOption("high");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Strong fit and good timing.")).toBeVisible();
});

test("6. create a follow-up action", async ({ page }) => {
  await page.goto(detailUrl());
  await expect(page.getByRole("heading", { name: companyName })).toBeVisible();
  await page.getByRole("button", { name: "Add next action" }).click();
  await page.getByLabel("Action description").fill(actionDescription);
  await page.getByLabel("Due date").fill(today);
  await page.getByLabel("Priority").selectOption("high");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(actionDescription)).toBeVisible();
});

test("7. verify the action appears in My Day", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /what should i work on today/i })).toBeVisible();
  await expect(page.getByText(actionDescription)).toBeVisible();
  await expect(page.getByText(companyName, { exact: true })).toBeVisible();
});

test("8. verify overdue actions appear in the overdue section", async ({ request, page }) => {
  const overdue = await create(request, "actions", {
    opportunity: opportunityId,
    action_description: overdueActionDescription,
    due_date: yesterday,
    priority: "medium",
  });
  expect(overdue.status).toBe("open");
  await page.goto("/");
  const overdueSection = page.getByRole("heading", { name: "Overdue" }).locator("..");
  await expect(overdueSection.getByText(overdueActionDescription)).toBeVisible();
});

test("9. mark an action completed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Send the proposal")).toBeVisible();
  const action = page.locator("article").filter({ hasText: actionDescription });
  await action.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByText(actionDescription)).not.toBeVisible();
});

test("10. completed action is no longer shown as pending", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(actionDescription)).not.toBeVisible();
});

test("11. search for a prospect", async ({ page }) => {
  await page.goto("/?view=prospects");
  await page.getByLabel("Search prospects").fill(companyName);
  await expect(page.getByRole("heading", { name: companyName })).toBeVisible();
});

test("12. open prospect detail and return to the list", async ({ page }) => {
  await page.goto("/?view=prospects");
  await page.getByLabel("Search prospects").fill(companyName);
  await expect(page.getByRole("link", { name: "Open prospect" })).toBeVisible();
  const prospectLink = page.getByRole("link", { name: "Open prospect" });
  await expect(prospectLink).toHaveAttribute("href", /returnTo=.*view/);
  await expect(prospectLink).toHaveAttribute("href", /view(?:%3D|=)prospects/);
  await prospectLink.click();
  await expect(page.getByRole("heading", { name: companyName })).toBeVisible();
  await page.getByRole("button", { name: "Back to list" }).click();
  await expect(page).toHaveURL(/view=prospects/);
});

test("13. preserve prospect search state after returning", async ({ page }) => {
  await page.goto("/?view=prospects");
  await page.getByLabel("Search prospects").fill(companyName);
  await page.getByRole("link", { name: "Open prospect" }).click();
  await page.getByRole("button", { name: "Back to list" }).click();
  await expect(page.getByLabel("Search prospects")).toHaveValue(companyName);
  await expect.poll(async () => new URL(page.url()).searchParams.get("search")).toBe(companyName);
});

test("14. edit an opportunity through the API and verify the detail", async ({ request, page }) => {
  const response = await request.patch(`${API_BASE}/opportunities/${opportunityId}/`, {
    data: { title: `${opportunityTitle} Updated` },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto(`/?opportunity=${opportunityId}`);
  await expect(page.getByText(`${opportunityTitle} Updated`)).toBeVisible();
});

test("15. validation prevents invalid data", async ({ request }) => {
  const response = await request.post(`${API_BASE}/opportunities/`, {
    data: { company: companyId, title: "", status: "not-a-status", priority: "high" },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toHaveProperty("title");
});

test.afterAll(async ({ request }) => {
  if (companyId) {
    await request.delete(`${API_BASE}/companies/${companyId}/`);
  }
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

const company = {
  id: "company-1",
  name: "Acme Software",
  industry: "Software",
  website: "https://acme.example",
  location: "London",
  source: "Referral",
  general_notes: "A strategic prospect.",
  lifecycle_status: "prospect",
};

const opportunity = {
  id: "opportunity-1",
  company: company.id,
  title: "CRM implementation",
  description: "Replace their current CRM.",
  estimated_value: "12000.00",
  currency: "USD",
  status: "qualified",
  priority: "high",
  expected_decision_date: "2026-10-01",
  notes: "Decision by Q4.",
};

describe("Prospect detail experience", () => {
  it("shows facts, assessment, next action, future plan, and chronological interactions", async () => {
    window.history.pushState({}, "", "/?opportunity=opportunity-1");
    const responses: Record<string, unknown> = {
      "/opportunities/opportunity-1/": opportunity,
      "/companies/company-1/": company,
      "/contacts/?company=company-1": [{ id: "contact-1", name: "Ada Lovelace", designation: "Director", email: "ada@example.com", phone: "", whatsapp: "", notes: "" }],
      "/interactions/?opportunity=opportunity-1": [
        { id: "i-1", occurred_at: "2026-09-18T10:00:00Z", interaction_type: "meeting", subject: "Latest meeting", details: "Discussed scope.", outcome: "Proposal requested." },
        { id: "i-2", occurred_at: "2026-09-10T10:00:00Z", interaction_type: "email", subject: "Introduction", details: "Sent introduction.", outcome: "" },
      ],
      "/assessments/?opportunity=opportunity-1": [{ id: "a-1", thoughts: "Strong fit.", concerns: "Budget timing.", opportunity_level: "high", created_at: "2026-09-18T10:00:00Z" }],
      "/actions/?opportunity=opportunity-1": [{ id: "action-1", action_description: "Send proposal", due_date: "2026-09-25", priority: "high", status: "open", completion_date: null, notes: "" }],
      "/future-plans/?opportunity=opportunity-1": [{ id: "plan-1", plan: "Revisit expansion next quarter.", target_date: "2027-01-01", status: "planned" }],
    };
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      const parsed = new URL(url, "http://localhost");
      const key = parsed.pathname.replace("/api/v1", "") + parsed.search;
      const response = responses[key]
        ?? (parsed.pathname.endsWith("/opportunities/opportunity-1/") ? opportunity : undefined)
        ?? (parsed.pathname.endsWith("/companies/company-1/") ? company : undefined)
        ?? (parsed.pathname.includes("/contacts/") ? [{ id: "contact-1", name: "Ada Lovelace", designation: "Director", email: "ada@example.com", phone: "", whatsapp: "", notes: "" }] : undefined)
        ?? (parsed.pathname.includes("/interactions/") ? [{ id: "i-1", occurred_at: "2026-09-18T10:00:00Z", interaction_type: "meeting", subject: "Latest meeting", details: "Discussed scope.", outcome: "Proposal requested." }, { id: "i-2", occurred_at: "2026-09-10T10:00:00Z", interaction_type: "email", subject: "Introduction", details: "Sent introduction.", outcome: "" }] : undefined)
        ?? (parsed.pathname.includes("/assessments/") ? [{ id: "a-1", thoughts: "Strong fit.", concerns: "Budget timing.", opportunity_level: "high", created_at: "2026-09-18T10:00:00Z" }] : undefined)
        ?? (parsed.pathname.includes("/actions/") ? [{ id: "action-1", action_description: "Send proposal", due_date: "2026-09-25", priority: "high", status: "open", completion_date: null, notes: "" }] : undefined)
        ?? (parsed.pathname.includes("/future-plans/") ? [{ id: "plan-1", plan: "Revisit expansion next quarter.", target_date: "2027-01-01", status: "planned" }] : undefined);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(response) });
    }));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Acme Software" })).toBeInTheDocument();
    expect(screen.getByText("A strategic prospect.")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Strong fit.")).toBeInTheDocument();
    expect(screen.getByText("Send proposal")).toBeInTheDocument();
    expect(screen.getByText("Revisit expansion next quarter.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Latest meeting")).toBeInTheDocument());
    expect(screen.getByText("Latest meeting")).toBeInTheDocument();
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    const pageText = document.body.textContent || "";
    expect(pageText.indexOf("Latest meeting")).toBeLessThan(pageText.indexOf("Introduction"));
  });

  describe("CRM list pages", () => {
    it("debounces prospect search and renders paginated results", async () => {
      window.history.pushState({}, "", "/?view=prospects");
      const fetchMock = vi.fn((url: string) => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          count: 1,
          next: null,
          previous: null,
          results: [company],
        }),
      }));
      vi.stubGlobal("fetch", fetchMock);

      render(<App />);
      const input = await screen.findByLabelText("Search prospects");
      fireEvent.change(input, { target: { value: "Ada" } });
      expect(fetchMock).not.toHaveBeenCalledWith("/api/v1/companies/?page=1&page_size=20&search=Ada");
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/companies/?page=1&page_size=20&search=Ada",
        expect.any(Object),
      ));
      expect(screen.getByRole("heading", { name: "Acme Software" })).toBeInTheDocument();
    });

    it("sends opportunity filters and preserves them in the detail link", async () => {
      window.history.pushState({}, "", "/?view=opportunities");
      const fetchMock = vi.fn((url: string) => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          count: 1,
          next: null,
          previous: null,
          results: [{ ...opportunity, company_name: company.name }],
        }),
      }));
      vi.stubGlobal("fetch", fetchMock);

      render(<App />);
      fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "qualified" } });
      fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "high" } });
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/opportunities/?page=1&page_size=20&status=qualified&priority=high",
        expect.any(Object),
      ));
      const link = screen.getByRole("link", { name: "Open opportunity" });
      expect(link.getAttribute("href")).toContain("returnTo=");
      expect(decodeURIComponent(link.getAttribute("href") || "")).toContain("view=opportunities");
      expect(decodeURIComponent(link.getAttribute("href") || "")).toContain("status=qualified");
    });

    it("filters follow-ups and shows a useful empty state", async () => {
      window.history.pushState({}, "", "/?view=follow-ups&due=today");
      const fetchMock = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 0, next: null, previous: null, results: [] }),
      }));
      vi.stubGlobal("fetch", fetchMock);

      render(<App />);
      expect(await screen.findByText("No today follow-ups.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/actions/?page=1&page_size=20&due=today", expect.any(Object));
      fireEvent.click(screen.getByRole("button", { name: "completed" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/actions/?page=1&page_size=20&due=completed",
        expect.any(Object),
      ));
    });

    it("shows a list request error and retries it", async () => {
      window.history.pushState({}, "", "/?view=prospects");
      let attempts = 0;
      const fetchMock = vi.fn(() => {
        attempts += 1;
        return attempts === 1
          ? Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({ detail: "Service unavailable" }) })
          : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ count: 0, next: null, previous: null, results: [] }) });
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<App />);

      expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(screen.getByText("No prospects match your search.")).toBeInTheDocument());
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("CRM data entry", () => {
    function response(body: unknown) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    }

    it("creates a company with the entered fields", async () => {
      window.history.pushState({}, "", "/?view=companies");
      const created = { ...company, id: "company-created" };
      const fetchMock = vi.fn((url: string, options?: RequestInit) => options?.method === "POST" ? response(created) : response([]));
      vi.stubGlobal("fetch", fetchMock);
      render(<App />);
      fireEvent.click(await screen.findByRole("button", { name: "Add Company" }));
      fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "Acme Software" } });
      fireEvent.change(screen.getByLabelText("Industry"), { target: { value: "Software" } });
      fireEvent.click(screen.getByRole("button", { name: "Save company" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/companies/", expect.objectContaining({ method: "POST", body: expect.stringContaining('"name":"Acme Software"') })));
    });

    it("creates a company and displays API validation errors", async () => {
      window.history.pushState({}, "", "/?view=companies");
      const fetchMock = vi.fn((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ name: ["A company with this name already exists."] }) });
        }
        return response([]);
      });
      vi.stubGlobal("fetch", fetchMock);
      render(<App />);
      fireEvent.click(await screen.findByRole("button", { name: "Add Company" }));
      fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "Acme Software" } });
      fireEvent.click(screen.getByRole("button", { name: "Save company" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("A company with this name already exists.");
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/companies/", expect.objectContaining({ method: "POST" }));
    });

    it("submits a contact with its selected company", async () => {
      window.history.pushState({}, "", "/?view=contacts");
      const fetchMock = vi.fn((url: string, options?: RequestInit) => {
        if (options?.method === "POST") return response({ id: "contact-2", company: "company-1", name: "Grace Hopper", designation: "", email: "grace@example.com", phone: "", whatsapp: "", notes: "" });
        if (url.includes("/contacts/")) return response([]);
        return response([company]);
      });
      vi.stubGlobal("fetch", fetchMock);
      render(<App />);
      fireEvent.click(await screen.findByRole("button", { name: "Add Contact" }));
      fireEvent.change(screen.getByLabelText("Company"), { target: { value: "company-1" } });
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Grace Hopper" } });
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "grace@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Save contact" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/contacts/", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"company":"company-1"'),
      })));
    });

    it("submits an opportunity with company, estimated value, and currency", async () => {
      window.history.pushState({}, "", "/?view=opportunities");
      const fetchMock = vi.fn((url: string, options?: RequestInit) => {
        if (options?.method === "POST") return response({ id: "opportunity-2", company: "company-1", title: "New opportunity", description: "", estimated_value: "25000", currency: "USD", status: "identified", priority: "medium", expected_decision_date: null, notes: "" });
        if (url.includes("/companies/")) return response([company]);
        return response({ count: 0, next: null, previous: null, results: [] });
      });
      vi.stubGlobal("fetch", fetchMock);
      render(<App />);
      fireEvent.click(await screen.findByRole("button", { name: "Add Opportunity" }));
      fireEvent.change(screen.getByLabelText("Company"), { target: { value: "company-1" } });
      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New opportunity" } });
      fireEvent.change(screen.getByLabelText("Estimated value"), { target: { value: "25000" } });
      fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "usd" } });
      fireEvent.click(screen.getByRole("button", { name: "Save opportunity" }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/opportunities/", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"estimated_value":"25000"'),
      })));
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/opportunities/", expect.objectContaining({ body: expect.stringContaining('"currency":"USD"') }));
    });
  });

  it("opens an interaction form and posts the new interaction", async () => {
    window.history.pushState({}, "", "/?opportunity=opportunity-1");
    const responses: Record<string, unknown> = {
      "/opportunities/opportunity-1/": opportunity,
      "/companies/company-1/": company,
      "/contacts/?company=company-1": [],
      "/interactions/?opportunity=opportunity-1": [],
      "/assessments/?opportunity=opportunity-1": [],
      "/actions/?opportunity=opportunity-1": [],
      "/future-plans/?opportunity=opportunity-1": [],
    };
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      const parsed = new URL(url, "http://localhost");
      const key = parsed.pathname.replace("/api/v1", "") + parsed.search;
      const response = responses[key]
        ?? (parsed.pathname.endsWith("/opportunities/opportunity-1/") ? opportunity : undefined)
        ?? (parsed.pathname.endsWith("/companies/company-1/") ? company : undefined)
        ?? (parsed.pathname.includes("/contacts/") || parsed.pathname.includes("/interactions/") || parsed.pathname.includes("/assessments/") || parsed.pathname.includes("/actions/") || parsed.pathname.includes("/future-plans/") ? [] : undefined);
      return Promise.resolve({
        ok: true,
        status: options?.method === "POST" ? 201 : 200,
        json: () => Promise.resolve(options?.method === "POST" ? { id: "new", occurred_at: "2026-09-18T10:00:00Z", interaction_type: "call", subject: "Follow-up", details: "Called", outcome: "" } : response),
      });

      it("shows My Day sections, completes an action, and opens an opportunity", async () => {
        window.history.pushState({}, "", "/");
        const dashboard = {
          overdue: [{ id: "action-1", company_name: "Acme Software", opportunity_title: "CRM implementation", opportunity_id: "opportunity-1", action_description: "Call buyer", due_date: "2026-09-17", priority: "high", status: "open", completion_date: null, notes: "" }],
          today: [],
          upcoming: [],
          recent_activity: [],
          important_opportunities: [{ ...opportunity, company_name: "Acme Software" }],
          opportunity_options: [{ id: "opportunity-1", title: "CRM implementation", company_name: "Acme Software" }],
        };
        const fetchMock = vi.fn((url: string, options?: RequestInit) => {
          if (url.endsWith("/dashboard/")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(dashboard) });
          if (url.endsWith("/complete/")) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ...dashboard.overdue[0], status: "completed" }) });
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<App />);

        expect(await screen.findByRole("heading", { name: /what should i work on today/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Companies" })).toHaveAttribute("href", "/?view=companies");
        expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute("href", "/?view=contacts");
        expect(screen.getByRole("link", { name: "Opportunities" })).toHaveAttribute("href", "/?view=opportunities");
        expect(screen.getByText("Overdue")).toBeInTheDocument();
        expect(screen.getByText("Today")).toBeInTheDocument();
        expect(screen.getByText("Upcoming")).toBeInTheDocument();
        expect(screen.getByText("Recent activity")).toBeInTheDocument();
        expect(screen.getByText("Important opportunities")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Complete" }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/actions/action-1/complete/", expect.objectContaining({ method: "POST" })));
        fireEvent.click(screen.getByRole("button", { name: "Open" }));
        expect(window.location.href).toContain("opportunity=opportunity-1");
      });

      it("shows empty states on My Day", async () => {
        window.history.pushState({}, "", "/");
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ overdue: [], today: [], upcoming: [], recent_activity: [], important_opportunities: [], opportunity_options: [] }),
        })));

        render(<App />);

        expect(await screen.findAllByText("Nothing here.")).toHaveLength(3);
        expect(screen.getByText("No recent activity.")).toBeInTheDocument();
        expect(screen.getByText("No important opportunities.")).toBeInTheDocument();
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await screen.findByRole("heading", { name: "Acme Software" });
    fireEvent.click(screen.getAllByRole("button", { name: "Add interaction" })[0]);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByLabelText("Details")).toBeInTheDocument();
  });
});

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Company = {
  id: string;
  name: string;
  industry: string;
  website: string;
  location: string;
  source: string;
  general_notes: string;
  lifecycle_status: string;
  primary_opportunity_id?: string | null;
};

type Contact = {
  id: string;
  company: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  whatsapp: string;
  notes: string;
};

type Opportunity = {
  id: string;
  company: string;
  title: string;
  description: string;
  estimated_value: string | null;
  currency: string;
  status: string;
  priority: string;
  expected_decision_date: string | null;
  notes: string;
  company_name?: string;
};

type Interaction = {
  id: string;
  occurred_at: string;
  interaction_type: string;
  subject: string;
  details: string;
  outcome: string;
};

type Assessment = {
  id: string;
  thoughts: string;
  concerns: string;
  opportunity_level: string;
  created_at: string;
};

type Action = {
  id: string;
  opportunity: string;
  action_description: string;
  due_date: string | null;
  priority: string;
  status: string;
  completion_date: string | null;
  notes: string;
  company_name?: string;
  opportunity_title?: string;
};

type FuturePlan = {
  id: string;
  plan: string;
  target_date: string | null;
  status: string;
};

type DashboardAction = Action & {
  company_name: string;
  opportunity_title: string;
  opportunity_id: string;
};

type DashboardData = {
  overdue: DashboardAction[];
  today: DashboardAction[];
  upcoming: DashboardAction[];
  recent_activity: Interaction[];
  important_opportunities: Opportunity[];
  opportunity_options: { id: string; title: string; company_name: string }[];
};

type ModalType = "interaction" | "assessment" | "action" | "future-plan" | null;
type ManagementModal = "company" | "contact" | "opportunity" | null;
type PageResponse<T> = { count: number; next: string | null; previous: string | null; results: T[] };

const API_BASE = "/api/v1";
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || Object.values(body).flat().join(" ") || "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-slate-900/40 p-4" role="presentation">
      <div className="mx-auto my-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-bold text-slate-900">{title}</h2>
          <button className="text-2xl text-slate-400" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActionCard({ action, onComplete }: { action: DashboardAction; onComplete: (id: string) => void }) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{action.company_name}</p>
          <h3 className="mt-1 font-semibold text-slate-900">{action.action_description}</h3>
          <p className="mt-1 text-sm text-slate-600">{action.opportunity_title}</p>
          <p className="mt-2 text-sm text-slate-500">Due: {formatDate(action.due_date)} · {action.priority} priority</p>
        </div>
        <div className="flex gap-2">
          <button className="button-secondary" onClick={() => { window.location.href = `/?opportunity=${action.opportunity_id}`; }}>Open</button>
          <button className="button-primary" onClick={() => onComplete(action.id)}>Complete</button>
        </div>
      </div>
    </article>
  );
}

function ListShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8"><div className="mx-auto max-w-6xl space-y-6"><header className="rounded-xl bg-slate-900 p-6 text-white"><p className="text-sm font-semibold uppercase tracking-wide text-blue-300">CRM</p><h1 className="mt-2 text-3xl font-bold">{title}</h1><p className="mt-2 text-slate-300">{description}</p><nav className="mt-5 flex flex-wrap gap-2"><a className="button-secondary" href="/">My Day</a><a className="button-secondary" href="/?view=companies">Companies</a><a className="button-secondary" href="/?view=prospects">Prospects</a><a className="button-secondary" href="/?view=contacts">Contacts</a><a className="button-secondary" href="/?view=opportunities">Opportunities</a><a className="button-secondary" href="/?view=follow-ups">Follow-ups</a></nav></header>{children}</div></main>;
}

function FormInput({ name, label, value, onChange, required = false, type = "text", placeholder = "" }: { name: string; label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input name={name} type={type} required={required} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>;
}

function FormTextarea({ name, label, value, onChange, required = false }: { name: string; label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<textarea name={name} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>;
}

function CompanyManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [modal, setModal] = useState<ManagementModal>(null);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: "", industry: "", website: "", location: "", source: "", general_notes: "", lifecycle_status: "prospect" });

  async function load() {
    setLoading(true);
    try { setCompanies(await api<Company[]>(`/companies/?search=${encodeURIComponent(search)}`)); setError(""); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load companies"); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [search]);
  function openForm(company?: Company) {
    setEditing(company || null);
    setForm(company ? { name: company.name, industry: company.industry, website: company.website, location: company.location, source: company.source, general_notes: company.general_notes, lifecycle_status: company.lifecycle_status } : { name: "", industry: "", website: "", location: "", source: "", general_notes: "", lifecycle_status: "prospect" });
    setFormError(""); setModal("company");
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setFormError("");
    try {
      const result = await api<Company>(editing ? `/companies/${editing.id}/` : "/companies/", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      setCompanies((items) => editing ? items.map((item) => item.id === result.id ? result : item) : [result, ...items]);
      setModal(null);
    } catch (requestError) { setFormError(requestError instanceof Error ? requestError.message : "Unable to save company"); }
  }
  async function remove(company: Company) {
    if (!window.confirm(`Archive ${company.name}?`)) return;
    try { await api(`/companies/${company.id}/`, { method: "DELETE" }); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to archive company"); }
  }
  return <ListShell title="Companies" description="Manage company records and open their related contacts and opportunities."><section className="rounded-xl bg-white p-6 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="block flex-1 text-sm font-medium text-slate-700">Search companies<input aria-label="Search companies" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Company, contact, phone, or email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><button className="button-primary" onClick={() => openForm()}>Add Company</button></div>{loading ? <p className="mt-6 text-slate-500">Loading companies...</p> : error ? <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">{error}<button className="button-secondary ml-3" onClick={() => void load()}>Retry</button></div> : <div className="mt-6 space-y-3">{companies.length ? companies.map((company) => <article key={company.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">{company.name}</h2><p className="text-sm text-slate-600">{company.industry || "Industry not set"} · {company.source || "Source not set"}</p><p className="mt-1 text-sm text-slate-500">{company.location || "Location not set"}</p></div><div className="flex flex-wrap gap-2"><a className="button-secondary" href={`/?company=${company.id}`}>View</a><button className="button-secondary" onClick={() => openForm(company)}>Edit</button><button className="button-secondary" onClick={() => void remove(company)}>Archive</button></div></div></article>) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No companies found.</p>}</div>}</section>{modal === "company" && <Modal title={editing ? "Edit company" : "Add company"} onClose={() => setModal(null)}><form className="mt-5 space-y-4" onSubmit={(event) => void save(event)}>{formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}<FormInput name="name" label="Company name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required /><FormInput name="industry" label="Industry" value={form.industry} onChange={(value) => setForm({ ...form, industry: value })} /><FormInput name="website" label="Website" value={form.website} onChange={(value) => setForm({ ...form, website: value })} type="url" /><FormInput name="location" label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} /><FormInput name="source" label="Source" value={form.source} onChange={(value) => setForm({ ...form, source: value })} /><FormTextarea name="general_notes" label="General notes" value={form.general_notes} onChange={(value) => setForm({ ...form, general_notes: value })} /><button className="button-primary w-full" type="submit">Save company</button></form></Modal>}</ListShell>;
}

function ContactManager() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ company: "", name: "", designation: "", phone: "", email: "", whatsapp: "", notes: "" });
  async function load() { setLoading(true); try { const [contactData, companyData] = await Promise.all([api<Contact[]>("/contacts/"), api<Company[]>("/companies/")]); setContacts(contactData); setCompanies(companyData); setError(""); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load contacts"); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  function openForm(contact?: Contact) { setEditing(contact || null); setForm(contact ? { company: contact.company, name: contact.name, designation: contact.designation, phone: contact.phone, email: contact.email, whatsapp: contact.whatsapp, notes: contact.notes } : { company: "", name: "", designation: "", phone: "", email: "", whatsapp: "", notes: "" }); setFormError(""); setModal(true); }
  async function save(event: FormEvent) { event.preventDefault(); setFormError(""); try { const result = await api<Contact>(editing ? `/contacts/${editing.id}/` : "/contacts/", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) }); setContacts((items) => editing ? items.map((item) => item.id === result.id ? result : item) : [result, ...items]); setModal(false); } catch (requestError) { setFormError(requestError instanceof Error ? requestError.message : "Unable to save contact"); } }
  async function remove(contact: Contact) { if (!window.confirm(`Delete ${contact.name}?`)) return; try { await api(`/contacts/${contact.id}/`, { method: "DELETE" }); setContacts((items) => items.filter((item) => item.id !== contact.id)); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to delete contact"); } }
  return <ListShell title="Contacts" description="Keep people connected to the right company."><section className="rounded-xl bg-white p-6 shadow-sm"><div className="flex justify-end"><button className="button-primary" onClick={() => openForm()}>Add Contact</button></div>{loading ? <p className="mt-6 text-slate-500">Loading contacts...</p> : error ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</p> : <div className="mt-6 space-y-3">{contacts.length ? contacts.map((contact) => <article key={contact.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{contact.name}</h2><p className="text-sm text-slate-600">{companies.find((company) => company.id === contact.company)?.name || "Company unavailable"} · {contact.designation || "Contact"}</p><p className="text-sm text-slate-500">{contact.email || contact.phone || "No contact details"}</p></div><div className="flex gap-2"><button className="button-secondary" onClick={() => openForm(contact)}>Edit</button><button className="button-secondary" onClick={() => void remove(contact)}>Delete</button></div></article>) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No contacts found.</p>}</div>}</section>{modal && <Modal title={editing ? "Edit contact" : "Add contact"} onClose={() => setModal(false)}><form className="mt-5 space-y-4" onSubmit={(event) => void save(event)}>{formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}<label className="block text-sm font-medium text-slate-700">Company<select required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Select a company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><FormInput name="name" label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required /><FormInput name="designation" label="Designation" value={form.designation} onChange={(value) => setForm({ ...form, designation: value })} /><FormInput name="email" label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} type="email" /><FormInput name="phone" label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><FormInput name="whatsapp" label="WhatsApp" value={form.whatsapp} onChange={(value) => setForm({ ...form, whatsapp: value })} /><FormTextarea name="notes" label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} /><button className="button-primary w-full" type="submit">Save contact</button></form></Modal>}</ListShell>;
}

function Pager({ page, count, pageSize, setPage }: { page: number; count: number; pageSize: number; setPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-600"><span>{count} result{count === 1 ? "" : "s"}</span><div className="flex gap-2"><button className="button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="px-2 py-2">Page {page} of {pages}</span><button className="button-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>;
}

function ProspectList() {
  const [search, setSearch] = useState(new URLSearchParams(window.location.search).get("search") || "");
  const [data, setData] = useState<PageResponse<Company> | null>(null);
  const [page, setPage] = useState(Number(new URLSearchParams(window.location.search).get("page") || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const restoringHistory = useRef(false);
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      restoringHistory.current = true;
      setSearch(params.get("search") || "");
      setPage(Number(params.get("page") || 1));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (search) params.set("search", search);
      if (restoringHistory.current) restoringHistory.current = false;
      else window.history.pushState({}, "", `/?view=prospects&${params}`);
      setLoading(true);
      void api<PageResponse<Company>>(`/companies/?${params}`, { signal: controller.signal }).then((result) => { setData(result); setError(""); }).catch((requestError) => { if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Unable to load prospects"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, page, retry]);
  return <ListShell title="Prospects" description="Search companies by company or contact details."><section className="rounded-xl bg-white p-6 shadow-sm"><label className="block text-sm font-medium text-slate-700" htmlFor="prospect-search">Search prospects<input id="prospect-search" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Company, contact, phone, or email" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} /></label>{loading ? <p className="mt-6 text-slate-500">Loading prospects...</p> : error ? <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700"><p>{error}</p><button className="button-secondary mt-3" onClick={() => setRetry((value) => value + 1)}>Retry</button></div> : data && <><div className="mt-6 space-y-3">{data.results.length ? data.results.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-4"><h2 className="font-semibold text-slate-900">{item.name}</h2><p className="text-sm text-slate-600">{item.industry || "Industry not set"} · {item.source || "Source not set"}</p>{item.primary_opportunity_id ? <a className="button-secondary mt-3 inline-block" href={`/?opportunity=${item.primary_opportunity_id}&returnTo=${encodeURIComponent(window.location.search)}`}>Open prospect</a> : <p className="mt-3 text-sm text-slate-500">No opportunity yet.</p>}</article>) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No prospects match your search.</p>}</div><div className="mt-6"><Pager page={page} count={data.count} pageSize={20} setPage={setPage} /></div></>}</section></ListShell>;
}

function OpportunityList() {
  const initial = new URLSearchParams(window.location.search);
  const [filters, setFilters] = useState({ search: initial.get("search") || "", status: initial.get("status") || "", priority: initial.get("priority") || "", industry: initial.get("industry") || "", source: initial.get("source") || "", expected_decision_date: initial.get("expected_decision_date") || "" });
  const [data, setData] = useState<PageResponse<Opportunity> | null>(null);
  const [page, setPage] = useState(Number(initial.get("page") || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [modal, setModal] = useState<ManagementModal>(null);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ company: "", title: "", description: "", estimated_value: "", currency: "", status: "identified", priority: "medium", expected_decision_date: "", notes: "", lost_reason: "" });
  const restoringHistory = useRef(false);
  useEffect(() => { void api<Company[]>("/companies/").then(setCompanies).catch(() => setCompanies([])); }, []);
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      restoringHistory.current = true;
      setFilters({ search: params.get("search") || "", status: params.get("status") || "", priority: params.get("priority") || "", industry: params.get("industry") || "", source: params.get("source") || "", expected_decision_date: params.get("expected_decision_date") || "" });
      setPage(Number(params.get("page") || 1));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      if (restoringHistory.current) restoringHistory.current = false;
      else window.history.pushState({}, "", `/?view=opportunities&${params}`);
      setLoading(true);
      void api<PageResponse<Opportunity>>(`/opportunities/?${params}`, { signal: controller.signal }).then((result) => { setData(result); setError(""); }).catch((requestError) => { if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Unable to load opportunities"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, filters.search ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters, page, retry]);
  const update = (key: keyof typeof filters, value: string) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  function openForm(opportunity?: Opportunity) { setEditing(opportunity || null); setForm(opportunity ? { company: opportunity.company, title: opportunity.title, description: opportunity.description, estimated_value: opportunity.estimated_value || "", currency: opportunity.currency, status: opportunity.status, priority: opportunity.priority, expected_decision_date: opportunity.expected_decision_date || "", notes: opportunity.notes, lost_reason: (opportunity as Opportunity & { lost_reason?: string }).lost_reason || "" } : { company: "", title: "", description: "", estimated_value: "", currency: "", status: "identified", priority: "medium", expected_decision_date: "", notes: "", lost_reason: "" }); setFormError(""); setModal("opportunity"); }
  async function save(event: FormEvent) { event.preventDefault(); setFormError(""); try { const payload = { ...form, estimated_value: form.estimated_value || null, expected_decision_date: form.expected_decision_date || null, lost_reason: form.status === "lost" ? form.lost_reason : "" }; const result = await api<Opportunity>(editing ? `/opportunities/${editing.id}/` : "/opportunities/", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) }); setData((current) => current ? { ...current, results: editing ? current.results.map((item) => item.id === result.id ? result : item) : [result, ...current.results], count: editing ? current.count : current.count + 1 } : current); setModal(null); } catch (requestError) { setFormError(requestError instanceof Error ? requestError.message : "Unable to save opportunity"); } }
  async function remove(opportunity: Opportunity) { if (!window.confirm(`Delete ${opportunity.title}?`)) return; try { await api(`/opportunities/${opportunity.id}/`, { method: "DELETE" }); setData((current) => current ? { ...current, results: current.results.filter((item) => item.id !== opportunity.id), count: Math.max(0, current.count - 1) } : current); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to delete opportunity"); } }
  return <ListShell title="Opportunities" description="Filter your pipeline by status, priority, source, industry, or decision date."><section className="rounded-xl bg-white p-6 shadow-sm"><div className="mb-4 flex justify-end"><button className="button-primary" onClick={() => openForm()}>Add Opportunity</button></div><div className="grid gap-3 md:grid-cols-3"><input aria-label="Opportunity search" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Search title or company" value={filters.search} onChange={(event) => update("search", event.target.value)} /><select aria-label="Status" className="rounded-lg border border-slate-300 px-3 py-2" value={filters.status} onChange={(event) => update("status", event.target.value)}><option value="">All statuses</option>{["identified", "qualified", "proposal", "negotiation", "won", "lost", "paused"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Priority" className="rounded-lg border border-slate-300 px-3 py-2" value={filters.priority} onChange={(event) => update("priority", event.target.value)}><option value="">All priorities</option>{["low", "medium", "high"].map((value) => <option key={value}>{value}</option>)}</select><input aria-label="Industry" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Industry" value={filters.industry} onChange={(event) => update("industry", event.target.value)} /><input aria-label="Source" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Source" value={filters.source} onChange={(event) => update("source", event.target.value)} /><input aria-label="Expected decision date" type="date" className="rounded-lg border border-slate-300 px-3 py-2" value={filters.expected_decision_date} onChange={(event) => update("expected_decision_date", event.target.value)} /></div>{loading ? <p className="mt-6 text-slate-500">Loading opportunities...</p> : error ? <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700"><p>{error}</p><button className="button-secondary mt-3" onClick={() => setRetry((value) => value + 1)}>Retry</button></div> : data && <><div className="mt-6 space-y-3">{data.results.length ? data.results.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-4"><h2 className="font-semibold">{item.title}</h2><p className="text-sm text-slate-600">{item.company_name || item.company} · {item.status} · {item.priority}</p><div className="mt-3 flex flex-wrap gap-2"><a className="button-secondary" href={`/?opportunity=${item.id}&returnTo=${encodeURIComponent(window.location.search)}`}>Open opportunity</a><button className="button-secondary" onClick={() => openForm(item)}>Edit</button><button className="button-secondary" onClick={() => void remove(item)}>Delete</button></div></article>) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No opportunities match these filters.</p>}</div><div className="mt-6"><Pager page={page} count={data.count} pageSize={20} setPage={setPage} /></div></>}</section>{modal === "opportunity" && <Modal title={editing ? "Edit opportunity" : "Add opportunity"} onClose={() => setModal(null)}><form className="mt-5 space-y-4" onSubmit={(event) => void save(event)}>{formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}<label className="block text-sm font-medium text-slate-700">Company<select required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Select a company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><FormInput name="title" label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required /><FormTextarea name="description" label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} /><div className="grid gap-4 sm:grid-cols-2"><FormInput name="estimated_value" label="Estimated value" value={form.estimated_value} onChange={(value) => setForm({ ...form, estimated_value: value })} type="number" /><FormInput name="currency" label="Currency" value={form.currency} onChange={(value) => setForm({ ...form, currency: value.toUpperCase() })} placeholder="USD" /></div><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">{["identified", "qualified", "proposal", "negotiation", "won", "lost", "paused"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">{["low", "medium", "high"].map((value) => <option key={value}>{value}</option>)}</select></label></div><FormInput name="expected_decision_date" label="Expected decision date" value={form.expected_decision_date} onChange={(value) => setForm({ ...form, expected_decision_date: value })} type="date" />{form.status === "lost" && <FormTextarea name="lost_reason" label="Lost reason" value={form.lost_reason} onChange={(value) => setForm({ ...form, lost_reason: value })} required />}<FormTextarea name="notes" label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} /><button className="button-primary w-full" type="submit">Save opportunity</button></form></Modal>}</ListShell>;
}

function FollowUpList() {
  const [filter, setFilter] = useState(new URLSearchParams(window.location.search).get("due") || "overdue");
  const [data, setData] = useState<PageResponse<Action> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const restoringHistory = useRef(false);
  useEffect(() => {
    const onPopState = () => {
      restoringHistory.current = true;
      setFilter(new URLSearchParams(window.location.search).get("due") || "overdue");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => { const controller = new AbortController(); const params = new URLSearchParams({ page: "1", page_size: "20", due: filter }); if (restoringHistory.current) restoringHistory.current = false; else window.history.pushState({}, "", `/?view=follow-ups&${params}`); setLoading(true); void api<PageResponse<Action>>(`/actions/?${params}`, { signal: controller.signal }).then((result) => { setData(result); setError(""); }).catch((requestError) => { if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Unable to load follow-ups"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [filter, retry]);
  return <ListShell title="Follow-ups" description="Review overdue, current, upcoming, and completed actions."><section className="rounded-xl bg-white p-6 shadow-sm"><div className="flex flex-wrap gap-2">{["overdue", "today", "upcoming", "completed"].map((value) => <button key={value} className={filter === value ? "button-primary" : "button-secondary"} onClick={() => setFilter(value)}>{value}</button>)}</div>{loading ? <p className="mt-6 text-slate-500">Loading follow-ups...</p> : error ? <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700"><p>{error}</p><button className="button-secondary mt-3" onClick={() => setRetry((value) => value + 1)}>Retry</button></div> : data && <div className="mt-6 space-y-3">{data.results.length ? data.results.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-4"><h2 className="font-semibold">{item.action_description}</h2><p className="text-sm text-slate-600">{item.company_name} · {item.opportunity_title} · due {formatDate(item.due_date)} · {item.priority}</p><a className="button-secondary mt-3 inline-block" href={`/?opportunity=${item.opportunity}&returnTo=${encodeURIComponent(window.location.search)}`}>Open opportunity</a></article>) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No {filter} follow-ups.</p>}</div>}</section></ListShell>;
}

function MyDayDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadDashboard() {
    try {
      setData(await api<DashboardData>("/dashboard/"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load My Day");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function completeAction(id: string) {
    try {
      await api(`/actions/${id}/complete/`, { method: "POST" });
      await loadDashboard();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to complete action");
    }
  }

  async function addFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await api("/actions/", { method: "POST", body: JSON.stringify(payload) });
      setShowFollowUp(false);
      await loadDashboard();
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "Unable to add follow-up");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="min-h-screen p-8 text-slate-600">Loading My Day...</main>;
  if (error) return <main className="min-h-screen p-8"><div className="mx-auto max-w-6xl rounded-xl bg-red-50 p-6 text-red-700">{error}</div></main>;
  if (!data) return null;

  const sections: { key: "overdue" | "today" | "upcoming"; title: string; tone: string }[] = [
    { key: "overdue", title: "Overdue", tone: "border-red-400" },
    { key: "today", title: "Today", tone: "border-blue-500" },
    { key: "upcoming", title: "Upcoming", tone: "border-amber-400" },
  ];
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-xl bg-slate-900 p-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wide text-blue-300">My Day</p><h1 className="mt-2 text-3xl font-bold">What should I work on today?</h1><p className="mt-2 text-slate-300">Your overdue, today, and next actions in one place.</p></div><button className="button-primary" onClick={() => setShowFollowUp(true)}>Add follow-up</button></div>
          <nav className="mt-5 flex flex-wrap gap-2" aria-label="Main navigation"><a className="button-secondary" href="/">My Day</a><a className="button-secondary" href="/?view=companies">Companies</a><a className="button-secondary" href="/?view=prospects">Prospects</a><a className="button-secondary" href="/?view=contacts">Contacts</a><a className="button-secondary" href="/?view=opportunities">Opportunities</a><a className="button-secondary" href="/?view=follow-ups">Follow-ups</a></nav>
        </header>
        <section className="grid gap-6 lg:grid-cols-3">
          {sections.map(({ key, title, tone }) => <div className={`rounded-xl border-t-4 ${tone} bg-white p-5 shadow-sm`} key={key}><h2 className="text-lg font-bold text-slate-900">{title}</h2><div className="mt-4 space-y-3">{data[key].length ? data[key].map((action) => <ActionCard key={action.id} action={action} onComplete={(id) => void completeAction(id)} />) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Nothing here.</p>}</div></div>)}
        </section>
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow-sm"><h2 className="section-title">Recent activity</h2><div className="mt-4 space-y-3">{data.recent_activity.length ? data.recent_activity.map((item) => <article key={item.id} className="border-b border-slate-100 pb-3"><p className="text-xs uppercase tracking-wide text-slate-500">{formatDateTime(item.occurred_at)} · {item.interaction_type}</p><h3 className="mt-1 font-semibold">{item.subject}</h3><p className="text-sm text-slate-600">{item.details}</p></article>) : <p className="text-sm text-slate-500">No recent activity.</p>}</div></div>
          <div className="rounded-xl bg-white p-6 shadow-sm"><h2 className="section-title">Important opportunities</h2><div className="mt-4 space-y-3">{data.important_opportunities.length ? data.important_opportunities.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">High priority</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="text-sm text-slate-600">{item.status} · {item.company_name || item.company}</p><button className="button-secondary mt-3" onClick={() => { window.location.href = `/?opportunity=${item.id}`; }}>Open opportunity</button></article>) : <p className="text-sm text-slate-500">No important opportunities.</p>}</div></div>
        </section>
      </div>
      {showFollowUp && <Modal title="Add follow-up" onClose={() => { if (!submitting) { setFormError(""); setShowFollowUp(false); } }}><form className="mt-5 space-y-4" onSubmit={(event) => void addFollowUp(event)}>{formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}<label className="block text-sm font-medium text-slate-700" htmlFor="opportunity">Opportunity<select id="opportunity" name="opportunity" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Select an opportunity</option>{data.opportunity_options.map((item) => <option key={item.id} value={item.id}>{item.company_name} — {item.title}</option>)}</select></label><Field name="action_description" label="Action description" as="textarea" required /><Field name="due_date" label="Due date" type="date" required /><Field name="priority" label="Priority" as="select" options={["low", "medium", "high"]} required /><Field name="notes" label="Notes" as="textarea" /><button className="button-primary w-full" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save follow-up"}</button></form></Modal>}
    </main>
  );
}

function CompanyDetail({ companyId }: { companyId: string }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([
      api<Company>(`/companies/${companyId}/`),
      api<Contact[]>(`/contacts/?company=${companyId}`),
      api<Opportunity[]>(`/opportunities/?company=${companyId}`),
      api<Interaction[]>(`/interactions/?company=${companyId}`),
    ]).then(([companyData, contactData, opportunityData, interactionData]) => {
      setCompany(companyData); setContacts(contactData); setOpportunities(opportunityData); setInteractions(interactionData);
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load company"));
  }, [companyId]);
  if (error) return <main className="min-h-screen p-8"><p className="mx-auto max-w-4xl rounded-lg bg-red-50 p-4 text-red-700">{error}</p></main>;
  if (!company) return <main className="min-h-screen p-8 text-slate-600">Loading company...</main>;
  return <ListShell title={company.name} description="Company facts, contacts, opportunities, and interactions."><button className="button-secondary" onClick={() => { window.location.href = "/?view=companies"; }}>Back to companies</button><section className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl bg-white p-6 shadow-sm"><h2 className="section-title">Company</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="label">Industry</dt><dd>{company.industry || "Not set"}</dd></div><div><dt className="label">Location</dt><dd>{company.location || "Not set"}</dd></div><div><dt className="label">Source</dt><dd>{company.source || "Not set"}</dd></div><div><dt className="label">Website</dt><dd>{company.website || "Not set"}</dd></div></dl><p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">{company.general_notes || "No general notes yet."}</p></div><div className="rounded-xl bg-white p-6 shadow-sm"><h2 className="section-title">Contacts</h2><div className="mt-4 space-y-3">{contacts.length ? contacts.map((contact) => <article key={contact.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold">{contact.name}</p><p className="text-slate-600">{contact.designation || "Contact"} · {contact.email || contact.phone || "No contact details"}</p></article>) : <p className="text-sm text-slate-500">No contacts yet.</p>}</div></div></section><section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="section-title">Opportunities</h2><div className="mt-4 space-y-3">{opportunities.length ? opportunities.map((item) => <article key={item.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">{item.title}</h3><p className="text-sm text-slate-600">{item.status} · {item.priority}</p></div><a className="button-secondary" href={`/?opportunity=${item.id}&returnTo=${encodeURIComponent(`/?company=${companyId}`)}`}>Open opportunity</a></article>) : <p className="text-sm text-slate-500">No opportunities yet.</p>}</div></section><section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="section-title">Interactions</h2><div className="mt-4 space-y-3">{interactions.length ? interactions.map((item) => <article key={item.id} className="border-b border-slate-100 pb-3"><p className="text-xs uppercase tracking-wide text-slate-500">{formatDateTime(item.occurred_at)} · {item.interaction_type}</p><h3 className="font-semibold">{item.subject}</h3><p className="text-sm text-slate-600">{item.details}</p></article>) : <p className="text-sm text-slate-500">No interactions recorded yet.</p>}</div></section></ListShell>;
}

function App() {
  const [company, setCompany] = useState<Company | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [futurePlans, setFuturePlans] = useState<FuturePlan[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [modal, setModal] = useState<ModalType>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const currentAction = useMemo(
    () => actions.find((action) => action.status === "open") || null,
    [actions],
  );
  const currentAssessment = assessments[0] || null;
  const currentPlan = futurePlans.find((plan) => plan.status !== "completed" && plan.status !== "abandoned") || null;

  async function loadDetail(selectedOpportunityId: string) {
    setLoading(true);
    setError("");
    try {
      const selected = await api<Opportunity>(`/opportunities/${selectedOpportunityId}/`);
      const selectedCompany = await api<Company>(`/companies/${selected.company}/`);
      const [contactData, opportunityInteractions, companyInteractions, assessmentData, actionData, planData] = await Promise.all([
        api<Contact[]>(`/contacts/?company=${selected.company}`),
        api<Interaction[]>(`/interactions/?opportunity=${selectedOpportunityId}`),
        api<Interaction[]>(`/interactions/?company=${selected.company}`),
        api<Assessment[]>(`/assessments/?opportunity=${selectedOpportunityId}`),
        api<Action[]>(`/actions/?opportunity=${selectedOpportunityId}`),
        api<FuturePlan[]>(`/future-plans/?opportunity=${selectedOpportunityId}`),
      ]);
      setOpportunity(selected);
      setCompany(selectedCompany);
      setContacts(contactData || []);
      const allInteractions = [...(opportunityInteractions || []), ...(companyInteractions || [])];
      setInteractions(allInteractions.filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()));
      setAssessments(assessmentData || []);
      setActions(actionData || []);
      setFuturePlans(planData || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load prospect");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedOpportunityId = params.get("opportunity");
    const selectedCompanyId = params.get("company");
    if (selectedOpportunityId) {
      void loadDetail(selectedOpportunityId);
      return;
    }
    setLoading(false);
  }, []);

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!opportunity || submitting) return;
    setSubmitting(true);
    setFormError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const endpoint = modal === "future-plan" ? "/future-plans/" : `/${modal}s/`;
    try {
      const created = await api(endpoint, {
        method: "POST",
        body: JSON.stringify({ ...payload, opportunity: opportunity.id, company: modal === "interaction" ? company?.id : undefined }),
      });
      if (modal === "interaction") setInteractions((items) => [...items, created as Interaction].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()));
      if (modal === "assessment") setAssessments((items) => [created as Assessment, ...items]);
      if (modal === "action") setActions((items) => [created as Action, ...items]);
      if (modal === "future-plan") setFuturePlans((items) => [created as FuturePlan, ...items]);
      setModal(null);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "Unable to save record");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="min-h-screen p-8 text-slate-600">Loading prospect...</main>;
  if (error) return <main className="min-h-screen p-8"><div className="mx-auto max-w-4xl rounded-xl bg-red-50 p-6 text-red-700">{error}</div></main>;
  if (!opportunity || !company) {
    const view = new URLSearchParams(window.location.search).get("view");
    const selectedCompanyId = new URLSearchParams(window.location.search).get("company");
    if (selectedCompanyId) return <CompanyDetail companyId={selectedCompanyId} />;
    if (view === "companies") return <CompanyManager />;
    if (view === "prospects") return <ProspectList />;
    if (view === "contacts") return <ContactManager />;
    if (view === "opportunities") return <OpportunityList />;
    if (view === "follow-ups") return <FollowUpList />;
    return <MyDayDashboard />;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-xl bg-slate-900 p-6 text-white shadow-sm">
          <button className="button-secondary mb-4" onClick={() => { const returnTo = new URLSearchParams(window.location.search).get("returnTo"); let safeReturnTo = "/?view=opportunities"; if (returnTo) { try { const target = new URL(returnTo, window.location.origin); if (target.origin === window.location.origin) safeReturnTo = `${target.pathname}${target.search}${target.hash}`; } catch { /* use the safe default */ } } window.location.href = safeReturnTo; }}>Back to list</button>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">Prospect workspace</p>
          <h1 className="mt-2 text-3xl font-bold">{company.name}</h1>
          <p className="mt-1 text-lg text-slate-300">{opportunity.title}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-blue-200">{opportunity.status}</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">{opportunity.priority} priority</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">Decision: {formatDate(opportunity.expected_decision_date)}</span>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="section-title">What do I know?</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="label">Industry</dt><dd>{company.industry || "Not set"}</dd></div>
              <div><dt className="label">Location</dt><dd>{company.location || "Not set"}</dd></div>
              <div><dt className="label">Source</dt><dd>{company.source || "Not set"}</dd></div>
              <div><dt className="label">Website</dt><dd>{company.website || "Not set"}</dd></div>
            </dl>
            <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">{company.general_notes || "No general notes yet."}</p>
            <h3 className="mt-6 font-semibold text-slate-900">Contacts</h3>
            <div className="mt-3 space-y-3">
              {contacts.length ? contacts.map((contact) => <div key={contact.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold">{contact.name}</p><p className="text-slate-600">{contact.designation || "Contact"} · {contact.email || contact.phone || "No contact details"}</p></div>) : <p className="text-sm text-slate-500">No contacts yet.</p>}
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="section-title">Opportunity</h2>
            <p className="mt-4 text-slate-700">{opportunity.description || "No description yet."}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="label">Estimated value</dt><dd>{opportunity.estimated_value ? `${opportunity.currency || ""} ${opportunity.estimated_value}` : "Not set"}</dd></div>
              <div><dt className="label">Notes</dt><dd>{opportunity.notes || "No notes yet."}</dd></div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <button className="button-primary" onClick={() => setModal("interaction")}>Add interaction</button>
              <button className="button-secondary" onClick={() => setModal("assessment")}>Add assessment</button>
              <button className="button-secondary" onClick={() => setModal("action")}>Add next action</button>
              <button className="button-secondary" onClick={() => setModal("future-plan")}>Add future plan</button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border-l-4 border-amber-400 bg-white p-6 shadow-sm">
            <h2 className="section-title">What do I think?</h2>
            {currentAssessment ? <><p className="mt-4 whitespace-pre-wrap text-sm">{currentAssessment.thoughts}</p><p className="mt-3 text-sm text-slate-600"><strong>Concerns:</strong> {currentAssessment.concerns || "None recorded"}</p><span className="mt-4 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{currentAssessment.opportunity_level} opportunity</span></> : <p className="mt-4 text-sm text-slate-500">No assessment recorded yet.</p>}
          </div>
          <div className="rounded-xl border-l-4 border-blue-500 bg-white p-6 shadow-sm">
            <h2 className="section-title">What should I do next?</h2>
            {currentAction ? <><p className="mt-4 font-semibold">{currentAction.action_description}</p><p className="mt-2 text-sm text-slate-600">Due: {formatDate(currentAction.due_date)} · {currentAction.priority} priority</p><p className="mt-3 text-sm text-slate-600">{currentAction.notes}</p></> : <p className="mt-4 text-sm text-slate-500">No open next action.</p>}
          </div>
          <div className="rounded-xl border-l-4 border-emerald-500 bg-white p-6 shadow-sm">
            <h2 className="section-title">Future plan</h2>
            {currentPlan ? <><p className="mt-4 whitespace-pre-wrap text-sm">{currentPlan.plan}</p><p className="mt-3 text-sm text-slate-600">Target: {formatDate(currentPlan.target_date)} · {currentPlan.status}</p></> : <p className="mt-4 text-sm text-slate-500">No active future plan.</p>}
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="section-title">What happened previously?</h2><p className="mt-1 text-sm text-slate-500">Chronological interaction timeline</p></div><button className="button-primary" onClick={() => setModal("interaction")}>Add interaction</button></div>
          <div className="mt-6 space-y-4 border-l-2 border-slate-200 pl-5">
            {interactions.length ? interactions.map((interaction) => <article key={interaction.id} className="relative"><span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white" /><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{formatDateTime(interaction.occurred_at)} · {interaction.interaction_type}</p><h3 className="mt-1 font-semibold text-slate-900">{interaction.subject}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{interaction.details}</p>{interaction.outcome && <p className="mt-2 text-sm text-slate-500"><strong>Outcome:</strong> {interaction.outcome}</p>}</article>) : <p className="text-sm text-slate-500">No interactions recorded yet.</p>}
          </div>
        </section>
      </div>
      {modal && <Modal title={`Add ${modal.replace("-", " ")}`} onClose={() => { if (!submitting) { setFormError(""); setModal(null); } }}><form className="mt-5 space-y-4" onSubmit={(event) => void submitRecord(event)}>{formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}{modal === "interaction" && <><Field name="occurred_at" label="Date and time" type="datetime-local" required /><Field name="interaction_type" label="Type" as="select" options={["call", "email", "meeting", "message", "demo", "note", "other"]} required /><Field name="subject" label="Subject" required /><Field name="details" label="Details" as="textarea" required /><Field name="outcome" label="Outcome" as="textarea" /> </>}{modal === "assessment" && <><Field name="thoughts" label="My assessment / thoughts" as="textarea" required /><Field name="concerns" label="Concerns" as="textarea" /><Field name="opportunity_level" label="Opportunity level" as="select" options={["low", "medium", "high"]} required /></>}{modal === "action" && <><Field name="action_description" label="Action description" as="textarea" required /><Field name="due_date" label="Due date" type="date" /><Field name="priority" label="Priority" as="select" options={["low", "medium", "high"]} required /><Field name="notes" label="Notes" as="textarea" /></>}{modal === "future-plan" && <><Field name="plan" label="Future plan" as="textarea" required /><Field name="target_date" label="Target date" type="date" /><Field name="status" label="Status" as="select" options={["planned", "active", "completed", "abandoned"]} required /></>}<button className="button-primary w-full" type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</button></form></Modal>}
    </main>
  );
}

function Field({ name, label, type = "text", as = "input", options, required }: { name: string; label: string; type?: string; as?: "input" | "textarea" | "select"; options?: string[]; required?: boolean }) {
  const common = { id: name, name, required, className: "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" };
  return <label className="block text-sm font-medium text-slate-700" htmlFor={name}>{label}{as === "textarea" ? <textarea {...common} rows={3} /> : as === "select" ? <select {...common} defaultValue={options?.[0]}>{options?.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input {...common} type={type} />}</label>;
}

export default App;

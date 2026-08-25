const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "medvoice_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Core request helper. Adds the bearer token automatically, JSON-encodes bodies
 * unless they're already FormData, and throws ApiError with a readable message
 * on non-2xx responses.
 */
async function request(path, { method = "GET", body, headers = {}, isForm = false } = {}) {
  const token = getToken();
  const finalHeaders = { ...headers };
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  if (!isForm && body !== undefined) finalHeaders["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (res.status === 204) return null;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (isJson && (data.detail || data.message)) || res.statusText;
    if (res.status === 401) setToken(null);
    throw new ApiError(typeof message === "string" ? message : JSON.stringify(message), res.status, data);
  }

  return data;
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body });
const patch = (path, body) => request(path, { method: "PATCH", body });
const put = (path, body) => request(path, { method: "PUT", body });
const del = (path) => request(path, { method: "DELETE" });

// ---------- auth ----------
export async function login(email, password) {
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);
  const data = await request("/auth/login", {
    method: "POST",
    body: form,
    isForm: true,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  setToken(data.access_token);
  return data;
}

export async function register({ orgName, fullName, email, password }) {
  const data = await post("/auth/register", {
    org_name: orgName,
    full_name: fullName,
    email,
    password,
  });
  setToken(data.access_token);
  return data;
}

export function logout() {
  setToken(null);
}

export const me = () => get("/auth/me");

// ---------- dashboard ----------
export const getDashboardStats = () => get("/dashboard/stats");
export const getLiveCalls = () => get("/dashboard/live-calls");
export const getCallVolume = () => get("/dashboard/call-volume");

// ---------- patients ----------
export const listPatients = (search) => get(`/patients${search ? `?search=${encodeURIComponent(search)}` : ""}`);
export const getPatient = (id) => get(`/patients/${id}`);
export const createPatient = (payload) => post("/patients", payload);
export const updatePatient = (id, payload) => patch(`/patients/${id}`, payload);
export const deletePatient = (id) => del(`/patients/${id}`);

// ---------- doctors ----------
export const listDoctors = () => get("/doctors");

// ---------- calls ----------
export const listCalls = (outcome) => get(`/calls${outcome ? `?outcome=${encodeURIComponent(outcome)}` : ""}`);
export const getCall = (id) => get(`/calls/${id}`);

// ---------- appointments ----------
export const listAppointments = () => get("/appointments");
export const createAppointment = (payload) => post("/appointments", payload);
export const updateAppointment = (id, payload) => patch(`/appointments/${id}`, payload);
export const listPendingBookings = () => get("/appointments/pending/bookings");
export const verifyPendingBooking = (id) => post(`/appointments/pending/bookings/${id}/verify`);
export const declinePendingBooking = (id) => post(`/appointments/pending/bookings/${id}/decline`);

// ---------- knowledge base ----------
export const listKBDocuments = () => get("/knowledge-base/documents");
export const uploadKBDocument = (file) => {
  const form = new FormData();
  form.append("file", file);
  return request("/knowledge-base/documents", { method: "POST", body: form, isForm: true });
};
export const deleteKBDocument = (id) => del(`/knowledge-base/documents/${id}`);
export const listKBSources = () => get("/knowledge-base/sources");
export const addKBSource = (url) => post("/knowledge-base/sources", { url });
export const deleteKBSource = (id) => del(`/knowledge-base/sources/${id}`);
export const listFAQs = () => get("/knowledge-base/faqs");
export const addFAQ = (payload) => post("/knowledge-base/faqs", payload);
export const deleteFAQ = (id) => del(`/knowledge-base/faqs/${id}`);

// ---------- agent settings ----------
export const getAgentSettings = () => get("/agent-settings");
export const updateAgentSettings = (payload) => put("/agent-settings", payload);
export const listRoutingRules = () => get("/agent-settings/routing-rules");
export const createRoutingRule = (payload) => post("/agent-settings/routing-rules", payload);
export const updateRoutingRule = (id, payload) => patch(`/agent-settings/routing-rules/${id}`, payload);
export const deleteRoutingRule = (id) => del(`/agent-settings/routing-rules/${id}`);

// ---------- EHR ----------
export const listEHRIntegrations = () => get("/ehr/integrations");
export const updateEHRIntegration = (id, payload) => patch(`/ehr/integrations/${id}`, payload);
export const listAPIKeys = () => get("/ehr/api-keys");
export const createAPIKey = (payload) => post("/ehr/api-keys", payload);
export const revokeAPIKey = (id) => del(`/ehr/api-keys/${id}`);
export const getWebhook = () => get("/ehr/webhook");
export const updateWebhook = (payload) => put("/ehr/webhook", payload);

// ---------- security ----------
export const getCompliance = () => get("/security/compliance");
export const getRoles = () => get("/security/roles");
export const getAuditLog = () => get("/security/audit-log");

// ---------- billing ----------
export const getPlan = () => get("/billing/plan");
export const listInvoices = () => get("/billing/invoices");
export const upgradePlan = () => post("/billing/upgrade");

// ---------- support ----------
export const getSupportDocs = () => get("/support/docs");
export const createSupportTicket = (payload) => post("/support/tickets", payload);

export { ApiError };
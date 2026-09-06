export const DEFAULT_GATEWAY_URL = "http://127.0.0.1:4271";
export class HSALClientError extends Error {
    status;
    code;
    details;
    constructor(status, body, fallback) {
        super(body?.message ?? fallback);
        this.name = "HSALClientError";
        this.status = status;
        this.code = body?.error ?? "UNKNOWN";
        this.details = body?.details;
    }
}
/**
 * Thin typed client for the HSAL State Gateway. Works in browsers (extension)
 * and Node (MCP server, CLI, tests). No provider-specific logic lives here.
 */
export class HSALClient {
    baseUrl;
    token;
    fetchImpl;
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? DEFAULT_GATEWAY_URL).replace(/\/+$/, "");
        this.token = options.token;
        this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    }
    setToken(token) {
        this.token = token;
    }
    async request(method, path, body, opts = {}) {
        const headers = { accept: "application/json" };
        if (body !== undefined)
            headers["content-type"] = "application/json";
        if (opts.auth !== false && this.token)
            headers["authorization"] = `Bearer ${this.token}`;
        let res;
        try {
            const init = { method, headers };
            if (body !== undefined)
                init.body = JSON.stringify(body);
            res = await this.fetchImpl(`${this.baseUrl}${path}`, init);
        }
        catch (err) {
            throw new HSALClientError(0, { error: "NETWORK", message: `cannot reach HSAL gateway at ${this.baseUrl}: ${err.message}` }, "network error");
        }
        const text = await res.text();
        let json = undefined;
        if (text) {
            try {
                json = JSON.parse(text);
            }
            catch {
                json = undefined;
            }
        }
        if (!res.ok)
            throw new HSALClientError(res.status, json, `HTTP ${res.status}`);
        return json;
    }
    // ---------------------------------------------------------------- public
    health() {
        return this.request("GET", "/health", undefined, { auth: false });
    }
    /** Exchange a pairing code for a token. Also installs the token on this client. */
    async pair(code) {
        const res = await this.request("POST", "/v1/auth/pair", { code }, { auth: false });
        this.token = res.token;
        return res;
    }
    whoami() {
        return this.request("GET", "/v1/auth/whoami");
    }
    // ---------------------------------------------------------------- beliefs
    async listBeliefs() {
        return (await this.request("GET", "/v1/beliefs")).beliefs;
    }
    async getBelief(beliefId) {
        return (await this.request("GET", `/v1/beliefs/${encodeURIComponent(beliefId)}`)).belief;
    }
    getBeliefEvidence(beliefId) {
        return this.request("GET", `/v1/beliefs/${encodeURIComponent(beliefId)}/evidence`);
    }
    getBeliefContext(beliefId) {
        return this.request("GET", `/v1/beliefs/${encodeURIComponent(beliefId)}/context`);
    }
    async listAssessments(beliefId) {
        return (await this.request("GET", `/v1/beliefs/${encodeURIComponent(beliefId)}/assessments`)).assessments;
    }
    /** Human-only. Requires belief:update-confidence. */
    async updateConfidence(beliefId, body) {
        return (await this.request("POST", `/v1/beliefs/${encodeURIComponent(beliefId)}/confidence`, body)).belief;
    }
    // ---------------------------------------------------------------- evidence
    async getEvidence(evidenceId) {
        return (await this.request("GET", `/v1/evidence/${encodeURIComponent(evidenceId)}`)).evidence;
    }
    captureEvidence(body) {
        return this.request("POST", "/v1/evidence/capture", body);
    }
    getRelation(relationId) {
        return this.request("GET", `/v1/relations/${encodeURIComponent(relationId)}`);
    }
    reviewRelation(relationId, body) {
        return this.request("POST", `/v1/relations/${encodeURIComponent(relationId)}/review`, body);
    }
    // ---------------------------------------------------------------- assessments
    createAssessment(body) {
        return this.request("POST", "/v1/assessments", body);
    }
    // ---------------------------------------------------------------- decision loop
    ensureActor(body) {
        return this.request("POST", "/v1/actors", body);
    }
    createDecisionCase(body) {
        return this.request("POST", "/v1/decision-cases", body);
    }
    async getDecisionCase(id) {
        return (await this.request("GET", `/v1/decision-cases/${encodeURIComponent(id)}`)).decisionCase;
    }
    getDecisionCaseContext(id) {
        return this.request("GET", `/v1/decision-cases/${encodeURIComponent(id)}/context`);
    }
    async listModels(decisionCaseId) {
        return (await this.request("GET", `/v1/decision-cases/${encodeURIComponent(decisionCaseId)}/models`)).models;
    }
    async listInterventions(decisionCaseId) {
        return (await this.request("GET", `/v1/decision-cases/${encodeURIComponent(decisionCaseId)}/interventions`)).interventions;
    }
    createState(body) {
        return this.request("POST", "/v1/states", body);
    }
    async getState(id) {
        return (await this.request("GET", `/v1/states/${encodeURIComponent(id)}`)).state;
    }
    createBelief(body) {
        return this.request("POST", "/v1/beliefs", body);
    }
    reviseBelief(beliefId, body) {
        return this.request("POST", `/v1/beliefs/${encodeURIComponent(beliefId)}/revisions`, body);
    }
    async listRevisions(beliefId) {
        return (await this.request("GET", `/v1/beliefs/${encodeURIComponent(beliefId)}/revisions`)).revisions;
    }
    createEvidence(body) {
        return this.request("POST", "/v1/evidence", body);
    }
    upsertModel(body) {
        return this.request("POST", "/v1/models", body);
    }
    async getModel(id) {
        return (await this.request("GET", `/v1/models/${encodeURIComponent(id)}`)).model;
    }
    upsertIntervention(body) {
        return this.request("POST", "/v1/interventions", body);
    }
    async getIntervention(id) {
        return (await this.request("GET", `/v1/interventions/${encodeURIComponent(id)}`)).intervention;
    }
    selectIntervention(id, body) {
        return this.request("POST", `/v1/interventions/${encodeURIComponent(id)}/select`, body);
    }
    createTrajectory(body) {
        return this.request("POST", "/v1/trajectories", body);
    }
    async getTrajectory(id) {
        return (await this.request("GET", `/v1/trajectories/${encodeURIComponent(id)}`)).trajectory;
    }
    appendEvent(body) {
        return this.request("POST", "/v1/events", body);
    }
    // ---------------------------------------------------------------- events
    async listEvents(query = {}) {
        const params = new URLSearchParams();
        if (query.objectId)
            params.set("objectId", query.objectId);
        if (query.type)
            params.set("type", query.type);
        if (query.limit)
            params.set("limit", String(query.limit));
        const qs = params.toString();
        return (await this.request("GET", `/v1/events${qs ? `?${qs}` : ""}`)).events;
    }
}

export const DEFAULT_API_BASE_URL = "https://api.linkchat.example";

export class LinkChatApiClient {
  constructor({ baseUrl = DEFAULT_API_BASE_URL, fetchImpl = globalThis.fetch, timeoutMs = 30_000, clientIdProvider = async () => "" } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.clientIdProvider = clientIdProvider;
  }

  draft(payload) {
    return this.request("/v1/drafts", { method: "POST", body: payload });
  }

  isConfigured() {
    return /^https:\/\//.test(this.baseUrl) && !this.baseUrl.endsWith(".example");
  }

  async request(path, { method = "GET", body } = {}) {
    if (!this.isConfigured()) {
      throw new LinkChatApiError("service-not-configured", "The hosted LinkChat API has not been configured for this build.");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      const clientId = await this.clientIdProvider();
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json", ...(clientId ? { "X-LinkChat-Install": clientId } : {}) } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        credentials: "omit",
      });
    } catch (error) {
      const code = error?.name === "AbortError" ? "service-timeout" : "service-unavailable";
      throw new LinkChatApiError(code, code === "service-timeout" ? "LinkChat took too long to respond." : "LinkChat could not reach its service.");
    } finally {
      clearTimeout(timer);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = errorText(data.code, `http-${response.status}`);
      const message = errorText(data.error, "LinkChat could not create the DM options.");
      throw new LinkChatApiError(code, message, data);
    }
    return data;
  }
}

export class LinkChatApiError extends Error {
  constructor(code, message, detail = {}) {
    super(message || code);
    this.name = "LinkChatApiError";
    this.code = code;
    this.detail = detail;
  }
}

export function errorText(value, fallback = "unknown-error") {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    for (const key of ["code", "message", "error", "type"]) {
      const nested = errorText(value[key], "");
      if (nested) return nested;
    }
  }
  return fallback;
}

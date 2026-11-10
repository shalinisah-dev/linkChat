import { LinkChatApiClient, errorText } from "./src/api-client.js";
import { createLocalDraft } from "./src/local-draft.js";
import { analyzeUntrustedText, normalizeUntrustedText } from "./src/security.js";

const LINKEDIN_ORIGIN = "https://www.linkedin.com/*";
const api = new LinkChatApiClient({ clientIdProvider: getInstallId });

const elements = {
  goal: document.querySelector("#outreachGoal"),
  details: document.querySelector("#outreachDetails"),
  create: document.querySelector("#createButton"),
  progress: document.querySelector("#progressBanner"),
  error: document.querySelector("#errorBanner"),
  results: document.querySelector("#resultSection"),
  analysis: document.querySelector("#recipientAnalysis"),
  approachBadge: document.querySelector("#approachBadge"),
  approachReason: document.querySelector("#approachReason"),
  draftList: document.querySelector("#draftList"),
  toast: document.querySelector("#toast"),
};

elements.create.addEventListener("click", createDmOptions);

async function getInstallId() {
  const current = await chrome.storage.local.get("installId");
  if (/^[0-9a-f-]{36}$/i.test(current.installId || "")) return current.installId;
  const installId = crypto.randomUUID();
  await chrome.storage.local.set({ installId });
  return installId;
}

async function createDmOptions() {
  let pageText = "";
  let capture;
  setBusy(true, "Reading this page…");
  resetMessages();
  try {
    if (!(await ensureLinkedInPermission())) throw new Error("linkedin-permission");
    capture = await chrome.runtime.sendMessage({ type: "READ_ACTIVE_PROFILE" });
    if (!capture?.ok) throw new CaptureError(capture?.code, capture?.error);

    pageText = normalizeUntrustedText(capture.text).slice(0, 20_000);
    const security = analyzeUntrustedText(pageText);
    setBusy(true, "Writing DM options…");
    const request = {
      pageText,
      goal: elements.goal.value,
      details: elements.details.value,
      contactName: capture.contactName,
      headline: capture.headline,
      captureKind: capture.captureKind,
      instructionLikeContent: security.findings.length > 0,
    };
    const response = await createDraftWithFallback(request);
    renderResult(response.result, response.model);
  } catch (error) {
    showError(friendlyError(error));
  } finally {
    pageText = "";
    if (capture?.text) capture.text = "";
    capture = undefined;
    setBusy(false);
    hideProgress();
  }
}

async function createDraftWithFallback(request) {
  if (!api.isConfigured()) return { result: createLocalDraft(request), model: "On-device" };
  try {
    return await api.draft(request);
  } catch (error) {
    if (!["service-unavailable", "service-timeout", "http-502", "http-503"].includes(error?.code)) throw error;
    return { result: createLocalDraft(request), model: "On-device fallback" };
  }
}

async function ensureLinkedInPermission() {
  if (await chrome.permissions.contains({ origins: [LINKEDIN_ORIGIN] })) return true;
  return chrome.permissions.request({ origins: [LINKEDIN_ORIGIN] });
}

function renderResult(result, model) {
  elements.analysis.textContent = result.recipient_analysis;
  elements.approachBadge.textContent = result.approach.label;
  elements.approachReason.textContent = `${result.approach.reason}${model ? ` · ${model}` : ""}`;
  elements.draftList.replaceChildren(...result.dm_options.map((draft, index) => createDraftCard(draft, index)));
  elements.results.classList.remove("hidden");
  elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createDraftCard(draft, index) {
  const card = document.createElement("article");
  card.className = "draft-card";
  const heading = document.createElement("div");
  heading.className = "draft-heading";
  const label = document.createElement("h3");
  label.textContent = draft.label || `Option ${index + 1}`;
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "copy-button";
  copy.textContent = "Copy";
  const text = document.createElement("textarea");
  text.className = "draft-text";
  text.value = draft.text;
  text.rows = 6;
  text.setAttribute("aria-label", `${label.textContent} message`);
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(text.value);
    showToast("DM copied");
  });
  heading.append(label, copy);
  card.append(heading, text);
  return card;
}

function friendlyError(error) {
  const code = errorText(error?.code || error?.message || error, "unknown-error");
  if (code === "service-not-configured") return "This preview has not been connected to the LinkChat service yet.";
  if (code === "service-unavailable") return "LinkChat’s service could not be reached. Check your connection and try again.";
  if (code === "service-timeout") return "LinkChat took too long to respond. Try again.";
  if (code === "rate-limit-exceeded") return "You’ve reached the current drafting limit. Try again later.";
  if (code === "linkedin-permission") return "Allow LinkedIn access so LinkChat can read the page when you click Create DM options.";
  if (error?.code === "not-linkedin") return "Open the person’s LinkedIn profile or activity page, then try again.";
  if (error?.code === "page-access-denied") return "Chrome could not read this LinkedIn tab. Refresh the page, reopen LinkChat, and try again.";
  if (error?.code === "no-readable-content") return "This page has not finished loading yet. Wait a moment, then try again.";
  if (error?.code === "no-activity-items") return "No visible activity was found on this page. Open the person’s profile or another activity tab.";
  if (code === "source-overlap") return "The draft copied too much from the page, so LinkChat discarded it. Try again.";
  if (["invalid-model-output", "draft-too-long", "response-incomplete"].includes(code)) return "The drafting service returned an incomplete result. Try again.";
  return `LinkChat could not create the DM options. (${safeErrorCode(code)})`;
}

class CaptureError extends Error {
  constructor(code, message) {
    super(message || code || "capture-failed");
    this.code = code || "capture-failed";
  }
}

function resetMessages() {
  hideError();
  resetResults();
}

function resetResults() {
  elements.results.classList.add("hidden");
  elements.draftList.replaceChildren();
}

function showProgress(message) {
  elements.progress.textContent = message;
  elements.progress.classList.remove("hidden");
}

function hideProgress() {
  elements.progress.classList.add("hidden");
  elements.progress.textContent = "";
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.classList.remove("hidden");
}

function hideError() {
  elements.error.classList.add("hidden");
  elements.error.textContent = "";
}

function setBusy(busy, label = "Working…") {
  if (busy) {
    if (!elements.create.dataset.label) elements.create.dataset.label = elements.create.textContent;
    elements.create.textContent = label;
    elements.create.disabled = true;
  } else {
    elements.create.textContent = elements.create.dataset.label || "Create DM options";
    elements.create.disabled = false;
  }
}

function safeErrorCode(value) {
  return errorText(value, "unknown-error").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 1800);
}

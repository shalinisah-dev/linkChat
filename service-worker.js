import { classifyLinkedInPage, extractVisibleProfile } from "./src/page-capture.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Could not configure the side panel", error));
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Could not configure the side panel", error));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "READ_ACTIVE_PROFILE") return false;

  readActiveProfile().then(sendResponse);
  return true;
});

async function readActiveProfile() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab was found.");
    if (!/(^|\.)linkedin\.com$/i.test(new URL(tab.url || "about:blank").hostname)) {
      return { ok: false, code: "not-linkedin", error: "This is not a LinkedIn page." };
    }
    const captureKind = classifyLinkedInPage(tab.url || "");

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractVisibleProfile,
      args: [captureKind],
    });

    return injection?.result || {
      ok: false,
      code: "no-readable-content",
      error: "No readable profile text was found.",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const denied = /cannot access|permission|not allowed/i.test(detail);
    return {
      ok: false,
      code: denied ? "page-access-denied" : "capture-failed",
      error: denied ? "Chrome blocked access to this page." : "The page could not be read.",
      detail,
    };
  }
}

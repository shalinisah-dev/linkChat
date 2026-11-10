export function classifyLinkedInPage(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return "profile-overview";
  }
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return "profile-overview";
  const pathname = url.pathname.toLowerCase().replace(/\/+$/, "");
  if (/\/recent-activity\/comments$/.test(pathname)) return "comments";
  if (/\/recent-activity\/(?:reactions|likes)$/.test(pathname)) return "reactions";
  if (/\/recent-activity(?:\/(?:all|posts|shares))?$/.test(pathname)) return "posts";
  return "profile-overview";
}

export function extractVisibleProfile(captureKind = "profile-overview") {
  const cleanLine = (value) => (value || "").replace(/\s+/g, " ").trim();
  const cleanBlock = (value) =>
    (value || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map(cleanLine)
      .filter(Boolean)
      .join("\n")
      .trim();
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  // chrome.scripting serializes this function without module scope, so activity
  // selection must remain self-contained here.
  const selectActivityText = (existing, candidate, limit = 10) => {
    const selected = existing.slice(0, limit);
    const value = String(candidate || "").trim();
    if (value.length < 30 || value.length > 6_000 || selected.length >= limit) return selected;
    if (selected.some((item) => item === value || item.includes(value) || value.includes(item))) return selected;
    selected.push(value);
    return selected;
  };

  const selection = cleanBlock(window.getSelection()?.toString());
  const title = cleanLine(document.title).replace(/\s*\|\s*LinkedIn.*$/i, "");
  const profilePath = location.pathname.match(/\/in\/([^/]+)/i);
  const contactRef = profilePath ? `linkedin:${decodeURIComponent(profilePath[1]).toLowerCase()}` : "";
  const headingCandidates = [...document.querySelectorAll("main h1, [role='main'] h1, h1")]
    .filter(visible)
    .map((element) => cleanLine(element.textContent))
    .filter(Boolean);
  const nonIdentityHeading = /^(?:activity|recent activity|all activity|posts|comments|reactions|likes)$/i;
  const titleIdentity = title.match(/^(?:posts|comments|reactions|activity)\s+(?:by|from)\s+(.+)$/i)?.[1] || "";
  const contactName =
    headingCandidates.find((value) => !nonIdentityHeading.test(value)) ||
    titleIdentity.trim() ||
    (captureKind === "profile-overview" ? title.split(/[|–—]/)[0]?.trim() || "" : "");

  const roots = ["main", "[role='main']", ".scaffold-layout__main", ".pv-profile-body-wrapper", "article"]
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter(visible)
    .sort((a, b) => cleanLine(b.innerText).length - cleanLine(a.innerText).length);
  const root = roots[0] || document.body;
  const visibleText = cleanBlock(root?.innerText).slice(0, 20_000);
  let items = [];
  let text = selection.length >= 20 ? selection.slice(0, 20_000) : visibleText;

  if (captureKind !== "profile-overview" && selection.length < 20) {
    const categorySelectors = {
      posts: [".feed-shared-update-v2", "[data-urn*='urn:li:activity']", "[data-view-name*='feed-full-update']", "article"],
      comments: [".comments-comment-item", "[data-view-name*='comment']", "[data-urn*='comment']", "article"],
      reactions: [".feed-shared-update-v2", "[data-urn*='urn:li:activity']", "[data-view-name*='feed-full-update']", "article"],
    };
    const seenElements = new Set();
    const selectors = categorySelectors[captureKind] || ["article"];
    outer: for (const selector of selectors) {
      for (const element of root.querySelectorAll(selector)) {
        if (seenElements.has(element) || !visible(element)) continue;
        seenElements.add(element);
        const candidate = cleanBlock(element.innerText);
        items = selectActivityText(items, candidate, 10);
        if (items.length === 10) break outer;
      }
    }

    if (!items.length) {
      return {
        ok: false,
        code: "no-activity-items",
        error: `No visible ${captureKind} were found.`,
      };
    }

    text = items
      .map((item, index) => `ACTIVITY ITEM ${index + 1}\n${item}`)
      .join("\n\n---\n\n")
      .slice(0, 20_000);
  }

  if (text.length < 20) return { ok: false, code: "no-readable-content", error: "Not enough visible text was found." };

  const lines = (root?.innerText || "").split("\n").map(cleanLine).filter(Boolean);
  const nameIndex = lines.findIndex((line) => line === contactName);
  const nearby = nameIndex >= 0 ? lines.slice(nameIndex + 1, nameIndex + 8) : lines.slice(0, 8);
  const headline = nearby.find(
    (line) => line.length >= 12 && line.length <= 220 && !/^(contact info|connections?|message|follow)$/i.test(line),
  );

  return {
    ok: true,
    sourceKind: selection.length >= 20 ? "user-selection" : "visible-page",
    captureKind,
    itemCount: items.length || (captureKind === "profile-overview" ? 0 : 1),
    contactName,
    contactRef,
    headline: captureKind === "profile-overview" ? headline || "" : "",
    role: "",
    text,
  };
}

export function selectDistinctActivityTexts(existing, candidate, limit = 10) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be a positive integer");
  const items = existing.slice(0, limit);
  const value = String(candidate || "").trim();
  if (value.length < 30 || value.length > 6_000 || items.length >= limit) return items;
  if (items.some((item) => item === value || item.includes(value) || value.includes(item))) return items;
  items.push(value);
  return items;
}

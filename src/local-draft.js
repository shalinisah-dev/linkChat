import { APPROACHES, validateDmResult } from "./dm-agent.js";

const GOAL_PLANS = Object.freeze({
  mentorship: ["curious-learner", "learn from your experience", "Would you be open to a brief conversation sometime in the next couple of weeks?"],
  "informational-interview": ["curious-learner", "learn more about your path and the work you do", "Would you be open to a short informational conversation?"],
  "interview-candidate": ["thoughtful-recruiter", "discuss an interview opportunity that may be relevant", "Would you be open to hearing a little more about it?"],
  "hire-candidate": ["thoughtful-recruiter", "explore whether a role we are hiring for could be relevant", "Would you be open to a short, no-pressure conversation?"],
  "job-opportunity": ["direct-operator", "ask about opportunities where my background might be useful", "Would you be open to a brief conversation or pointing me in the right direction?"],
  partnership: ["strategic-collaborator", "explore whether there could be a useful partnership", "Would you be open to a short call to see if there is a real fit?"],
  "customer-discovery": ["curious-learner", "get your perspective on a product problem I am researching", "Would you be open to a short feedback conversation?"],
  networking: ["warm-peer", "make a thoughtful professional connection", "Would you be open to connecting and having a brief conversation?"],
  reconnect: ["warm-peer", "reconnect and hear what you have been working on", "Would you be open to catching up sometime soon?"],
  other: ["direct-operator", "start a focused professional conversation", "Would you be open to a brief conversation?"],
});

export function createLocalDraft({ goal, details = "", contactName = "", headline = "", pageText = "" } = {}) {
  const [approachId, intent, ask] = GOAL_PLANS[goal] || GOAL_PLANS.other;
  const approach = APPROACHES.find(({ id }) => id === approachId);
  const name = safeFirstName(contactName);
  const salutation = name ? `Hi ${name}` : "Hi";
  const profileCue = safeProfileCue(headline);
  const userContext = safeUserContext(details);
  const relevance = profileCue ? `Your work around ${profileCue} caught my attention.` : "Your professional background caught my attention.";
  const context = userContext ? `For context, ${userContext}` : "I wanted to reach out directly and keep the ask simple.";

  const result = {
    recipient_analysis: `LinkChat found enough visible professional context to draft the outreach, but the on-device mode deliberately avoids making personality or private-trait inferences. The messages use a ${approach.label.toLowerCase()} approach and keep the request easy to decline.`,
    approach: {
      id: approach.id,
      label: approach.label,
      reason: `This outcome benefits from ${approach.use}. The on-device draft stays conservative when context is incomplete.`,
    },
    dm_options: [
      { label: "Direct", text: `${salutation} — ${relevance} I’m reaching out to ${intent}. ${context} ${ask}` },
      { label: "Warm", text: `${salutation}, I came across your profile and ${profileCue ? `was interested in your work around ${profileCue}` : "wanted to introduce myself"}. I’d like to ${intent}. ${context} ${ask}` },
      { label: "Concise", text: `${salutation} — I’m reaching out to ${intent}. ${profileCue ? `Your background in ${profileCue} seemed relevant. ` : ""}${ask}` },
    ],
    unknowns: ["Whether this request is currently relevant to the recipient", "The recipient’s preferred communication style"],
  };
  return validateDmResult(result, pageText);
}

function safeFirstName(value) {
  const match = String(value || "").trim().match(/[\p{L}\p{M}'’-]+/u);
  return match?.[0]?.slice(0, 40) || "";
}

function safeProfileCue(value) {
  const words = String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .match(/[\p{L}\p{N}&+.#'’-]+/gu) || [];
  return words.slice(0, 6).join(" ").slice(0, 100);
}

function safeUserContext(value) {
  const words = String(value || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return "";
  const text = words.slice(0, 35).join(" ").replace(/[.!?]*$/, ".");
  return text.charAt(0).toLowerCase() + text.slice(1);
}

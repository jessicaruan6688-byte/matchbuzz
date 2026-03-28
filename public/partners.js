const PARTNER_UI_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const PARTNER_QUERY = new URLSearchParams(window.location.search);
const TeamUI = window.MatchBuzzTeams || null;

const PARTNER_TEXT = {
  en: {
    loading: "Loading sponsor packages...",
    empty: "No sponsor packages are available right now.",
    select: "Request This Package",
    success: "Lead captured. This sponsor request is now stored in the backend.",
    entry: "Entry",
    audience: "Audience",
    defaultTitle: "Sponsor packages tied to football traffic, not abstract slides.",
    defaultCopy: "These packages sit next to fan rooms, watch parties, and match pages so the business model is clickable.",
    focusedTitle: (fixture) => `Sponsor packages for ${fixture}`,
    focusedCopy: "This fixture context has been carried into sponsor acquisition and conversion planning."
  },
  zh: {
    loading: "正在加载赞助合作包...",
    empty: "当前暂无赞助合作包。",
    select: "申请这个合作包",
    success: "线索已提交，这条赞助申请已写入后端。",
    entry: "起投门槛",
    audience: "覆盖人群",
    defaultTitle: "把赞助合作做成和足球流量绑定的真实入口，而不是抽象概念。",
    defaultCopy: "这些合作包直接挂在球迷房、观赛活动和赛事页旁边，商业模式是可点击的。",
    focusedTitle: (fixture) => `${fixture} 的赞助合作包`,
    focusedCopy: "当前比赛上下文已经带入赞助获客和转化规划页。"
  }
};

const partnerState = {
  packages: [],
  selectedId: null
};

const partnerElements = {
  contextTitle: document.querySelector("#partner-context-title"),
  contextCopy: document.querySelector("#partner-context-copy"),
  list: document.querySelector("#partner-package-list"),
  form: document.querySelector("#partner-lead-form"),
  feedback: document.querySelector("#partner-feedback"),
  packageInput: document.querySelector("#partner-package-id"),
  intelTitle: document.querySelector("#partner-intel-title"),
  intelCopy: document.querySelector("#partner-intel-copy"),
  intelChips: document.querySelector("#partner-intel-chips")
};

function partnerText() {
  return PARTNER_TEXT[PARTNER_UI_LOCALE];
}

function partnerEscape(value) {
  if (TeamUI && typeof TeamUI.escapeHtml === "function") {
    return TeamUI.escapeHtml(value);
  }
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function partnerPick(entry, key) {
  return PARTNER_UI_LOCALE === "zh" ? entry[`${key}Zh`] || entry[key] : entry[key];
}

async function partnerFetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function renderIntel(intel) {
  if (!intel || !partnerElements.intelTitle || !partnerElements.intelCopy || !partnerElements.intelChips) {
    return;
  }

  partnerElements.intelTitle.textContent = intel.title;
  partnerElements.intelCopy.textContent = intel.copy;
  partnerElements.intelChips.innerHTML = (intel.chips || [])
    .map((chip, index) => `<span class="status-pill${index % 2 === 1 ? " status-pill-alt" : ""}">${partnerEscape(chip)}</span>`)
    .join("");
}

function renderPartnerContext() {
  const fixtureLabel = PARTNER_QUERY.get("fixtureLabel");
  if (fixtureLabel) {
    partnerElements.contextTitle.textContent = partnerText().focusedTitle(fixtureLabel);
    partnerElements.contextCopy.textContent = partnerText().focusedCopy;
    return;
  }

  partnerElements.contextTitle.textContent = partnerText().defaultTitle;
  partnerElements.contextCopy.textContent = partnerText().defaultCopy;
}

function renderPackageCard(item) {
  const surfaces = (partnerPick(item, "surfaces") || [])
    .map((entry) => `<li>${partnerEscape(entry)}</li>`)
    .join("");
  const outcomes = (partnerPick(item, "outcomes") || [])
    .map((entry) => `<span class="status-pill status-pill-alt">${partnerEscape(entry)}</span>`)
    .join("");
  const active = item.id === partnerState.selectedId ? " room-card-active" : "";

  return `
    <article class="panel package-card${active}">
      <p class="eyebrow">${partnerEscape(item.tier)}</p>
      <h4>${partnerEscape(partnerPick(item, "name"))}</h4>
      <p class="depth-copy">${partnerEscape(partnerPick(item, "summary"))}</p>
      <div class="room-meta-grid">
        <div class="meta-card">
          <strong>${partnerEscape(partnerPick(item, "priceFrom"))}</strong>
          <span>${partnerText().entry}</span>
        </div>
        <div class="meta-card">
          <strong>${partnerEscape(partnerPick(item, "audience"))}</strong>
          <span>${partnerText().audience}</span>
        </div>
      </div>
      <ul class="deep-list">${surfaces}</ul>
      <div class="revenue-chip-row">${outcomes}</div>
      <div class="ops-actions">
        <button class="button button-primary" data-package-id="${partnerEscape(item.id)}" type="button">${partnerText().select}</button>
      </div>
    </article>
  `;
}

function wirePackageButtons() {
  partnerElements.list.querySelectorAll("[data-package-id]").forEach((button) => {
    button.addEventListener("click", () => {
      partnerState.selectedId = button.dataset.packageId;
      partnerElements.packageInput.value = partnerState.selectedId;
      partnerElements.list.innerHTML = partnerState.packages.map(renderPackageCard).join("");
      wirePackageButtons();
      partnerElements.form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function loadPackages() {
  partnerElements.list.className = "community-room-grid empty-state";
  partnerElements.list.innerHTML = `<p>${partnerText().loading}</p>`;
  const params = new URLSearchParams({
    language: PARTNER_UI_LOCALE
  });
  if (PARTNER_QUERY.get("fixtureLabel")) {
    params.set("fixtureLabel", PARTNER_QUERY.get("fixtureLabel"));
  }

  const data = await partnerFetchJson(`/api/sponsor-packages?${params.toString()}`);
  renderIntel(data.intel);
  partnerState.packages = data.packages;
  partnerState.selectedId = data.packages[0]?.id || null;
  partnerElements.packageInput.value = partnerState.selectedId || "";

  if (!partnerState.packages.length) {
    partnerElements.list.innerHTML = `<p>${partnerText().empty}</p>`;
    return;
  }

  partnerElements.list.className = "community-room-grid";
  partnerElements.list.innerHTML = partnerState.packages.map(renderPackageCard).join("");
  wirePackageButtons();
}

partnerElements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(partnerElements.form);
  partnerElements.feedback.textContent = PARTNER_UI_LOCALE === "zh" ? "正在提交..." : "Submitting...";

  try {
    const result = await partnerFetchJson("/api/sponsor-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: PARTNER_UI_LOCALE,
        packageId: form.get("packageId"),
        fixtureId: PARTNER_QUERY.get("fixtureId"),
        companyName: form.get("companyName"),
        contactName: form.get("contactName"),
        email: form.get("email"),
        market: form.get("market"),
        goal: form.get("goal")
      })
    });

    partnerElements.form.reset();
    partnerElements.packageInput.value = partnerState.selectedId || "";
    partnerElements.feedback.textContent = `${partnerText().success} #${result.lead.id}`;
  } catch (error) {
    partnerElements.feedback.textContent = error.message;
  }
});

renderPartnerContext();
if (TeamUI && typeof TeamUI.decorateFlagNodes === "function") {
  TeamUI.decorateFlagNodes(document);
}
loadPackages().catch((error) => {
  partnerElements.list.className = "community-room-grid empty-state";
  partnerElements.list.innerHTML = `<p>${partnerEscape(error.message)}</p>`;
});

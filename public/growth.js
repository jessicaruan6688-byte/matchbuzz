const GROWTH_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";

const growthElements = {
  intelTitle: document.querySelector("#growth-intel-title"),
  intelCopy: document.querySelector("#growth-intel-copy"),
  intelChips: document.querySelector("#growth-intel-chips"),
  kpiGrid: document.querySelector("#growth-kpi-grid"),
  focusGrid: document.querySelector("#growth-focus-grid"),
  ruleList: document.querySelector("#growth-rule-list"),
  seoSurfaceList: document.querySelector("#growth-seo-surface-list"),
  seoChecklist: document.querySelector("#growth-seo-checklist"),
  feedback: document.querySelector("#growth-feedback")
};

const GROWTH_TEXT = {
  en: {
    loadFailed: "Growth board failed to load.",
    open: "Open route",
    referralHint: "Triggered automatically when a new member lands in this level.",
    luckyHint: "Triggered automatically when a lucky member number is created."
  },
  zh: {
    loadFailed: "增长看板加载失败。",
    open: "打开页面",
    referralHint: "当新会员落入这一层时，会自动发放奖励。",
    luckyHint: "当注册到幸运会员编号时，会自动触发。"
  }
};

function growthText() {
  return GROWTH_TEXT[GROWTH_LOCALE];
}

function escapeGrowthHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchGrowthJson(url) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function setGrowthFeedback(message) {
  if (!growthElements.feedback) {
    return;
  }

  growthElements.feedback.textContent = message || "";
}

function renderIntel(intel) {
  if (!intel) {
    return;
  }

  if (growthElements.intelTitle) {
    growthElements.intelTitle.textContent = intel.title || "";
  }
  if (growthElements.intelCopy) {
    growthElements.intelCopy.textContent = intel.copy || "";
  }
  if (growthElements.intelChips) {
    growthElements.intelChips.innerHTML = (intel.chips || [])
      .map(
        (chip, index) => `
          <span class="status-pill${index % 2 === 1 ? " status-pill-alt" : ""}">${escapeGrowthHtml(chip)}</span>
        `
      )
      .join("");
  }
}

function renderMetricCards(target, items) {
  if (!target) {
    return;
  }

  target.innerHTML = (items || [])
    .map(
      (item) => `
        <article class="growth-kpi-card">
          <strong>${escapeGrowthHtml(item.value)}</strong>
          <span>${escapeGrowthHtml(item.label)}</span>
          <p>${escapeGrowthHtml(item.note)}</p>
        </article>
      `
    )
    .join("");
}

function renderRules(rules) {
  if (!growthElements.ruleList || !rules) {
    return;
  }

  const text = growthText();
  const referralItems = (rules.referralBonuses || []).map(
    (item) => `
      <article class="storyline-item">
        <strong>${escapeGrowthHtml(item.label)} · ${escapeGrowthHtml(item.points)}</strong>
        <span>${escapeGrowthHtml(text.referralHint)}</span>
      </article>
    `
  );
  const luckyItems = (rules.luckyBonuses || []).map(
    (item) => `
      <article class="storyline-item">
        <strong>${escapeGrowthHtml(item.label)} · ${escapeGrowthHtml(item.points)}</strong>
        <span>${escapeGrowthHtml(text.luckyHint)}</span>
      </article>
    `
  );

  growthElements.ruleList.innerHTML = referralItems.concat(luckyItems).join("");
}

function renderSeo(seo) {
  if (growthElements.seoSurfaceList) {
    growthElements.seoSurfaceList.innerHTML = (seo?.surfaces || [])
      .map(
        (item) => `
          <a class="storyline-item" href="${escapeGrowthHtml(item.path)}">
            <strong>${escapeGrowthHtml(item.label)} · ${escapeGrowthHtml(item.count)}</strong>
            <span>${escapeGrowthHtml(item.note)}</span>
            <span class="growth-surface-link">${escapeGrowthHtml(growthText().open)}</span>
          </a>
        `
      )
      .join("");
  }

  if (growthElements.seoChecklist) {
    growthElements.seoChecklist.innerHTML = (seo?.checklist || [])
      .map((item) => `<li>${escapeGrowthHtml(item)}</li>`)
      .join("");
  }
}

async function initGrowthPage() {
  if (!growthElements.kpiGrid) {
    return;
  }

  try {
    const data = await fetchGrowthJson(`/api/growth/overview?language=${GROWTH_LOCALE}`);
    renderIntel(data.intel);
    renderMetricCards(growthElements.kpiGrid, data.kpis);
    renderMetricCards(growthElements.focusGrid, data.focusMetrics);
    renderRules(data.rules);
    renderSeo(data.seo);
    setGrowthFeedback("");
  } catch (error) {
    setGrowthFeedback(`${growthText().loadFailed} ${error.message}`);
  }
}

initGrowthPage();

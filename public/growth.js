const GROWTH_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";

const growthElements = {
  intelTitle: document.querySelector("#growth-intel-title"),
  intelCopy: document.querySelector("#growth-intel-copy"),
  intelChips: document.querySelector("#growth-intel-chips"),
  kpiGrid: document.querySelector("#growth-kpi-grid"),
  focusGrid: document.querySelector("#growth-focus-grid"),
  trafficGrid: document.querySelector("#growth-traffic-grid"),
  channelList: document.querySelector("#growth-channel-list"),
  landingList: document.querySelector("#growth-landing-list"),
  routeList: document.querySelector("#growth-route-list"),
  fixtureList: document.querySelector("#growth-fixture-list"),
  activityList: document.querySelector("#growth-activity-list"),
  dispatchGrid: document.querySelector("#growth-dispatch-grid"),
  dispatchList: document.querySelector("#growth-dispatch-list"),
  ruleList: document.querySelector("#growth-rule-list"),
  seoSurfaceList: document.querySelector("#growth-seo-surface-list"),
  seoChecklist: document.querySelector("#growth-seo-checklist"),
  feedback: document.querySelector("#growth-feedback")
};

const GROWTH_TEXT = {
  en: {
    loadFailed: "Growth board failed to load.",
    open: "Open route",
    noTraffic:
      "No tracked traffic yet. Open the site, move through product pages, and this operating board will begin to populate.",
    noDispatch: "No saved campaigns yet. Create one from the homepage studio to populate this queue.",
    referralHint: "Triggered automatically when a new member lands in this level.",
    luckyHint: "Triggered automatically when a lucky member number is created."
  },
  zh: {
    loadFailed: "增长看板加载失败。",
    open: "打开页面",
    noTraffic: "还没有记录到真实流量。先打开站点并点击真实页面，这块运营看板就会开始出现数据。",
    noDispatch: "还没有保存的活动。先去首页生成台创建一个活动工作区。",
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

function renderMetricCards(target, items, emptyMessage = growthText().noTraffic) {
  if (!target) {
    return;
  }

  if (!items || !items.length) {
    target.innerHTML = `
      <article class="growth-kpi-card">
        <strong>0</strong>
        <span>${escapeGrowthHtml(growthText().open)}</span>
        <p>${escapeGrowthHtml(emptyMessage)}</p>
      </article>
    `;
    return;
  }

  target.innerHTML = items
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

function formatGrowthTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(GROWTH_LOCALE === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderOpsList(target, items, emptyMessage) {
  if (!target) {
    return;
  }

  if (!items || !items.length) {
    target.className = "storyline-list empty-state";
    target.innerHTML = `<p>${escapeGrowthHtml(emptyMessage)}</p>`;
    return;
  }

  target.className = "storyline-list";
  target.innerHTML = items
    .map((item) => {
      const href = item.href ? escapeGrowthHtml(item.href) : "";
      const metric = item.metric ? `<span class="storyline-item-metric">${escapeGrowthHtml(item.metric)}</span>` : "";
      const timestamp = item.timestamp
        ? `<span class="storyline-item-time">${escapeGrowthHtml(formatGrowthTime(item.timestamp))}</span>`
        : "";
      const tag = href ? "a" : "article";
      const tagAttrs = href ? ` href="${href}"` : "";
      const openLabel = href ? `<span class="growth-surface-link">${escapeGrowthHtml(growthText().open)}</span>` : "";

      return `
        <${tag} class="storyline-item"${tagAttrs}>
          <div class="storyline-item-head">
            <strong>${escapeGrowthHtml(item.title)}</strong>
            ${metric}
          </div>
          <span>${escapeGrowthHtml(item.note || "")}</span>
          ${timestamp}
          ${openLabel}
        </${tag}>
      `;
    })
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
            <div class="storyline-item-head">
              <strong>${escapeGrowthHtml(item.label)}</strong>
              <span class="storyline-item-metric">${escapeGrowthHtml(item.count)}</span>
            </div>
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

function renderTraffic(traffic) {
  renderMetricCards(growthElements.trafficGrid, traffic?.kpis || [], growthText().noTraffic);
  renderOpsList(growthElements.channelList, traffic?.channels || [], growthText().noTraffic);
  renderOpsList(growthElements.landingList, traffic?.landings || [], growthText().noTraffic);
  renderOpsList(growthElements.routeList, traffic?.routes || [], growthText().noTraffic);
  renderOpsList(growthElements.fixtureList, traffic?.fixtures || [], growthText().noTraffic);
  renderOpsList(growthElements.activityList, traffic?.recent || [], growthText().noTraffic);
}

function renderDispatch(dispatch) {
  renderMetricCards(growthElements.dispatchGrid, dispatch?.kpis || [], growthText().noDispatch);
  renderOpsList(growthElements.dispatchList, dispatch?.queue || [], growthText().noDispatch);
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
    renderTraffic(data.traffic);
    renderDispatch(data.dispatch);
    renderRules(data.rules);
    renderSeo(data.seo);
    setGrowthFeedback("");
  } catch (error) {
    setGrowthFeedback(`${growthText().loadFailed} ${error.message}`);
  }
}

initGrowthPage();

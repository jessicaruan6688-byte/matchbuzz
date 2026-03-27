const UI_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const QUERY = new URLSearchParams(window.location.search);

const UI_TEXT = {
  en: {
    loading: "Loading fixture detail...",
    missingId: "Missing fixture id.",
    fallback: "Not available",
    rank: "Rank",
    points: "Pts",
    form: "Form",
    openStudio: "Open In Studio",
    noTable: "No standings returned from the live feed.",
    noList: "No related fixtures available.",
    status: "Status",
    league: "League",
    season: "Season",
    venue: "Venue",
    kickoff: "Kickoff"
  },
  zh: {
    loading: "正在加载比赛详情...",
    missingId: "缺少比赛 id。",
    fallback: "暂无",
    rank: "排名",
    points: "积分",
    form: "近况",
    openStudio: "带入生成台",
    noTable: "真实数据源暂未返回积分榜。",
    noList: "暂无关联比赛。",
    status: "状态",
    league: "联赛",
    season: "赛季",
    venue: "场地",
    kickoff: "开球时间"
  }
};

const elements = {
  hero: document.querySelector("#match-hero"),
  meta: document.querySelector("#match-meta"),
  facts: document.querySelector("#match-facts"),
  table: document.querySelector("#table-list"),
  recent: document.querySelector("#recent-list"),
  upcoming: document.querySelector("#upcoming-list"),
  openStudio: document.querySelector("#open-studio-link")
};

function text() {
  return UI_TEXT[UI_LOCALE];
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function formatKickoff(value) {
  return new Intl.DateTimeFormat(UI_LOCALE === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function studioPath(id) {
  return UI_LOCALE === "zh"
    ? `/zh/index.html?fixtureId=${encodeURIComponent(id)}#studio`
    : `/?fixtureId=${encodeURIComponent(id)}#studio`;
}

function matchPath(id) {
  return UI_LOCALE === "zh" ? `/zh/match.html?id=${encodeURIComponent(id)}` : `/match.html?id=${encodeURIComponent(id)}`;
}

function renderHero(fixture) {
  const scoreLine =
    fixture.homeScore !== null && fixture.homeScore !== undefined && fixture.awayScore !== null && fixture.awayScore !== undefined
      ? `<div class="fixture-scoreline"><strong>${fixture.homeScore}</strong><span>:</span><strong>${fixture.awayScore}</strong></div>`
      : `<div class="fixture-scoreline fixture-scoreline-pending"><span>${text().kickoff}</span><strong>${formatKickoff(
          fixture.kickOff
        )}</strong></div>`;

  elements.hero.className = "fixture-hero-inner";
  elements.hero.innerHTML = `
    <div class="fixture-badge-strip">
      ${fixture.leagueBadge ? `<img src="${fixture.leagueBadge}" alt="${fixture.league || ""}" class="league-badge" />` : ""}
      <span class="fixture-status">${fixture.status || text().fallback}</span>
    </div>
    <div class="fixture-detail-row">
      <div class="fixture-detail-team">
        ${fixture.homeBadge ? `<img src="${fixture.homeBadge}" alt="${fixture.homeTeam}" />` : ""}
        <strong>${fixture.homeTeam}</strong>
      </div>
      ${scoreLine}
      <div class="fixture-detail-team fixture-detail-team-right">
        ${fixture.awayBadge ? `<img src="${fixture.awayBadge}" alt="${fixture.awayTeam}" />` : ""}
        <strong>${fixture.awayTeam}</strong>
      </div>
    </div>
    <p class="hero-text">${fixture.storyline}</p>
  `;
}

function renderMeta(fixture) {
  const items = [
    { label: text().league, value: fixture.league || fixture.stage || text().fallback },
    { label: text().season, value: fixture.season || text().fallback },
    { label: text().status, value: fixture.status || text().fallback },
    { label: text().venue, value: fixture.city || text().fallback },
    { label: text().kickoff, value: formatKickoff(fixture.kickOff) }
  ];

  elements.meta.innerHTML = items
    .map(
      (item) => `
        <div class="meta-card">
          <strong>${item.label}</strong>
          <span>${item.value}</span>
        </div>
      `
    )
    .join("");
}

function renderFacts(fixture) {
  elements.facts.innerHTML = (fixture.facts || [])
    .map((fact) => `<li>${fact}</li>`)
    .join("");
}

function renderTable(table, fixture) {
  if (!table.length) {
    elements.table.className = "table-list empty-state";
    elements.table.innerHTML = `<p>${text().noTable}</p>`;
    return;
  }

  elements.table.className = "table-list";
  elements.table.innerHTML = table
    .map((row) => {
      const active = row.team === fixture.homeTeam || row.team === fixture.awayTeam ? " table-row-active" : "";
      return `
        <div class="table-row${active}">
          <div class="table-team">
            <span>${text().rank} ${row.rank}</span>
            <strong>${row.team}</strong>
          </div>
          <div class="table-stats">
            <span>${text().points} ${row.points}</span>
            <span>${text().form} ${row.form || "-"}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMiniFixtures(element, list) {
  if (!list.length) {
    element.className = "mini-fixture-list empty-state";
    element.innerHTML = `<p>${text().noList}</p>`;
    return;
  }

  element.className = "mini-fixture-list";
  element.innerHTML = list
    .map(
      (fixture) => `
        <a class="mini-fixture-item" href="${matchPath(fixture.id)}">
          <strong>${fixture.homeTeam} vs ${fixture.awayTeam}</strong>
          <span>${formatKickoff(fixture.kickOff)}</span>
        </a>
      `
    )
    .join("");
}

async function bootstrap() {
  const id = QUERY.get("id");
  if (!id) {
    throw new Error(text().missingId);
  }

  const data = await fetchJson(`/api/real/fixtures/${id}`);
  renderHero(data.fixture);
  renderMeta(data.fixture);
  renderFacts(data.fixture);
  renderTable(data.table || [], data.fixture);
  renderMiniFixtures(elements.recent, data.recent || []);
  renderMiniFixtures(elements.upcoming, data.upcoming || []);
  elements.openStudio.href = studioPath(data.fixture.id);
  elements.openStudio.textContent = text().openStudio;
}

bootstrap().catch((error) => {
  elements.hero.className = "fixture-hero-inner empty-state";
  elements.hero.innerHTML = `<p>${error.message}</p>`;
});

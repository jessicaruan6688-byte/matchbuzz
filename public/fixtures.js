const UI_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const TeamUI = window.MatchBuzzTeams || null;

const UI_TEXT = {
  en: {
    title: {
      upcoming: "Upcoming Fixtures",
      recent: "Recent Results"
    },
    loading: "Loading real fixtures...",
    empty: "No fixtures available from the live feed right now.",
    openMatch: "Open Match",
    openStudio: "Open In Studio",
    kickoff: "Kickoff",
    finalScore: "Final",
    round: "Round",
    source: "TheSportsDB"
  },
  zh: {
    title: {
      upcoming: "即将开始的比赛",
      recent: "最近结果"
    },
    loading: "正在加载真实赛事...",
    empty: "当前真实数据源没有返回比赛。",
    openMatch: "查看比赛",
    openStudio: "带入生成台",
    kickoff: "开球时间",
    finalScore: "最终比分",
    round: "轮次",
    source: "TheSportsDB"
  }
};

const state = {
  scope: "upcoming"
};

const elements = {
  title: document.querySelector("#fixtures-title"),
  provider: document.querySelector("#fixtures-provider"),
  list: document.querySelector("#fixtures-list"),
  intelTitle: document.querySelector("#fixtures-intel-title"),
  intelCopy: document.querySelector("#fixtures-intel-copy"),
  intelChips: document.querySelector("#fixtures-intel-chips")
};

function text() {
  return UI_TEXT[UI_LOCALE];
}

function renderTeamName(teamName) {
  if (TeamUI && typeof TeamUI.renderFlagMarkup === "function") {
    return TeamUI.renderFlagMarkup(teamName, {
      label: teamName,
      compact: true
    });
  }
  return teamName;
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

function matchPath(id) {
  return UI_LOCALE === "zh" ? `/zh/match.html?id=${encodeURIComponent(id)}` : `/match.html?id=${encodeURIComponent(id)}`;
}

function studioPath(id) {
  return UI_LOCALE === "zh"
    ? `/zh/index.html?fixtureId=${encodeURIComponent(id)}#studio`
    : `/?fixtureId=${encodeURIComponent(id)}#studio`;
}

function renderFixtureCard(fixture) {
  const scoreLine =
    fixture.homeScore !== null && fixture.homeScore !== undefined && fixture.awayScore !== null && fixture.awayScore !== undefined
      ? `<div class="score-lockup"><strong>${fixture.homeScore}</strong><span>:</span><strong>${fixture.awayScore}</strong></div>`
      : `<div class="fixture-kickoff">${text().kickoff}: ${formatKickoff(fixture.kickOff)}</div>`;

  return `
    <article class="fixture-card">
      <div class="fixture-topline">
        <span class="fixture-league">${fixture.league || fixture.stage}</span>
        <span class="fixture-status">${fixture.status || text().source}</span>
      </div>
      <div class="fixture-team-row">
        <div class="fixture-team">
          ${fixture.homeBadge ? `<img src="${fixture.homeBadge}" alt="${fixture.homeTeam}" />` : ""}
          <strong>${renderTeamName(fixture.homeTeam)}</strong>
        </div>
        <div class="fixture-center">
          ${scoreLine}
        </div>
        <div class="fixture-team fixture-team-right">
          ${fixture.awayBadge ? `<img src="${fixture.awayBadge}" alt="${fixture.awayTeam}" />` : ""}
          <strong>${renderTeamName(fixture.awayTeam)}</strong>
        </div>
      </div>
      <div class="fixture-meta-line">
        <span>${text().round} ${fixture.round || "-"}</span>
        <span>${fixture.city || "-"}</span>
      </div>
      <div class="ops-actions">
        <a class="button button-primary" href="${matchPath(fixture.id)}">${text().openMatch}</a>
        <a class="button button-secondary" href="${studioPath(fixture.id)}">${text().openStudio}</a>
      </div>
    </article>
  `;
}

function renderIntel(intel) {
  if (!intel || !elements.intelTitle || !elements.intelCopy || !elements.intelChips) {
    return;
  }

  elements.intelTitle.textContent = intel.title;
  elements.intelCopy.textContent = intel.copy;
  elements.intelChips.innerHTML = (intel.chips || [])
    .map((chip, index) => `<span class="status-pill${index % 2 === 1 ? " status-pill-alt" : ""}">${chip}</span>`)
    .join("");
}

function setLoading() {
  elements.list.className = "fixture-grid empty-state";
  elements.list.innerHTML = `<p>${text().loading}</p>`;
}

async function loadFixtures(scope) {
  state.scope = scope;
  elements.title.textContent = text().title[scope];
  elements.provider.textContent = text().source;
  setLoading();

  const data = await fetchJson(`/api/real/fixtures?scope=${scope}&language=${UI_LOCALE}`);
  renderIntel(data.intel);
  if (!data.fixtures.length) {
    elements.list.className = "fixture-grid empty-state";
    elements.list.innerHTML = `<p>${text().empty}</p>`;
    return;
  }

  elements.list.className = "fixture-grid";
  elements.list.innerHTML = data.fixtures.map(renderFixtureCard).join("");
}

function wireScopeButtons() {
  document.querySelectorAll("button[data-scope]").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll("button[data-scope]").forEach((chip) => chip.classList.remove("theme-chip-active"));
      button.classList.add("theme-chip-active");
      await loadFixtures(button.dataset.scope);
    });
  });
}

async function bootstrap() {
  if (TeamUI && typeof TeamUI.decorateFlagNodes === "function") {
    TeamUI.decorateFlagNodes(document);
  }
  wireScopeButtons();
  await loadFixtures("upcoming");
}

bootstrap().catch((error) => {
  elements.list.className = "fixture-grid empty-state";
  elements.list.innerHTML = `<p>${error.message}</p>`;
});

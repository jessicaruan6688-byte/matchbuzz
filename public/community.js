const UI_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const QUERY = new URLSearchParams(window.location.search);
const TeamUI = window.MatchBuzzTeams || null;

const UI_TEXT = {
  en: {
    loading: "Loading fan rooms...",
    empty: "No fan rooms are available right now.",
    members: "members",
    languages: "Languages",
    fixture: "Featured match",
    openRoom: "Open Room",
    watchParties: "Watch Parties",
    defaultTitle: "Join a football fan room that already has momentum.",
    defaultCopy: "Open a live room, jump into the player storyline, and move supporters into watch-party or sponsor flows without leaving the football context.",
    focusedTitle: (fixture) => `Fan rooms for ${fixture}`,
    focusedCopy: "This match context is now carried into community, conversion, and distribution pages."
  },
  zh: {
    loading: "正在加载球迷房...",
    empty: "当前暂无可用球迷房。",
    members: "成员",
    languages: "语言",
    fixture: "关联比赛",
    openRoom: "进入房间",
    watchParties: "观赛活动",
    defaultTitle: "进入已经有热度的足球球迷房，而不是停留在介绍页。",
    defaultCopy: "打开真实社区、进入球星叙事，再把球迷继续导向观赛活动或赞助转化链路。",
    focusedTitle: (fixture) => `${fixture} 的球迷社区`,
    focusedCopy: "当前比赛上下文已经被带入社区页和后续转化页。"
  }
};

const elements = {
  contextTitle: document.querySelector("#community-context-title"),
  contextCopy: document.querySelector("#community-context-copy"),
  roomList: document.querySelector("#community-room-list"),
  intelTitle: document.querySelector("#community-intel-title"),
  intelCopy: document.querySelector("#community-intel-copy"),
  intelChips: document.querySelector("#community-intel-chips")
};

function text() {
  return UI_TEXT[UI_LOCALE];
}

function escapeHtml(value) {
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

function pick(entry, key) {
  return UI_LOCALE === "zh" ? entry[`${key}Zh`] || entry[key] : entry[key];
}

function roomPath(room) {
  const target = UI_LOCALE === "zh" ? "/zh/community-room.html" : "/community-room.html";
  const query = new URLSearchParams({
    id: room.id
  });

  if (QUERY.get("fixtureId")) {
    query.set("fixtureId", QUERY.get("fixtureId"));
  }
  if (QUERY.get("fixtureLabel")) {
    query.set("fixtureLabel", QUERY.get("fixtureLabel"));
  }

  return `${target}?${query.toString()}`;
}

function watchPartyPath(room) {
  const target = UI_LOCALE === "zh" ? "/zh/watch-parties.html" : "/watch-parties.html";
  const query = new URLSearchParams();
  if (room.fixtureId) {
    query.set("fixtureId", room.fixtureId);
  }
  const fixtureLabel = pick(room, "fixtureLabel");
  if (fixtureLabel) {
    query.set("fixtureLabel", fixtureLabel);
  }
  return query.toString() ? `${target}?${query.toString()}` : target;
}

function renderFixtureLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) {
    return "-";
  }

  const parts = raw.split(/\s+vs\s+/i);
  if (parts.length === 2 && TeamUI && typeof TeamUI.renderFlagMarkup === "function") {
    return `${TeamUI.renderFlagMarkup(parts[0], { label: parts[0], compact: true })} <span>vs</span> ${TeamUI.renderFlagMarkup(parts[1], {
      label: parts[1],
      compact: true
    })}`;
  }

  return escapeHtml(raw);
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function renderContext() {
  const fixtureLabel = QUERY.get("fixtureLabel");
  if (fixtureLabel) {
    elements.contextTitle.textContent = text().focusedTitle(fixtureLabel);
    elements.contextCopy.textContent = text().focusedCopy;
    return;
  }

  elements.contextTitle.textContent = text().defaultTitle;
  elements.contextCopy.textContent = text().defaultCopy;
}

function renderRoomCard(room) {
  const languageFocus = (pick(room, "languageFocus") || []).join(" / ");
  const chips = (pick(room, "chips") || [])
    .slice(0, 3)
    .map((chip) => `<span class="status-pill status-pill-alt">${escapeHtml(chip)}</span>`)
    .join("");

  return `
    <article class="panel room-card">
      <div class="room-cover-shell">
        <img class="room-cover" src="${escapeHtml(room.coverImage)}" alt="${escapeHtml(pick(room, "title"))}" />
      </div>
      <div class="room-card-copy">
        <p class="eyebrow">${escapeHtml(pick(room, "status"))}</p>
        <h4>${escapeHtml(pick(room, "title"))}</h4>
        <p class="depth-copy">${escapeHtml(pick(room, "description"))}</p>
        <div class="room-meta-grid">
          <div class="meta-card">
            <strong>${room.memberCount}</strong>
            <span>${text().members}</span>
          </div>
          <div class="meta-card">
            <strong>${escapeHtml(languageFocus || "-")}</strong>
            <span>${text().languages}</span>
          </div>
          <div class="meta-card">
            <strong>${renderFixtureLabel(pick(room, "fixtureLabel") || "-")}</strong>
            <span>${text().fixture}</span>
          </div>
        </div>
        <div class="revenue-chip-row">${chips}</div>
        <div class="ops-actions">
          <a class="button button-primary" href="${roomPath(room)}">${text().openRoom}</a>
          <a class="button button-secondary" href="${watchPartyPath(room)}">${text().watchParties}</a>
        </div>
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
    .map((chip, index) => `<span class="status-pill${index % 2 === 1 ? " status-pill-alt" : ""}">${escapeHtml(chip)}</span>`)
    .join("");
}

async function bootstrap() {
  if (TeamUI && typeof TeamUI.decorateFlagNodes === "function") {
    TeamUI.decorateFlagNodes(document);
  }
  renderContext();
  elements.roomList.className = "community-room-grid empty-state";
  elements.roomList.innerHTML = `<p>${text().loading}</p>`;

  const fixtureLabel = QUERY.get("fixtureLabel");
  const params = new URLSearchParams({
    language: UI_LOCALE
  });
  if (fixtureLabel) {
    params.set("fixtureLabel", fixtureLabel);
  }

  const data = await fetchJson(`/api/community/rooms?${params.toString()}`);
  renderIntel(data.intel);
  if (!data.rooms.length) {
    elements.roomList.innerHTML = `<p>${text().empty}</p>`;
    return;
  }

  elements.roomList.className = "community-room-grid";
  elements.roomList.innerHTML = data.rooms.map(renderRoomCard).join("");
}

bootstrap().catch((error) => {
  elements.roomList.className = "community-room-grid empty-state";
  elements.roomList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
});

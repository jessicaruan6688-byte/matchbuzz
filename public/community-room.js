const ROOM_UI_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const ROOM_QUERY = new URLSearchParams(window.location.search);
const TeamUI = window.MatchBuzzTeams || null;

const ROOM_TEXT = {
  en: {
    missingId: "Missing room id.",
    loading: "Loading room...",
    members: "members",
    joinTitle: "Join this room",
    joinSuccess: "You are in. The room count and member list were updated.",
    joinButton: "Join Room",
    feed: "Live room feed",
    gallery: "Photo wall",
    recentMembers: "Recent joins",
    watchParties: "Watch Parties",
    partners: "Sponsor Packages",
    nameRequired: "Name is required.",
    languages: "Languages",
    fixture: "Fixture"
  },
  zh: {
    missingId: "缺少房间 id。",
    loading: "正在加载房间...",
    members: "成员",
    joinTitle: "加入这个房间",
    joinSuccess: "你已加入，成员数和列表已更新。",
    joinButton: "加入房间",
    feed: "实时动态",
    gallery: "照片墙",
    recentMembers: "最新加入",
    watchParties: "观赛活动",
    partners: "赞助合作包",
    nameRequired: "请输入名字。",
    languages: "语言",
    fixture: "关联比赛"
  }
};

const roomState = {
  room: null
};

const roomElements = {
  hero: document.querySelector("#room-hero"),
  feed: document.querySelector("#room-feed"),
  gallery: document.querySelector("#room-gallery"),
  members: document.querySelector("#room-members"),
  joinForm: document.querySelector("#room-join-form"),
  joinFeedback: document.querySelector("#room-join-feedback"),
  watchLink: document.querySelector("#room-watch-link"),
  partnerLink: document.querySelector("#room-partner-link"),
  intelTitle: document.querySelector("#room-intel-title"),
  intelCopy: document.querySelector("#room-intel-copy"),
  intelChips: document.querySelector("#room-intel-chips")
};

function roomText() {
  return ROOM_TEXT[ROOM_UI_LOCALE];
}

function roomEscape(value) {
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

function roomPick(entry, key) {
  return ROOM_UI_LOCALE === "zh" ? entry[`${key}Zh`] || entry[key] : entry[key];
}

async function roomFetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
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

  return roomEscape(raw);
}

function buildWatchLink(room) {
  const target = ROOM_UI_LOCALE === "zh" ? "/zh/watch-parties.html" : "/watch-parties.html";
  const query = new URLSearchParams();
  if (room.fixtureId) {
    query.set("fixtureId", room.fixtureId);
  }
  if (roomPick(room, "fixtureLabel")) {
    query.set("fixtureLabel", roomPick(room, "fixtureLabel"));
  }
  return query.toString() ? `${target}?${query.toString()}` : target;
}

function buildPartnerLink(room) {
  const target = ROOM_UI_LOCALE === "zh" ? "/zh/partners.html" : "/partners.html";
  const query = new URLSearchParams();
  if (room.fixtureId) {
    query.set("fixtureId", room.fixtureId);
  }
  if (roomPick(room, "fixtureLabel")) {
    query.set("fixtureLabel", roomPick(room, "fixtureLabel"));
  }
  return query.toString() ? `${target}?${query.toString()}` : target;
}

function renderRoomHero(room) {
  const languageFocus = (roomPick(room, "languageFocus") || []).join(" / ");
  const chips = (roomPick(room, "chips") || [])
    .slice(0, 3)
    .map((chip) => `<span class="status-pill status-pill-alt">${roomEscape(chip)}</span>`)
    .join("");

  roomElements.hero.className = "community-room-hero";
  roomElements.hero.innerHTML = `
    <div class="community-room-hero-copy">
      <p class="eyebrow">${roomEscape(roomPick(room, "status"))}</p>
      <h2>${roomEscape(roomPick(room, "title"))}</h2>
      <p class="hero-text">${roomEscape(roomPick(room, "description"))}</p>
      <div class="room-meta-grid">
        <div class="meta-card">
          <strong>${room.memberCount}</strong>
          <span>${roomText().members}</span>
        </div>
        <div class="meta-card">
          <strong>${roomEscape(languageFocus || "-")}</strong>
          <span>${roomText().languages}</span>
        </div>
        <div class="meta-card">
          <strong>${renderFixtureLabel(roomPick(room, "fixtureLabel") || "-")}</strong>
          <span>${roomText().fixture}</span>
        </div>
      </div>
      <div class="revenue-chip-row">${chips}</div>
    </div>
    <div class="community-room-hero-side panel">
      <img class="player-room-portrait" src="${roomEscape(room.featuredPlayer.photo)}" alt="${roomEscape(roomPick(room.featuredPlayer, "name"))}" />
      <div>
        <p class="eyebrow">${roomEscape(roomPick(room, "city"))}</p>
        <h4>${roomEscape(roomPick(room.featuredPlayer, "name"))}</h4>
        <p class="depth-copy">${roomEscape(roomPick(room.featuredPlayer, "note"))}</p>
      </div>
    </div>
  `;

  roomElements.watchLink.href = buildWatchLink(room);
  roomElements.partnerLink.href = buildPartnerLink(room);
  roomElements.watchLink.textContent = roomText().watchParties;
  roomElements.partnerLink.textContent = roomText().partners;
}

function renderIntel(intel) {
  if (!intel || !roomElements.intelTitle || !roomElements.intelCopy || !roomElements.intelChips) {
    return;
  }

  roomElements.intelTitle.textContent = intel.title;
  roomElements.intelCopy.textContent = intel.copy;
  roomElements.intelChips.innerHTML = (intel.chips || [])
    .map((chip, index) => `<span class="status-pill${index % 2 === 1 ? " status-pill-alt" : ""}">${roomEscape(chip)}</span>`)
    .join("");
}

function renderFeed(room) {
  roomElements.feed.innerHTML = (room.feed || [])
    .map(
      (entry) => `
        <article class="feed-card">
          <div class="panel-header">
            <div>
              <strong>${roomEscape(entry.author)}</strong>
              <p class="eyebrow">${roomEscape(roomPick(entry, "role"))}</p>
            </div>
            <span class="status-pill">${roomEscape(roomPick(entry, "time"))}</span>
          </div>
          <p>${roomEscape(roomPick(entry, "body"))}</p>
        </article>
      `
    )
    .join("");
}

function renderGallery(room) {
  roomElements.gallery.innerHTML = (room.gallery || [])
    .map((image) => `<img src="${roomEscape(image)}" alt="${roomEscape(roomPick(room, "title"))}" />`)
    .join("");
}

function renderMembers(room) {
  roomElements.members.innerHTML = (room.recentMembers || [])
    .map(
      (member) => `
        <div class="member-chip">
          <strong>${roomEscape(member.displayName)}</strong>
          <span>${roomEscape(member.market || "")}${member.favoriteTeam ? ` · ${roomEscape(member.favoriteTeam)}` : ""}</span>
        </div>
      `
    )
    .join("");
}

async function loadRoom() {
  const roomId = ROOM_QUERY.get("id");
  if (!roomId) {
    throw new Error(roomText().missingId);
  }

  const data = await roomFetchJson(`/api/community/rooms/${encodeURIComponent(roomId)}?language=${ROOM_UI_LOCALE}`);
  roomState.room = data.room;
  if (window.MatchBuzzAnalytics && typeof window.MatchBuzzAnalytics.setContext === "function") {
    window.MatchBuzzAnalytics.setContext({
      roomId: roomState.room.id,
      fixtureId: roomState.room.fixtureId || ROOM_QUERY.get("fixtureId") || ""
    });
  }
  renderRoomHero(roomState.room);
  renderIntel(data.intel);
  renderFeed(roomState.room);
  renderGallery(roomState.room);
  renderMembers(roomState.room);
}

function wireJoinForm() {
  roomElements.joinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!roomState.room) {
      return;
    }

    const form = new FormData(roomElements.joinForm);
    const name = String(form.get("name") || "").trim();
    if (!name) {
      roomElements.joinFeedback.textContent = roomText().nameRequired;
      return;
    }

    roomElements.joinFeedback.textContent = ROOM_UI_LOCALE === "zh" ? "正在加入..." : "Joining...";

    try {
      const result = await roomFetchJson(`/api/community/rooms/${encodeURIComponent(roomState.room.id)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: ROOM_UI_LOCALE,
          name,
          market: form.get("market"),
          favoriteTeam: form.get("favoriteTeam")
        })
      });

      roomState.room = result.room;
      renderRoomHero(roomState.room);
      renderMembers(roomState.room);
      roomElements.joinForm.reset();
      roomElements.joinFeedback.textContent = roomText().joinSuccess;
      if (window.MatchBuzzAnalytics && typeof window.MatchBuzzAnalytics.trackEvent === "function") {
        window.MatchBuzzAnalytics.trackEvent({
          eventType: "conversion",
          label: ROOM_UI_LOCALE === "zh" ? "球迷房加入成功" : "Fan room joined",
          targetGroup: "community",
          targetPath: `${window.location.pathname}${window.location.search}`,
          roomId: roomState.room.id,
          fixtureId: roomState.room.fixtureId || "",
          metadata: {
            member_count: String(roomState.room.memberCount || 0)
          }
        });
      }
    } catch (error) {
      roomElements.joinFeedback.textContent = error.message;
    }
  });
}

wireJoinForm();
if (TeamUI && typeof TeamUI.decorateFlagNodes === "function") {
  TeamUI.decorateFlagNodes(document);
}

loadRoom().catch((error) => {
  roomElements.hero.className = "community-room-hero empty-state";
  roomElements.hero.innerHTML = `<p>${roomEscape(error.message)}</p>`;
});

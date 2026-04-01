const PARTY_UI_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const PARTY_QUERY = new URLSearchParams(window.location.search);
const TeamUI = window.MatchBuzzTeams || null;
const PARTY_MEMBER_TOKEN_KEY = "matchbuzz_member_token";

const PARTY_TEXT = {
  en: {
    loading: "Loading watch parties...",
    loadingMember: "Loading member access...",
    empty: "No watch parties are available right now.",
    select: "Select",
    reserve: "Reserve Seats",
    reserving: "Reserving...",
    seatsLeft: "seats left",
    selected: "Selected event",
    success: "Reservation completed. Seats were updated in real time.",
    venue: "Venue",
    price: "Price",
    defaultTitle: "Reserve a watch party while the match intent is still hot.",
    defaultCopy: "Move football traffic into an actual local booking flow with email capture, member points, and live seat inventory.",
    focusedTitle: (fixture) => `Watch parties for ${fixture}`,
    focusedCopy: "This fixture context now carries directly into local venue booking and conversion.",
    memberGuestTitle: "Register with email to unlock ticket credits",
    memberGuestCopy:
      "Use a real email account to create a MatchBuzz member profile, earn points, and apply them to watch-party bookings.",
    memberSignedIn: "Signed in member",
    memberTree: "Referral tree",
    memberBalance: "Wallet balance",
    memberInvite: "Referral code",
    memberOpenHub: "Open member hub",
    signIn: "Sign In",
    register: "Register",
    pointsOptIn: "Use member points for ticket credit",
    noCredits: "No credits applied",
    noPointsYet: "No point credits are available for this booking yet.",
    pointsSummaryGuest: "Sign in to unlock point-based ticket credits on this booking.",
    pointsSummaryZero: "You do not have enough points yet for this reservation. Invite fans or claim your daily bonus first.",
    pointsSummaryActive: (credits, points, discount, payable) =>
      `${credits} credits will use ${points} pts, estimate ${discount} off, and bring this booking to ${payable}.`,
    pointsRule: (points, discount, maxCredits) =>
      `Every ${points} pts unlocks ${discount} off one booking credit, up to ${maxCredits} credits per reservation.`,
    estimateTitle: "Booking estimate",
    estimateBase: "Base total",
    estimateDiscount: "Point discount",
    estimatePayable: "Estimated payable",
    reserveWithEmail: "Reserve your seats with email",
    successPoints: (code, points) => `Confirmation ${code}. ${points} pts were redeemed from your member wallet.`,
    successSimple: (code) => `Confirmation ${code}.`,
    authRequired: "Sign in before applying points."
  },
  zh: {
    loading: "正在加载观赛活动...",
    loadingMember: "正在加载会员状态...",
    empty: "当前暂无可用观赛活动。",
    select: "选择活动",
    reserve: "提交预约",
    reserving: "正在预约...",
    seatsLeft: "剩余座位",
    selected: "当前选择",
    success: "预约成功，剩余座位已实时更新。",
    venue: "场地",
    price: "价格",
    defaultTitle: "在比赛热度最高的时候，直接把球迷导向观赛预约。",
    defaultCopy: "把足球流量接到真实预约链路里，带上邮箱注册、会员积分和实时座位库存。",
    focusedTitle: (fixture) => `${fixture} 的观赛活动`,
    focusedCopy: "当前比赛上下文已经带入本地场地预约和转化页。",
    memberGuestTitle: "先用邮箱注册，再解锁票务积分抵扣",
    memberGuestCopy: "用真实邮箱注册 MatchBuzz 会员后，可以积累积分、兑换权益，并在观赛活动页直接抵扣票价。",
    memberSignedIn: "已登录会员",
    memberTree: "推荐树",
    memberBalance: "钱包余额",
    memberInvite: "邀请码",
    memberOpenHub: "打开会员页",
    signIn: "登录",
    register: "注册",
    pointsOptIn: "使用会员积分抵扣票价",
    noCredits: "暂不使用积分",
    noPointsYet: "当前这笔预约还没有可用的积分抵扣额度。",
    pointsSummaryGuest: "登录后即可在这笔预约里使用积分抵扣。",
    pointsSummaryZero: "当前积分不足以抵扣这笔预约。先去签到或邀请新会员更合适。",
    pointsSummaryActive: (credits, points, discount, payable) =>
      `本次使用 ${credits} 份抵扣，消耗 ${points} 积分，预计减免 ${discount}，应付 ${payable}。`,
    pointsRule: (points, discount, maxCredits) =>
      `每 ${points} 积分可抵扣 ${discount} 单位票价，单笔最多使用 ${maxCredits} 份。`,
    estimateTitle: "预约估算",
    estimateBase: "原始总价",
    estimateDiscount: "积分减免",
    estimatePayable: "预计支付",
    reserveWithEmail: "用邮箱提交真实观赛预约",
    successPoints: (code, points) => `预约确认码 ${code}，已从会员钱包扣减 ${points} 积分。`,
    successSimple: (code) => `预约确认码 ${code}。`,
    authRequired: "请先登录，再使用积分抵扣。"
  }
};

const partyState = {
  parties: [],
  selectedId: null,
  overview: null
};

const partyElements = {
  contextTitle: document.querySelector("#watchparty-context-title"),
  contextCopy: document.querySelector("#watchparty-context-copy"),
  list: document.querySelector("#watchparty-list"),
  selection: document.querySelector("#watchparty-selection"),
  form: document.querySelector("#watchparty-form"),
  feedback: document.querySelector("#watchparty-feedback"),
  intelTitle: document.querySelector("#watchparty-intel-title"),
  intelCopy: document.querySelector("#watchparty-intel-copy"),
  intelChips: document.querySelector("#watchparty-intel-chips"),
  memberShell: document.querySelector("#watchparty-member-shell"),
  usePoints: document.querySelector("#watchparty-use-points"),
  pointsCredits: document.querySelector("#watchparty-points-credits"),
  pointsSummary: document.querySelector("#watchparty-points-summary"),
  topbarMember: document.querySelector("#watchparty-topbar-member"),
  topbarName: document.querySelector("#watchparty-topbar-name"),
  topbarPoints: document.querySelector("#watchparty-topbar-points"),
  authEntry: document.querySelector("#watchparty-auth-entry"),
  authLinks: Array.from(document.querySelectorAll("[data-auth-link]"))
};

function partyText() {
  return PARTY_TEXT[PARTY_UI_LOCALE];
}

function partyEscape(value) {
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

function partyPick(entry, key) {
  return PARTY_UI_LOCALE === "zh" ? entry?.[`${key}Zh`] || entry?.[key] : entry?.[key];
}

function partyNumber(value) {
  return new Intl.NumberFormat(PARTY_UI_LOCALE === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2
  }).format(Number(value || 0));
}

function getMemberToken() {
  return window.localStorage.getItem(PARTY_MEMBER_TOKEN_KEY) || "";
}

function buildAuthHref(mode) {
  const path = PARTY_UI_LOCALE === "zh" ? "/zh/auth.html" : "/auth.html";
  const params = new URLSearchParams({
    mode
  });
  params.set("returnTo", `${window.location.pathname}${window.location.search}`);
  return `${path}?${params.toString()}`;
}

function syncAuthLinks() {
  partyElements.authLinks.forEach((link) => {
    link.href = buildAuthHref(link.dataset.authLink || "login");
  });
}

async function partyFetchJson(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };
  const token = getMemberToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function parsePriceLabel(priceLabel) {
  const raw = String(priceLabel || "").trim();
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  const amount = match ? Number(match[1]) : 0;
  const currency = raw.replace(/(\d+(?:\.\d+)?)/, "").trim();
  return {
    raw,
    amount,
    currency
  };
}

function formatMoney(priceLabel, amount) {
  const parsed = parsePriceLabel(priceLabel);
  const amountLabel = partyNumber(amount);
  if (!parsed.currency) {
    return amountLabel;
  }

  if (/^[A-Z]{2,4}$/.test(parsed.currency)) {
    return `${parsed.currency} ${amountLabel}`;
  }

  return `${amountLabel} ${parsed.currency}`;
}

function getWatchPartyRules() {
  return (
    partyState.overview?.rules?.watchPartyPoints || {
      pointsPerCredit: 120,
      discountValuePerCredit: 10,
      maxCreditsPerBooking: 4
    }
  );
}

function getSelectedParty() {
  return partyState.parties.find((entry) => entry.id === partyState.selectedId) || null;
}

function getGroupSize() {
  const input = partyElements.form?.elements?.groupSize;
  return Math.max(1, Math.min(8, Number(input?.value || 1)));
}

function buildPointsQuote(party) {
  const rules = getWatchPartyRules();
  const member = partyState.overview?.member || null;
  const priceLabel = partyPick(party, "priceLabel") || party.priceLabel || "";
  const price = parsePriceLabel(priceLabel);
  const groupSize = getGroupSize();
  const maxCreditsByBalance = member ? Math.floor(Number(member.pointsBalance || 0) / Number(rules.pointsPerCredit || 120)) : 0;
  const maxCredits = Math.max(
    0,
    Math.min(maxCreditsByBalance, groupSize, Number(rules.maxCreditsPerBooking || 4))
  );
  const requestedCredits = Math.max(0, Math.min(maxCredits, Number(partyElements.pointsCredits?.value || 0)));
  const selectedCredits = partyElements.usePoints?.checked ? requestedCredits : 0;
  const pointsUsed = selectedCredits * Number(rules.pointsPerCredit || 120);
  const estimatedDiscount = selectedCredits * Number(rules.discountValuePerCredit || 10);
  const estimatedBase = price.amount * groupSize;
  const estimatedPayable = Math.max(estimatedBase - estimatedDiscount, 0);

  return {
    priceLabel,
    price,
    groupSize,
    maxCredits,
    selectedCredits,
    pointsUsed,
    estimatedBase,
    estimatedDiscount,
    estimatedPayable
  };
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

  return partyEscape(raw);
}

function renderContext() {
  const fixtureLabel = PARTY_QUERY.get("fixtureLabel");
  if (fixtureLabel) {
    partyElements.contextTitle.textContent = partyText().focusedTitle(fixtureLabel);
    partyElements.contextCopy.textContent = partyText().focusedCopy;
    return;
  }

  partyElements.contextTitle.textContent = partyText().defaultTitle;
  partyElements.contextCopy.textContent = partyText().defaultCopy;
}

function renderPartyCard(party) {
  const active = party.id === partyState.selectedId ? " room-card-active" : "";
  const perks = (partyPick(party, "perks") || [])
    .slice(0, 3)
    .map((item) => `<li>${partyEscape(item)}</li>`)
    .join("");

  return `
    <article class="panel room-card${active}">
      <div class="room-cover-shell">
        <img class="room-cover" src="${partyEscape(party.image)}" alt="${partyEscape(partyPick(party, "title"))}" />
      </div>
      <div class="room-card-copy">
        <p class="eyebrow">${partyEscape(partyPick(party, "city"))}</p>
        <h4>${partyEscape(partyPick(party, "title"))}</h4>
        <p class="depth-copy">${partyEscape(partyPick(party, "summary"))}</p>
        <ul class="deep-list">${perks}</ul>
        <div class="room-meta-grid">
          <div class="meta-card">
            <strong>${partyEscape(partyPick(party, "venue"))}</strong>
            <span>${partyText().venue}</span>
          </div>
          <div class="meta-card">
            <strong>${partyEscape(partyPick(party, "priceLabel"))}</strong>
            <span>${partyText().price}</span>
          </div>
          <div class="meta-card">
            <strong>${party.seatsLeft}</strong>
            <span>${partyText().seatsLeft}</span>
          </div>
        </div>
        <div class="ops-actions">
          <button class="button button-primary" data-party-id="${partyEscape(party.id)}" type="button">${partyText().select}</button>
        </div>
      </div>
    </article>
  `;
}

function renderSelection() {
  const party = getSelectedParty();
  if (!party) {
    partyElements.selection.innerHTML = "";
    return;
  }

  if (window.MatchBuzzAnalytics && typeof window.MatchBuzzAnalytics.setContext === "function") {
    window.MatchBuzzAnalytics.setContext({
      fixtureId: party.fixtureId || PARTY_QUERY.get("fixtureId") || ""
    });
  }

  const quote = buildPointsQuote(party);
  const estimateMarkup =
    quote.selectedCredits > 0
      ? `
        <div class="points-summary">
          <strong>${partyEscape(partyText().estimateTitle)}</strong>
          <div class="points-inline"><span>${partyEscape(partyText().estimateBase)}</span><strong>${partyEscape(formatMoney(quote.priceLabel, quote.estimatedBase))}</strong></div>
          <div class="points-inline"><span>${partyEscape(partyText().estimateDiscount)}</span><strong>${partyEscape(formatMoney(quote.priceLabel, quote.estimatedDiscount))}</strong></div>
          <div class="points-inline"><span>${partyEscape(partyText().estimatePayable)}</span><strong>${partyEscape(formatMoney(quote.priceLabel, quote.estimatedPayable))}</strong></div>
        </div>
      `
      : "";

  partyElements.selection.innerHTML = `
    <div class="panel selection-panel">
      <p class="eyebrow">${partyText().selected}</p>
      <h4>${partyEscape(partyPick(party, "title"))}</h4>
      <p class="depth-copy">${renderFixtureLabel(partyPick(party, "fixtureLabel"))} · ${partyEscape(partyPick(party, "venue"))}</p>
      <div class="revenue-chip-row">
        <span class="status-pill">${partyEscape(partyPick(party, "priceLabel"))}</span>
        <span class="status-pill status-pill-alt">${party.seatsLeft} ${partyText().seatsLeft}</span>
      </div>
      ${estimateMarkup}
    </div>
  `;
}

function renderIntel(intel) {
  if (!intel || !partyElements.intelTitle || !partyElements.intelCopy || !partyElements.intelChips) {
    return;
  }

  partyElements.intelTitle.textContent = intel.title;
  partyElements.intelCopy.textContent = intel.copy;
  partyElements.intelChips.innerHTML = (intel.chips || [])
    .map((chip, index) => `<span class="status-pill${index % 2 === 1 ? " status-pill-alt" : ""}">${partyEscape(chip)}</span>`)
    .join("");
}

function renderTopbarMember() {
  const member = partyState.overview?.member || null;
  if (!partyElements.topbarMember || !partyElements.authEntry) {
    return;
  }

  if (!member) {
    partyElements.topbarMember.classList.add("is-hidden");
    partyElements.authEntry.classList.remove("is-hidden");
    return;
  }

  partyElements.topbarMember.classList.remove("is-hidden");
  partyElements.authEntry.classList.add("is-hidden");
  partyElements.topbarName.textContent = member.displayName;
  partyElements.topbarPoints.textContent =
    PARTY_UI_LOCALE === "zh" ? `${partyNumber(member.pointsBalance)} 积分` : `${partyNumber(member.pointsBalance)} pts`;
}

function renderMemberShell() {
  if (!partyElements.memberShell) {
    return;
  }

  const member = partyState.overview?.member || null;
  const network = partyState.overview?.network?.counts || { level1: 0, level2: 0, level3: 0 };
  const rules = getWatchPartyRules();
  if (!member) {
    partyElements.memberShell.innerHTML = `
      <article class="member-booking-banner">
        <p class="eyebrow">${partyEscape(partyText().memberBalance)}</p>
        <h4>${partyEscape(partyText().memberGuestTitle)}</h4>
        <p class="depth-copy">${partyEscape(partyText().memberGuestCopy)}</p>
        <div class="member-mini-stats">
          <span>${partyEscape(partyText().pointsRule(rules.pointsPerCredit, rules.discountValuePerCredit, rules.maxCreditsPerBooking))}</span>
        </div>
        <div class="cta-actions">
          <a class="button button-primary" data-auth-link="register" href="${partyEscape(buildAuthHref("register"))}">${partyEscape(partyText().register)}</a>
          <a class="button button-secondary" data-auth-link="login" href="${partyEscape(buildAuthHref("login"))}">${partyEscape(partyText().signIn)}</a>
        </div>
      </article>
    `;
    syncAuthLinks();
    renderTopbarMember();
    return;
  }

  partyElements.memberShell.innerHTML = `
    <article class="member-booking-banner member-booking-banner-live">
      <p class="eyebrow">${partyEscape(partyText().memberSignedIn)}</p>
      <h4>${partyEscape(member.displayName)}</h4>
      <div class="member-mini-stats">
        <span>${partyEscape(partyText().memberBalance)} · ${partyNumber(member.pointsBalance)} ${PARTY_UI_LOCALE === "zh" ? "积分" : "pts"}</span>
        <span>${partyEscape(partyText().memberInvite)} · ${partyEscape(member.referralCode)}</span>
        <span>${partyEscape(partyText().memberTree)} · L1 ${network.level1} / L2 ${network.level2} / L3 ${network.level3}</span>
      </div>
      <p class="depth-copy">${partyEscape(partyText().pointsRule(rules.pointsPerCredit, rules.discountValuePerCredit, rules.maxCreditsPerBooking))}</p>
      <div class="cta-actions">
        <a class="button button-secondary" href="${PARTY_UI_LOCALE === "zh" ? "/zh/index.html#member-club" : "/#member-club"}">${partyEscape(
          partyText().memberOpenHub
        )}</a>
      </div>
    </article>
  `;
  renderTopbarMember();
}

function syncPointsControls() {
  if (!partyElements.pointsCredits || !partyElements.pointsSummary || !partyElements.usePoints) {
    return;
  }

  const party = getSelectedParty();
  const member = partyState.overview?.member || null;
  const rules = getWatchPartyRules();
  if (!party) {
    return;
  }

  const previousValue = Math.max(0, Number(partyElements.pointsCredits.value || 0));
  const quote = buildPointsQuote(party);
  const options = [`<option value="0">${partyEscape(partyText().noCredits)}</option>`];
  for (let credit = 1; credit <= quote.maxCredits; credit += 1) {
    const pointsNeeded = credit * Number(rules.pointsPerCredit || 120);
    const discountValue = credit * Number(rules.discountValuePerCredit || 10);
    options.push(
      `<option value="${credit}">${partyEscape(
        PARTY_UI_LOCALE === "zh"
          ? `${credit} 份 · ${partyNumber(pointsNeeded)} 积分 · 抵扣 ${formatMoney(quote.priceLabel, discountValue)}`
          : `${credit} credits · ${partyNumber(pointsNeeded)} pts · ${formatMoney(quote.priceLabel, discountValue)} off`
      )}</option>`
    );
  }
  partyElements.pointsCredits.innerHTML = options.join("");
  const preservedValue = Math.min(previousValue, quote.maxCredits);
  partyElements.pointsCredits.value = String(
    partyElements.usePoints.checked && preservedValue === 0 && quote.maxCredits > 0 ? 1 : preservedValue
  );

  if (!member) {
    partyElements.usePoints.checked = false;
    partyElements.usePoints.disabled = true;
    partyElements.pointsCredits.disabled = true;
    partyElements.pointsSummary.innerHTML = `
      <strong>${partyEscape(partyText().memberGuestTitle)}</strong>
      <span>${partyEscape(partyText().pointsSummaryGuest)}</span>
    `;
    renderSelection();
    return;
  }

  partyElements.usePoints.disabled = quote.maxCredits === 0;
  if (quote.maxCredits === 0) {
    partyElements.usePoints.checked = false;
    partyElements.pointsCredits.value = "0";
    partyElements.pointsCredits.disabled = true;
    partyElements.pointsSummary.innerHTML = `
      <strong>${partyEscape(partyText().noPointsYet)}</strong>
      <span>${partyEscape(partyText().pointsRule(rules.pointsPerCredit, rules.discountValuePerCredit, rules.maxCreditsPerBooking))}</span>
    `;
    renderSelection();
    return;
  }

  partyElements.pointsCredits.disabled = !partyElements.usePoints.checked;
  if (Number(partyElements.pointsCredits.value || 0) > quote.maxCredits) {
    partyElements.pointsCredits.value = String(quote.maxCredits);
  }

  const nextQuote = buildPointsQuote(party);
  if (!partyElements.usePoints.checked || nextQuote.selectedCredits === 0) {
    partyElements.pointsSummary.innerHTML = `
      <strong>${partyEscape(partyText().pointsRule(rules.pointsPerCredit, rules.discountValuePerCredit, rules.maxCreditsPerBooking))}</strong>
      <span>${partyEscape(
        PARTY_UI_LOCALE === "zh"
          ? `当前钱包最多可用 ${quote.maxCredits} 份抵扣。`
          : `Your current wallet can apply up to ${quote.maxCredits} booking credits here.`
      )}</span>
    `;
    renderSelection();
    return;
  }

  partyElements.pointsSummary.innerHTML = `
    <strong>${partyEscape(
      partyText().pointsSummaryActive(
        nextQuote.selectedCredits,
        partyNumber(nextQuote.pointsUsed),
        formatMoney(nextQuote.priceLabel, nextQuote.estimatedDiscount),
        formatMoney(nextQuote.priceLabel, nextQuote.estimatedPayable)
      )
    )}</strong>
    <span>${partyEscape(
      PARTY_UI_LOCALE === "zh"
        ? `原始总价 ${formatMoney(nextQuote.priceLabel, nextQuote.estimatedBase)}。`
        : `Base total: ${formatMoney(nextQuote.priceLabel, nextQuote.estimatedBase)}.`
    )}</span>
  `;
  renderSelection();
}

function hydrateMemberFields() {
  const member = partyState.overview?.member || null;
  if (!member || !partyElements.form) {
    return;
  }

  const nameInput = partyElements.form.elements.namedItem("name");
  const emailInput = partyElements.form.elements.namedItem("email");
  if (nameInput && !String(nameInput.value || "").trim()) {
    nameInput.value = member.displayName || "";
  }
  if (emailInput && !String(emailInput.value || "").trim()) {
    emailInput.value = member.email || "";
  }
}

function wireListButtons() {
  partyElements.list.querySelectorAll("[data-party-id]").forEach((button) => {
    button.addEventListener("click", () => {
      partyState.selectedId = button.dataset.partyId;
      renderList();
      syncPointsControls();
      renderSelection();
    });
  });
}

function renderList() {
  if (!partyState.parties.length) {
    partyElements.list.className = "community-room-grid empty-state";
    partyElements.list.innerHTML = `<p>${partyText().empty}</p>`;
    return;
  }

  partyElements.list.className = "community-room-grid";
  partyElements.list.innerHTML = partyState.parties.map(renderPartyCard).join("");
  wireListButtons();
}

async function loadParties() {
  partyElements.list.className = "community-room-grid empty-state";
  partyElements.list.innerHTML = `<p>${partyText().loading}</p>`;

  const params = new URLSearchParams({
    language: PARTY_UI_LOCALE
  });
  if (PARTY_QUERY.get("fixtureLabel")) {
    params.set("fixtureLabel", PARTY_QUERY.get("fixtureLabel"));
  }

  const data = await partyFetchJson(`/api/watch-parties?${params.toString()}`);
  renderIntel(data.intel);
  partyState.parties = data.parties;
  const fixtureId = PARTY_QUERY.get("fixtureId");
  const matched = fixtureId ? partyState.parties.find((item) => item.fixtureId === fixtureId) : null;
  partyState.selectedId = matched?.id || partyState.parties[0]?.id || null;
  renderList();
  syncPointsControls();
  renderSelection();
}

async function loadMemberOverview() {
  if (partyElements.memberShell) {
    partyElements.memberShell.innerHTML = `<p>${partyEscape(partyText().loadingMember)}</p>`;
  }

  try {
    const overview = await partyFetchJson(`/api/member/overview?language=${PARTY_UI_LOCALE}`);
    if (getMemberToken() && !overview.member) {
      window.localStorage.removeItem(PARTY_MEMBER_TOKEN_KEY);
    }
    partyState.overview = overview;
  } catch (error) {
    partyState.overview = {
      member: null,
      network: null,
      rules: {
        watchPartyPoints: getWatchPartyRules()
      }
    };
    if (partyElements.feedback) {
      partyElements.feedback.textContent = error.message;
    }
  }

  renderMemberShell();
  hydrateMemberFields();
  syncPointsControls();
}

if (partyElements.form) {
  partyElements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selected = getSelectedParty();
    if (!selected) {
      return;
    }

    const form = new FormData(partyElements.form);
    const usePoints = Boolean(partyElements.usePoints?.checked);
    const token = getMemberToken();

    if (usePoints && !token) {
      partyElements.feedback.textContent = partyText().authRequired;
      return;
    }

    partyElements.feedback.textContent = partyText().reserving;

    try {
      const result = await partyFetchJson(`/api/watch-parties/${encodeURIComponent(selected.id)}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: PARTY_UI_LOCALE,
          name: form.get("name"),
          email: form.get("email"),
          groupSize: Number(form.get("groupSize") || 1),
          favoriteTeam: form.get("favoriteTeam"),
          notes: form.get("notes"),
          usePoints,
          pointsCredits: Number(form.get("pointsCredits") || 0)
        })
      });

      partyState.parties = partyState.parties.map((item) => (item.id === result.party.id ? result.party : item));
      renderList();
      if (result.member) {
        await loadMemberOverview();
      } else {
        syncPointsControls();
      }
      renderSelection();
      partyElements.form.reset();
      hydrateMemberFields();
      syncPointsControls();
      partyElements.feedback.textContent =
        Number(result.reservation.pointsUsed || 0) > 0
          ? partyText().successPoints(result.reservation.confirmationCode, partyNumber(result.reservation.pointsUsed))
          : `${partyText().success} ${partyText().successSimple(result.reservation.confirmationCode)}`;
      if (window.MatchBuzzAnalytics && typeof window.MatchBuzzAnalytics.trackEvent === "function") {
        window.MatchBuzzAnalytics.trackEvent({
          eventType: "conversion",
          label: PARTY_UI_LOCALE === "zh" ? "观赛预约完成" : "Watch party reserved",
          targetGroup: "watch",
          targetPath: `${window.location.pathname}${window.location.search}`,
          fixtureId: selected.fixtureId || PARTY_QUERY.get("fixtureId") || "",
          metadata: {
            party_id: selected.id,
            group_size: String(result.reservation.groupSize || form.get("groupSize") || 1),
            used_points: String(result.reservation.pointsUsed || 0)
          }
        });
      }
    } catch (error) {
      partyElements.feedback.textContent = error.message;
    }
  });

  partyElements.form.elements.namedItem("groupSize")?.addEventListener("input", () => {
    syncPointsControls();
  });
}

partyElements.usePoints?.addEventListener("change", () => {
  syncPointsControls();
});

partyElements.pointsCredits?.addEventListener("change", () => {
  syncPointsControls();
});

renderContext();
syncAuthLinks();
if (TeamUI && typeof TeamUI.decorateFlagNodes === "function") {
  TeamUI.decorateFlagNodes(document);
}
Promise.all([loadParties(), loadMemberOverview()]).catch((error) => {
  partyElements.list.className = "community-room-grid empty-state";
  partyElements.list.innerHTML = `<p>${partyEscape(error.message)}</p>`;
});

const MEMBER_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const MEMBER_TOKEN_KEY = "matchbuzz_member_token";

const MEMBER_TEXT = {
  en: {
    guest: "Guest",
    loading: "Loading member data...",
    live: "Live member system",
    signedIn: "Signed in",
    members: "Members",
    issued: "Points issued",
    redeemed: "Redeemed",
    referrals: "Referral members",
    activeSessions: "Active sessions",
    copy: "Copy",
    copied: "Copied",
    redeem: "Redeem",
    redeemNeedSignIn: "Sign in to redeem",
    noReferrals: "No referrals yet. Share your code to start the tree.",
    noActivity: "No activity yet. Register, sign in, or redeem to start moving points.",
    earned: "Earned",
    spent: "Redeemed",
    memberNo: "Member",
    dailyBonus: "Claim Daily Bonus",
    dailyDone: "Daily bonus claimed.",
    logout: "Log Out",
    loginSuccess: "Signed in. Your points wallet is live.",
    registerSuccess: "Member account created. Signup points and referral bonuses are active.",
    logoutSuccess: "Logged out.",
    redeemSuccess: "Reward redeemed.",
    errorPrefix: "Member system error: ",
    inviteLink: "Invite link",
    referralCode: "Referral code",
    level: "Level",
    points: "pts",
    positive: "+",
    leaderboardTitle: "Top member momentum",
    lucky: "Lucky bonus",
    publicStatus: (stats) => `${stats.memberCount} members live`
  },
  zh: {
    guest: "访客",
    loading: "正在加载会员数据...",
    live: "会员系统已接通",
    signedIn: "已登录",
    members: "会员数",
    issued: "已发积分",
    redeemed: "已兑换",
    referrals: "推荐会员",
    activeSessions: "活跃会话",
    copy: "复制",
    copied: "已复制",
    redeem: "立即兑换",
    redeemNeedSignIn: "登录后可兑换",
    noReferrals: "还没有推荐成员，把邀请码发出去后这里会长出来。",
    noActivity: "还没有积分流水。先注册、登录或兑换一次权益。",
    earned: "累计获得",
    spent: "累计兑换",
    memberNo: "会员编号",
    dailyBonus: "领取今日签到积分",
    dailyDone: "今日签到已完成。",
    logout: "退出登录",
    loginSuccess: "登录成功，积分钱包已恢复。",
    registerSuccess: "会员注册完成，注册奖励和推荐奖励已生效。",
    logoutSuccess: "已退出登录。",
    redeemSuccess: "兑换成功。",
    errorPrefix: "会员系统错误：",
    inviteLink: "邀请链接",
    referralCode: "邀请码",
    level: "第",
    points: "积分",
    positive: "+",
    leaderboardTitle: "会员热度榜",
    lucky: "幸运奖励",
    publicStatus: (stats) => `${stats.memberCount} 位会员在线`
  }
};

const memberElements = {
  authEntry: document.querySelector(".auth-entry"),
  authLinks: Array.from(document.querySelectorAll(".auth-scroll-link")),
  topbarPill: document.querySelector("#member-topbar-pill"),
  topbarName: document.querySelector("#member-topbar-name"),
  topbarPoints: document.querySelector("#member-topbar-points"),
  publicStatus: document.querySelector("#member-public-status"),
  kpiGrid: document.querySelector("#member-kpi-grid"),
  rewardGrid: document.querySelector("#member-reward-grid"),
  ruleList: document.querySelector("#member-rule-list"),
  sessionPill: document.querySelector("#member-session-pill"),
  guestView: document.querySelector("#member-guest-view"),
  dashboard: document.querySelector("#member-dashboard"),
  feedback: document.querySelector("#member-auth-feedback"),
  loginForm: document.querySelector("#member-login-form"),
  registerForm: document.querySelector("#member-register-form"),
  loginEmail: document.querySelector("#member-login-email"),
  loginPassword: document.querySelector("#member-login-password"),
  registerName: document.querySelector("#member-register-name"),
  registerEmail: document.querySelector("#member-register-email"),
  registerPassword: document.querySelector("#member-register-password"),
  registerTeam: document.querySelector("#member-register-team"),
  registerReferral: document.querySelector("#member-register-referral"),
  dashboardName: document.querySelector("#member-dashboard-name"),
  dashboardPoints: document.querySelector("#member-dashboard-points"),
  dashboardStats: document.querySelector("#member-dashboard-stats"),
  referralCode: document.querySelector("#member-referral-code"),
  inviteLink: document.querySelector("#member-invite-link"),
  copyCodeButton: document.querySelector("#member-copy-code"),
  checkinButton: document.querySelector("#member-checkin-button"),
  logoutButton: document.querySelector("#member-logout-button"),
  networkLevels: document.querySelector("#member-network-levels"),
  activityList: document.querySelector("#member-activity-list")
};

const memberState = {
  token: window.localStorage.getItem(MEMBER_TOKEN_KEY) || "",
  overview: null
};

function memberText() {
  return MEMBER_TEXT[MEMBER_LOCALE];
}

async function memberFetchJson(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (memberState.token) {
    headers.Authorization = `Bearer ${memberState.token}`;
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

function setMemberToken(token) {
  memberState.token = token || "";
  if (memberState.token) {
    window.localStorage.setItem(MEMBER_TOKEN_KEY, memberState.token);
  } else {
    window.localStorage.removeItem(MEMBER_TOKEN_KEY);
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat(MEMBER_LOCALE === "zh" ? "zh-CN" : "en-US").format(Number(value || 0));
}

function escapeMemberHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setMemberFeedback(message, isError = false) {
  if (!memberElements.feedback) {
    return;
  }

  memberElements.feedback.textContent = message || "";
  memberElements.feedback.classList.toggle("is-error", Boolean(message && isError));
}

function renderKpis(stats) {
  if (!memberElements.kpiGrid || !stats) {
    return;
  }

  const text = memberText();
  const items = [
    { value: formatNumber(stats.memberCount), label: text.members },
    { value: formatNumber(stats.totalPointsIssued), label: text.issued },
    { value: formatNumber(stats.totalPointsRedeemed), label: text.redeemed },
    { value: formatNumber(stats.referralMembers), label: text.referrals }
  ];

  memberElements.kpiGrid.innerHTML = items
    .map(
      (item) => `
        <article class="member-kpi-card">
          <strong>${escapeMemberHtml(item.value)}</strong>
          <span>${escapeMemberHtml(item.label)}</span>
        </article>
      `
    )
    .join("");
}

function renderRules(rules) {
  if (!memberElements.ruleList || !rules) {
    return;
  }

  const referralItems = (rules.referralBonuses || []).map(
    (item) => `
      <div class="storyline-item">
        <strong>${escapeMemberHtml(item.label)} · ${formatNumber(item.points)} ${memberText().points}</strong>
        <span>${MEMBER_LOCALE === "zh" ? "新会员进入这一层时，会自动给上级发积分。" : "Points are awarded automatically when a new member lands in this layer."}</span>
      </div>
    `
  );
  const luckyItems = (rules.luckyBonuses || []).map(
    (item) => `
      <div class="storyline-item">
        <strong>${escapeMemberHtml(item.label)} · ${formatNumber(item.points)} ${memberText().points}</strong>
        <span>${MEMBER_LOCALE === "zh" ? "幸运编号会在注册时自动触发。" : "Lucky-number bonuses trigger automatically on registration."}</span>
      </div>
    `
  );

  memberElements.ruleList.innerHTML = referralItems.concat(luckyItems).join("");
}

function renderRewards(rewards, member) {
  if (!memberElements.rewardGrid) {
    return;
  }

  const text = memberText();
  memberElements.rewardGrid.innerHTML = (rewards || [])
    .map(
      (reward) => `
        <article class="reward-card">
          <div class="reward-card-head">
            <div>
              <strong>${escapeMemberHtml(reward.title)}</strong>
              <span>${escapeMemberHtml(reward.description)}</span>
            </div>
            <span class="reward-points-chip">${formatNumber(reward.cost)} ${text.points}</span>
          </div>
          <span class="reward-partner">${escapeMemberHtml(reward.partner)}</span>
          <div class="cta-actions">
            <a class="button button-secondary" href="${escapeMemberHtml(reward.ctaPath)}">${MEMBER_LOCALE === "zh" ? "查看入口" : "Open Page"}</a>
            <button class="button button-primary" type="button" data-reward-id="${escapeMemberHtml(reward.id)}">
              ${member ? `${text.redeem} ${formatNumber(reward.cost)}` : text.redeemNeedSignIn}
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderTopbar(member) {
  if (!memberElements.topbarPill || !memberElements.topbarName || !memberElements.topbarPoints) {
    return;
  }

  if (!member) {
    memberElements.topbarPill.classList.add("is-hidden");
    if (memberElements.authEntry) {
      memberElements.authEntry.classList.remove("is-hidden");
    }
    return;
  }

  memberElements.topbarPill.classList.remove("is-hidden");
  memberElements.topbarName.textContent = member.displayName;
  memberElements.topbarPoints.textContent =
    MEMBER_LOCALE === "zh" ? `${formatNumber(member.pointsBalance)} 积分` : `${formatNumber(member.pointsBalance)} pts`;
  if (memberElements.authEntry) {
    memberElements.authEntry.classList.add("is-hidden");
  }
}

function renderMemberDashboard(member) {
  if (!memberElements.dashboard || !memberElements.guestView || !memberElements.sessionPill) {
    return;
  }

  if (!member) {
    memberElements.guestView.classList.remove("is-hidden");
    memberElements.dashboard.classList.add("is-hidden");
    memberElements.sessionPill.textContent = memberText().guest;
    return;
  }

  memberElements.guestView.classList.add("is-hidden");
  memberElements.dashboard.classList.remove("is-hidden");
  memberElements.sessionPill.textContent = memberText().signedIn;
  memberElements.dashboardName.textContent = member.displayName;
  memberElements.dashboardPoints.textContent = formatNumber(member.pointsBalance);
  memberElements.dashboardStats.innerHTML = [
    `${memberText().earned} ${formatNumber(member.totalPointsEarned)}`,
    `${memberText().spent} ${formatNumber(member.totalPointsRedeemed)}`,
    `${memberText().memberNo} #${formatNumber(member.memberNumber)}`
  ]
    .map((item) => `<span>${escapeMemberHtml(item)}</span>`)
    .join("");

  memberElements.referralCode.textContent = member.referralCode;
  const inviteUrl = new URL(window.location.href);
  inviteUrl.searchParams.set("ref", member.referralCode);
  memberElements.inviteLink.value = inviteUrl.toString();
}

function renderNetwork(network) {
  if (!memberElements.networkLevels) {
    return;
  }

  if (!network || !network.levels || !network.levels.length) {
    memberElements.networkLevels.innerHTML = `
      <article class="referral-level-card">
        <strong>${escapeMemberHtml(memberText().noReferrals)}</strong>
        <span>${MEMBER_LOCALE === "zh" ? "把邀请码发给球迷会、创作者和票务合作方试试。" : "Share your code with fan clubs, creators, and ticketing partners."}</span>
      </article>
    `;
    return;
  }

  memberElements.networkLevels.innerHTML = network.levels
    .map((level) => {
      const members = level.members || [];
      const inner = members.length
        ? `
            <div class="referral-member-list">
              ${members
                .map(
                  (member) => `
                    <div class="referral-member-chip">
                      <strong>${escapeMemberHtml(member.displayName)}</strong>
                      <span>#${formatNumber(member.memberNumber)} · ${formatNumber(member.pointsBalance)} ${memberText().points}</span>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
        : `<span>${escapeMemberHtml(memberText().noReferrals)}</span>`;

      return `
        <article class="referral-level-card">
          <strong>${escapeMemberHtml(level.title)} · ${formatNumber(level.bonus)} ${memberText().points}</strong>
          <span>${escapeMemberHtml((MEMBER_LOCALE === "zh" ? "当前人数：" : "Current count: ") + members.length)}</span>
          ${inner}
        </article>
      `;
    })
    .join("");
}

function renderActivity(activity) {
  if (!memberElements.activityList) {
    return;
  }

  if (!activity || !activity.length) {
    memberElements.activityList.innerHTML = `
      <article class="ledger-item">
        <strong>${escapeMemberHtml(memberText().noActivity)}</strong>
        <span>${MEMBER_LOCALE === "zh" ? "积分获得、签到和兑换记录会出现在这里。" : "Earnings, check-ins, and redemptions will appear here."}</span>
      </article>
    `;
    return;
  }

  memberElements.activityList.innerHTML = activity
    .map((entry) => {
      const positive = Number(entry.pointsDelta || 0) >= 0;
      const deltaLabel = `${positive ? memberText().positive : ""}${formatNumber(entry.pointsDelta)} ${memberText().points}`;
      return `
        <article class="ledger-item">
          <div class="ledger-points">
            <strong class="${positive ? "" : "is-negative"}">${escapeMemberHtml(deltaLabel)}</strong>
            <time>${escapeMemberHtml(new Date(entry.createdAt).toLocaleString(MEMBER_LOCALE === "zh" ? "zh-CN" : "en-US"))}</time>
          </div>
          <strong>${escapeMemberHtml(entry.title)}</strong>
          <span>${escapeMemberHtml(entry.note || "")}</span>
        </article>
      `;
    })
    .join("");
}

function renderMemberOverview(overview) {
  memberState.overview = overview;
  const text = memberText();
  const stats = overview?.stats || {
    memberCount: 0,
    referralMembers: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    activeSessions: 0
  };

  if (memberElements.publicStatus) {
    memberElements.publicStatus.textContent = text.publicStatus(stats);
  }

  renderKpis(stats);
  renderRules(overview?.rules || null);
  renderRewards(overview?.rewards || [], overview?.member || null);
  renderTopbar(overview?.member || null);
  renderMemberDashboard(overview?.member || null);
  renderNetwork(overview?.network || null);
  renderActivity(overview?.activity || []);
}

async function refreshMemberOverview() {
  const overview = await memberFetchJson(`/api/member/overview?language=${MEMBER_LOCALE}`);
  if (memberState.token && !overview.member) {
    setMemberToken("");
  }
  renderMemberOverview(overview);
}

async function submitMemberLogin(event) {
  event.preventDefault();
  setMemberFeedback("");

  try {
    const payload = {
      email: memberElements.loginEmail.value.trim(),
      password: memberElements.loginPassword.value,
      language: MEMBER_LOCALE
    };
    const overview = await memberFetchJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setMemberToken(overview.token);
    renderMemberOverview(overview);
    setMemberFeedback(memberText().loginSuccess);
    memberElements.loginForm.reset();
  } catch (error) {
    setMemberFeedback(`${memberText().errorPrefix}${error.message}`, true);
  }
}

async function submitMemberRegister(event) {
  event.preventDefault();
  setMemberFeedback("");

  try {
    const payload = {
      displayName: memberElements.registerName.value.trim(),
      email: memberElements.registerEmail.value.trim(),
      password: memberElements.registerPassword.value,
      favoriteTeam: memberElements.registerTeam.value.trim(),
      referralCode: memberElements.registerReferral.value.trim(),
      language: MEMBER_LOCALE
    };
    const overview = await memberFetchJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setMemberToken(overview.token);
    renderMemberOverview(overview);
    setMemberFeedback(memberText().registerSuccess);
    memberElements.registerForm.reset();
  } catch (error) {
    setMemberFeedback(`${memberText().errorPrefix}${error.message}`, true);
  }
}

async function handleDailyCheckIn() {
  setMemberFeedback("");

  try {
    const overview = await memberFetchJson("/api/member/check-in", {
      method: "POST",
      body: JSON.stringify({ language: MEMBER_LOCALE })
    });
    renderMemberOverview({ ...overview, token: memberState.token });
    setMemberFeedback(memberText().dailyDone);
  } catch (error) {
    setMemberFeedback(`${memberText().errorPrefix}${error.message}`, true);
  }
}

async function handleRewardRedeem(rewardId) {
  if (!memberState.overview?.member) {
    setMemberFeedback(memberText().redeemNeedSignIn, true);
    memberElements.registerName?.focus();
    return;
  }

  setMemberFeedback("");
  try {
    const result = await memberFetchJson("/api/member/redeem", {
      method: "POST",
      body: JSON.stringify({
        rewardId,
        language: MEMBER_LOCALE
      })
    });
    renderMemberOverview({ ...result, token: memberState.token });
    setMemberFeedback(
      MEMBER_LOCALE === "zh"
        ? `${memberText().redeemSuccess} 兑换码：${result.voucher.code}`
        : `${memberText().redeemSuccess} Voucher: ${result.voucher.code}`
    );
  } catch (error) {
    setMemberFeedback(`${memberText().errorPrefix}${error.message}`, true);
  }
}

async function handleMemberLogout() {
  setMemberFeedback("");

  try {
    await memberFetchJson("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  } catch (error) {
    // Ignore logout failures and clear local state anyway.
  }

  setMemberToken("");
  await refreshMemberOverview();
  setMemberFeedback(memberText().logoutSuccess);
}

async function copyInviteCode() {
  const value = memberElements.inviteLink?.value || memberElements.referralCode?.textContent || "";
  if (!value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    setMemberFeedback(memberText().copied);
  } catch (error) {
    setMemberFeedback(`${memberText().errorPrefix}${error.message}`, true);
  }
}

function focusAuthView(view) {
  if (view === "login") {
    memberElements.loginEmail?.focus();
    return;
  }

  memberElements.registerName?.focus();
}

function wireMemberEvents() {
  memberElements.loginForm?.addEventListener("submit", submitMemberLogin);
  memberElements.registerForm?.addEventListener("submit", submitMemberRegister);
  memberElements.checkinButton?.addEventListener("click", handleDailyCheckIn);
  memberElements.logoutButton?.addEventListener("click", handleMemberLogout);
  memberElements.copyCodeButton?.addEventListener("click", copyInviteCode);
  memberElements.rewardGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-reward-id]");
    if (!button) {
      return;
    }

    handleRewardRedeem(button.dataset.rewardId);
  });
  memberElements.authLinks.forEach((link) => {
    link.addEventListener("click", () => {
      focusAuthView(link.dataset.authView);
    });
  });
}

function hydrateReferralFromQuery() {
  const referralCode = new URLSearchParams(window.location.search).get("ref");
  if (referralCode && memberElements.registerReferral) {
    memberElements.registerReferral.value = referralCode.toUpperCase();
  }
}

async function bootstrapMemberClub() {
  if (!memberElements.publicStatus) {
    return;
  }

  if (memberElements.publicStatus) {
    memberElements.publicStatus.textContent = memberText().loading;
  }

  hydrateReferralFromQuery();
  wireMemberEvents();

  try {
    await refreshMemberOverview();
  } catch (error) {
    setMemberFeedback(`${memberText().errorPrefix}${error.message}`, true);
  }
}

bootstrapMemberClub();

const generationStatus = document.querySelector("#generation-status");
const matchdataStatus = document.querySelector("#matchdata-status");
const campaignStatus = document.querySelector("#campaign-status");
const storageStatus = document.querySelector("#storage-status");
const llmUsageStatus = document.querySelector("#llm-usage-status");
const llmCallsBody = document.querySelector("#admin-llm-calls-body");
const membersBody = document.querySelector("#admin-members-body");
const ledgerBody = document.querySelector("#admin-ledger-body");
const reservationsBody = document.querySelector("#admin-reservations-body");
const redemptionsBody = document.querySelector("#admin-redemptions-body");
const leadsBody = document.querySelector("#admin-leads-body");
const UI_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";

const UI_TEXT = {
  en: {
    configured: "Configured",
    apiUrl: "API URL",
    model: "Model",
    style: "Style",
    cache: "Cache",
    realFeed: "Real feed",
    total: "Total",
    draft: "Draft",
    ready: "Ready",
    queued: "Queued",
    storage: "Storage",
    database: "Database",
    path: "Path",
    notSet: "not set",
    empty: "No records yet.",
    yes: "Yes",
    no: "No",
    signupFlow: "Signup + booking loop",
    liveOps: "Live ops",
    providerMode: "Provider mode",
    records: "Records",
    referred: "Referred",
    direct: "Direct",
    points: "pts",
    totalCalls: "Total calls",
    success: "Success",
    failed: "Failed",
    promptTokens: "Prompt tokens",
    completionTokens: "Completion tokens",
    totalTokens: "Total tokens",
    cachedTokens: "Cached tokens",
    lastSuccess: "Last success",
    ms: "ms"
  },
  zh: {
    configured: "已配置",
    apiUrl: "接口地址",
    model: "模型",
    style: "接口风格",
    cache: "缓存",
    realFeed: "真实数据源",
    total: "总活动",
    draft: "草稿",
    ready: "待发布",
    queued: "已排队",
    storage: "存储",
    database: "数据库",
    path: "路径",
    notSet: "未设置",
    empty: "当前还没有记录。",
    yes: "是",
    no: "否",
    signupFlow: "注册到预约闭环",
    liveOps: "实时运营",
    providerMode: "接入模式",
    records: "记录数",
    referred: "被推荐",
    direct: "自然注册",
    points: "积分",
    totalCalls: "总调用",
    success: "成功",
    failed: "失败",
    promptTokens: "输入 token",
    completionTokens: "输出 token",
    totalTokens: "总 token",
    cachedTokens: "缓存 token",
    lastSuccess: "最近成功",
    ms: "毫秒"
  }
};

async function fetchStatus() {
  const response = await fetch("/api/system/status");
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to load system status");
  }
  return data;
}

function renderStatusBox(element, title, details) {
  element.innerHTML = `
    <strong>${title}</strong>
    <p>${details.join("<br />")}</p>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value) {
  return new Intl.NumberFormat(UI_LOCALE === "zh" ? "zh-CN" : "en-US").format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString(UI_LOCALE === "zh" ? "zh-CN" : "en-US");
}

function renderTableRows(element, rows, columns) {
  if (!element) {
    return;
  }

  if (!rows || !rows.length) {
    element.innerHTML = `<tr><td colspan="${columns.length}">${escapeHtml(UI_TEXT[UI_LOCALE].empty)}</td></tr>`;
    return;
  }

  element.innerHTML = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${column.format ? column.format(row) : escapeHtml(row[column.key])}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
}

function renderOpsTables(status) {
  const text = UI_TEXT[UI_LOCALE];
  renderTableRows(llmCallsBody, status.ops?.latestLlmCalls || [], [
    { key: "id", format: (row) => `#${formatNumber(row.id)}` },
    {
      key: "scope",
      format: (row) =>
        `<strong>${escapeHtml(row.scope)}</strong><div class="admin-table-sub">${escapeHtml(row.fieldKey || "—")} · ${escapeHtml(row.model || "—")}</div>`
    },
    {
      key: "status",
      format: (row) =>
        `<span class="admin-pill${row.status === "success" ? "" : " is-negative"}">${escapeHtml(row.status)}</span><div class="admin-table-sub">${escapeHtml(
          row.errorMessage || row.finishReason || "ok"
        )}</div>`
    },
    {
      key: "totalTokens",
      format: (row) =>
        `<strong>${formatNumber(row.totalTokens)}</strong><div class="admin-table-sub">${text.promptTokens}: ${formatNumber(
          row.promptTokens
        )} · ${text.completionTokens}: ${formatNumber(row.completionTokens)}</div>`
    },
    { key: "latencyMs", format: (row) => `${formatNumber(row.latencyMs)} ${text.ms}` },
    { key: "createdAt", format: (row) => `<span class="admin-table-sub">${escapeHtml(formatDateTime(row.createdAt))}</span>` }
  ]);

  renderTableRows(membersBody, status.ops?.latestMembers || [], [
    { key: "memberNumber", format: (row) => `#${formatNumber(row.memberNumber)}` },
    {
      key: "displayName",
      format: (row) =>
        `<strong>${escapeHtml(row.displayName)}</strong><div class="admin-table-sub">${escapeHtml(row.favoriteTeam || "—")}</div>`
    },
    { key: "email", format: (row) => `<span class="admin-table-sub">${escapeHtml(row.email)}</span>` },
    { key: "pointsBalance", format: (row) => `${formatNumber(row.pointsBalance)} ${escapeHtml(text.points)}` },
    {
      key: "referredByName",
      format: (row) => escapeHtml(row.referredByName ? `${text.yes} · ${row.referredByName}` : text.direct)
    },
    { key: "createdAt", format: (row) => `<span class="admin-table-sub">${escapeHtml(formatDateTime(row.createdAt))}</span>` }
  ]);

  renderTableRows(ledgerBody, status.ops?.latestLedger || [], [
    { key: "id", format: (row) => `#${formatNumber(row.id)}` },
    {
      key: "displayName",
      format: (row) =>
        `<strong>${escapeHtml(row.displayName)}</strong><div class="admin-table-sub">#${formatNumber(row.memberNumber)} · ${escapeHtml(row.email)}</div>`
    },
    {
      key: "eventCode",
      format: (row) => `<strong>${escapeHtml(row.eventCode)}</strong><div class="admin-table-sub">${escapeHtml(row.note || "—")}</div>`
    },
    {
      key: "pointsDelta",
      format: (row) =>
        `<span class="admin-pill${Number(row.pointsDelta || 0) < 0 ? " is-negative" : ""}">${Number(row.pointsDelta || 0) > 0 ? "+" : ""}${formatNumber(row.pointsDelta)} ${escapeHtml(text.points)}</span>`
    },
    { key: "balanceAfter", format: (row) => `${formatNumber(row.balanceAfter)} ${escapeHtml(text.points)}` },
    { key: "createdAt", format: (row) => `<span class="admin-table-sub">${escapeHtml(formatDateTime(row.createdAt))}</span>` }
  ]);

  renderTableRows(reservationsBody, status.ops?.latestReservations || [], [
    { key: "id", format: (row) => `#${formatNumber(row.id)}` },
    {
      key: "partyTitle",
      format: (row) =>
        `<strong>${escapeHtml(UI_LOCALE === "zh" ? row.partyTitleZh : row.partyTitle)}</strong><div class="admin-table-sub">${escapeHtml(row.partyId)}</div>`
    },
    {
      key: "reservationName",
      format: (row) =>
        `<strong>${escapeHtml(row.reservationName)}</strong><div class="admin-table-sub">${escapeHtml(row.email)}</div>`
    },
    { key: "groupSize", format: (row) => `${formatNumber(row.groupSize)} · ${escapeHtml(row.favoriteTeam || "—")}` },
    { key: "confirmationCode", format: (row) => `<span class="admin-table-sub">${escapeHtml(row.confirmationCode)}</span>` },
    { key: "createdAt", format: (row) => `<span class="admin-table-sub">${escapeHtml(formatDateTime(row.createdAt))}</span>` }
  ]);

  renderTableRows(redemptionsBody, status.ops?.latestPointRedemptions || [], [
    { key: "id", format: (row) => `#${formatNumber(row.id)}` },
    {
      key: "displayName",
      format: (row) =>
        `<strong>${escapeHtml(row.displayName || "—")}</strong><div class="admin-table-sub">#${formatNumber(row.memberNumber || 0)}</div>`
    },
    {
      key: "partyTitle",
      format: (row) =>
        `<strong>${escapeHtml(UI_LOCALE === "zh" ? row.partyTitleZh : row.partyTitle)}</strong><div class="admin-table-sub">reservation #${formatNumber(
          row.reservationId
        )}</div>`
    },
    { key: "pointsUsed", format: (row) => `<span class="admin-pill is-negative">-${formatNumber(row.pointsUsed)} ${escapeHtml(text.points)}</span>` },
    { key: "creditCount", format: (row) => `${formatNumber(row.creditCount)} · ${formatNumber(row.estimatedDiscountValue)} off` },
    { key: "createdAt", format: (row) => `<span class="admin-table-sub">${escapeHtml(formatDateTime(row.createdAt))}</span>` }
  ]);

  renderTableRows(leadsBody, status.ops?.latestSponsorLeads || [], [
    { key: "id", format: (row) => `#${formatNumber(row.id)}` },
    {
      key: "companyName",
      format: (row) =>
        `<strong>${escapeHtml(row.companyName)}</strong><div class="admin-table-sub">${escapeHtml(row.goal || "—")}</div>`
    },
    {
      key: "packageName",
      format: (row) =>
        `<strong>${escapeHtml(UI_LOCALE === "zh" ? row.packageNameZh : row.packageName)}</strong><div class="admin-table-sub">${escapeHtml(
          row.fixtureId || "—"
        )}</div>`
    },
    { key: "market", format: (row) => `<span class="admin-table-sub">${escapeHtml(row.market || "Global")}</span>` },
    {
      key: "contactName",
      format: (row) =>
        `<strong>${escapeHtml(row.contactName)}</strong><div class="admin-table-sub">${escapeHtml(row.email)}</div>`
    },
    { key: "createdAt", format: (row) => `<span class="admin-table-sub">${escapeHtml(formatDateTime(row.createdAt))}</span>` }
  ]);
}

async function bootstrapAdmin() {
  try {
    const status = await fetchStatus();
    const text = UI_TEXT[UI_LOCALE];
    renderStatusBox(generationStatus, status.generation.mode, [
      `${text.configured}: ${status.generation.configured}`,
      `${text.apiUrl}: ${status.generation.apiUrlConfigured}`,
      `${text.model}: ${status.generation.model || text.notSet}`,
      `${text.style}: ${status.generation.apiStyle}`
    ]);
    renderStatusBox(matchdataStatus, status.matchData.mode, [
      `${text.configured}: ${status.matchData.configured}`,
      `${text.apiUrl}: ${status.matchData.apiUrlConfigured}`,
      `${text.cache}: ${status.matchData.cacheMs} ms`,
      `${text.style}: ${status.matchData.apiStyle}`,
      `${text.realFeed}: ${status.realFixtures.provider} / ${status.realFixtures.leagueId} / ${status.realFixtures.season}`
    ]);
    renderStatusBox(campaignStatus, text.liveOps, [
      `${text.providerMode}: ${status.generation.mode} / ${status.matchData.mode}`,
      `${text.total}: ${status.campaigns.total}`,
      `${text.draft}: ${status.campaigns.draft}`,
      `${text.ready}: ${status.campaigns.ready}`,
      `${text.queued}: ${status.campaigns.queued}`,
      `${text.records}: ${(status.ops?.latestMembers || []).length + (status.ops?.latestReservations || []).length}`
    ]);
    renderStatusBox(storageStatus, status.storage.provider || text.storage, [
      `${text.configured}: ${status.storage.configured}`,
      `${text.database}: ${status.storage.provider}`,
      `${text.path}: ${status.storage.databasePath || text.notSet}`,
      `${text.total}: ${status.commerce.communityRooms + status.commerce.watchParties + status.commerce.sponsorPackages}`,
      `${text.signupFlow}: ${status.membership.memberCount} / ${status.membership.totalPointsRedeemed}`
    ]);
    renderStatusBox(llmUsageStatus, "gmi-usage", [
      `${text.totalCalls}: ${status.llmUsage?.totalCalls || 0}`,
      `${text.success}: ${status.llmUsage?.successCalls || 0}`,
      `${text.failed}: ${status.llmUsage?.failedCalls || 0}`,
      `${text.promptTokens}: ${formatNumber(status.llmUsage?.promptTokens || 0)}`,
      `${text.completionTokens}: ${formatNumber(status.llmUsage?.completionTokens || 0)}`,
      `${text.totalTokens}: ${formatNumber(status.llmUsage?.totalTokens || 0)}`,
      `${text.cachedTokens}: ${formatNumber(status.llmUsage?.cachedTokens || 0)}`,
      `${text.lastSuccess}: ${status.llmUsage?.lastSuccessAt ? formatDateTime(status.llmUsage.lastSuccessAt) : text.notSet}`
    ]);
    renderOpsTables(status);
  } catch (error) {
    generationStatus.textContent = error.message;
    matchdataStatus.textContent = error.message;
    campaignStatus.textContent = error.message;
    if (storageStatus) {
      storageStatus.textContent = error.message;
    }
    if (llmUsageStatus) {
      llmUsageStatus.textContent = error.message;
    }
    [llmCallsBody, membersBody, ledgerBody, reservationsBody, redemptionsBody, leadsBody].forEach((element) => {
      if (element) {
        element.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
      }
    });
  }
}

bootstrapAdmin();

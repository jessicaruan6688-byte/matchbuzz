const generationStatus = document.querySelector("#generation-status");
const matchdataStatus = document.querySelector("#matchdata-status");
const campaignStatus = document.querySelector("#campaign-status");
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
    notSet: "not set"
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
    notSet: "未设置"
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
    renderStatusBox(campaignStatus, "campaign-workflow", [
      `${text.total}: ${status.campaigns.total}`,
      `${text.draft}: ${status.campaigns.draft}`,
      `${text.ready}: ${status.campaigns.ready}`,
      `${text.queued}: ${status.campaigns.queued}`
    ]);
  } catch (error) {
    generationStatus.textContent = error.message;
    matchdataStatus.textContent = error.message;
    campaignStatus.textContent = error.message;
  }
}

bootstrapAdmin();

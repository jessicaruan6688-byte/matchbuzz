const UI_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const QUERY = new URLSearchParams(window.location.search);

const UI_TEXT = {
  en: {
    loadError: "Failed to load campaign detail",
    missingId: "Campaign id is missing",
    statusMap: {
      draft: "Draft",
      ready: "Review Complete",
      queued: "Queued"
    },
    sourceMap: {
      template: "Template engine",
      "template-fallback": "Template fallback",
      "remote-llm": "GMI Cloud / remote model"
    },
    marketLabels: {
      sea: "Southeast Asia",
      latam: "Latin America",
      global: "Global English"
    },
    channelLabels: {
      fan_community: "Fan Community Page",
      creator_short: "Creator Short Video",
      brand_social: "Brand Social Account"
    },
    angleLabels: {
      rivalry: "Rivalry Heat",
      star_spotlight: "Star Spotlight",
      fan_culture: "Fan Culture",
      tactical_debate: "Tactical Debate"
    },
    sceneLabels: {
      pre_match: "Pre-match Hype",
      live: "Live Interaction",
      post_match: "Post-match Recap"
    },
    workflowLabels: {
      inputs_locked: "Inputs locked",
      content_generated: "Localized assets generated",
      editor_review: "Editor review",
      publish_queue: "Publish queue"
    },
    workflowStates: {
      done: "Done",
      active: "Active",
      pending: "Pending"
    },
    meta: {
      market: "Target Market",
      channel: "Channel",
      angle: "Content Angle",
      language: "Output Language",
      source: "Generation Source",
      queue: "Queue Window"
    },
    cards: {
      headline: "Headline",
      socialPost: "Social Post",
      videoScript: "Video Script",
      recap: "Recap Angle",
      chant: "Support Chant",
      hashtags: "Hashtags"
    },
    poll: {
      title: "Poll Snapshot",
      empty: "No generated poll is attached to this campaign yet.",
      votes: "votes"
    },
    factsEmpty: "No fact layer attached.",
    hotTakesEmpty: "No talking points yet.",
    exportLoading: "Exporting brief...",
    exportDone: "Operator brief exported.",
    monetization: [
      "Monetization path: sponsored placements, fan-community ads, and creator distribution packages.",
      "Conversion path: ticketing redirects, partner packages, and matchday merchandise presale funnels."
    ],
    benchmarkNotes: [
      "Repeat-visit loops from fixtures, match detail, stats, and standings help football products retain daily traffic.",
      "Localized watch guides, venue discovery, and purchase steps move users from attention into action.",
      "Partner distribution workflows make the content layer useful for creators, communities, and sponsors at once.",
      "A combined sponsor-plus-commerce model creates a stronger business story than content generation alone."
    ],
    revenueCards: [
      {
        title: "Sponsor inventory",
        body: "Package this campaign as a branded live poll, a matchday discussion takeover, and a localized creator-distribution bundle."
      },
      {
        title: "Ticketing redirect",
        body: "Attach a local CTA for tickets, screenings, or watch-party reservation links based on the fixture city and market."
      },
      {
        title: "Merch & fan bundle",
        body: "Use the campaign page to sell jersey drops, fan kits, and sponsor-supported add-ons tied to this specific match."
      }
    ]
  },
  zh: {
    loadError: "活动详情加载失败",
    missingId: "缺少活动 id",
    statusMap: {
      draft: "草稿",
      ready: "已完成审校",
      queued: "已排队"
    },
    sourceMap: {
      template: "模板引擎",
      "template-fallback": "模板回退",
      "remote-llm": "GMI Cloud / 远程模型"
    },
    marketLabels: {
      sea: "东南亚",
      latam: "拉丁美洲",
      global: "全球英语市场"
    },
    channelLabels: {
      fan_community: "球迷社区页",
      creator_short: "创作者短视频",
      brand_social: "品牌社媒账号"
    },
    angleLabels: {
      rivalry: "宿敌对抗",
      star_spotlight: "球星焦点",
      fan_culture: "球迷文化",
      tactical_debate: "战术讨论"
    },
    sceneLabels: {
      pre_match: "赛前预热",
      live: "赛中互动",
      post_match: "赛后复盘"
    },
    workflowLabels: {
      inputs_locked: "输入已锁定",
      content_generated: "本地化素材已生成",
      editor_review: "编辑审校",
      publish_queue: "发布排队"
    },
    workflowStates: {
      done: "已完成",
      active: "进行中",
      pending: "待处理"
    },
    meta: {
      market: "目标市场",
      channel: "分发渠道",
      angle: "内容角度",
      language: "输出语言",
      source: "生成来源",
      queue: "排队时间"
    },
    cards: {
      headline: "标题",
      socialPost: "社媒文案",
      videoScript: "短视频口播稿",
      recap: "复盘角度",
      chant: "应援口号",
      hashtags: "标签"
    },
    poll: {
      title: "投票快照",
      empty: "当前活动还没有挂载生成投票。",
      votes: "票"
    },
    factsEmpty: "当前未接入事实层。",
    hotTakesEmpty: "当前没有讨论点。",
    exportLoading: "正在导出简报...",
    exportDone: "运营简报已导出。",
    monetization: [
      "商业路径：赞助位、社区广告和创作者分发包可以共同组成媒体收入层。",
      "转化路径：票务导流、合作权益包和比赛日周边预售可以组成交易层。"
    ],
    benchmarkNotes: [
      "赛程、详情、数据和积分榜形成的循环，能提升足球用户在比赛日的持续回访。",
      "本地化观赛指引、场馆发现和购买步骤，能把关注快速转成动作。",
      "合作方分发工作流能让内容层同时服务创作者、社区和赞助商。",
      "赞助收入加交易转化的双层模型，比单纯内容生成更有商业说服力。"
    ],
    revenueCards: [
      {
        title: "赞助货架",
        body: "把这场活动打包成品牌投票位、比赛日讨论接管和多语言创作者分发包。"
      },
      {
        title: "票务导流",
        body: "结合赛事城市和目标市场，挂本地门票、观赛活动或 watch-party 预约入口。"
      },
      {
        title: "周边与球迷包",
        body: "在活动页里继续售卖球衣、球迷礼包和赞助联名权益。"
      }
    ]
  }
};

const elements = {
  hero: document.querySelector("#campaign-hero"),
  contentGrid: document.querySelector("#campaign-content-grid"),
  metaDetail: document.querySelector("#campaign-meta-detail"),
  workflow: document.querySelector("#campaign-workflow"),
  activity: document.querySelector("#campaign-activity"),
  poll: document.querySelector("#campaign-poll"),
  facts: document.querySelector("#campaign-facts"),
  hotTakes: document.querySelector("#campaign-hot-takes"),
  revenue: document.querySelector("#campaign-revenue"),
  benchmarks: document.querySelector("#campaign-benchmarks"),
  studioLink: document.querySelector("#campaign-studio-link"),
  fixtureLink: document.querySelector("#campaign-fixture-link"),
  exportButton: document.querySelector("#campaign-export-button"),
  feedback: document.querySelector("#campaign-feedback")
};

function getText() {
  return UI_TEXT[UI_LOCALE];
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(UI_LOCALE === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function getMappedLabel(map, key) {
  return map[key] || key || "-";
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildStudioLink(campaignId) {
  const basePath = UI_LOCALE === "zh" ? "/zh/index.html" : "/";
  return `${basePath}?campaignId=${encodeURIComponent(campaignId)}#ops`;
}

function buildFixtureLink(matchId) {
  if (String(matchId || "").startsWith("real-")) {
    const basePath = UI_LOCALE === "zh" ? "/zh/match.html" : "/match.html";
    return `${basePath}?id=${encodeURIComponent(matchId)}`;
  }
  return UI_LOCALE === "zh" ? "/zh/matches.html" : "/matches.html";
}

function renderHero(campaign) {
  const text = getText();
  elements.hero.className = "detail-hero-grid";
  elements.hero.innerHTML = `
    <div>
      <p class="eyebrow">${campaign.id}</p>
      <h2>${campaign.match.homeTeam} vs ${campaign.match.awayTeam}</h2>
      <p class="hero-text">${getMappedLabel(text.sceneLabels, campaign.scene)} · ${getMappedLabel(text.statusMap, campaign.status)} · ${campaign.languageLabel}</p>
    </div>
    <div class="detail-kpi-grid">
      <div class="detail-kpi-card">
        <span>${UI_LOCALE === "zh" ? "开球时间" : "Kickoff"}</span>
        <strong>${formatTimestamp(campaign.match.kickOff)}</strong>
      </div>
      <div class="detail-kpi-card">
        <span>${UI_LOCALE === "zh" ? "场地" : "City / Venue"}</span>
        <strong>${campaign.match.city}</strong>
      </div>
      <div class="detail-kpi-card">
        <span>${UI_LOCALE === "zh" ? "阶段" : "Stage"}</span>
        <strong>${campaign.match.stage}</strong>
      </div>
      <div class="detail-kpi-card">
        <span>${UI_LOCALE === "zh" ? "支持球队" : "Support Team"}</span>
        <strong>${campaign.supportTeam}</strong>
      </div>
    </div>
  `;
}

function renderContent(campaign) {
  const labels = getText().cards;
  const contentCards = [
    { label: labels.headline, value: campaign.content.headline },
    { label: labels.socialPost, value: campaign.content.socialPost },
    { label: labels.videoScript, value: campaign.content.videoScript },
    { label: labels.recap, value: campaign.content.recap },
    { label: labels.chant, value: campaign.content.chant },
    { label: labels.hashtags, value: campaign.content.hashtags.join(" ") }
  ];

  elements.contentGrid.className = "content-detail-grid";
  elements.contentGrid.innerHTML = contentCards
    .map(
      (card) => `
        <article class="detail-card">
          <p class="eyebrow">${card.label}</p>
          <p>${card.value}</p>
        </article>
      `
    )
    .join("");
}

function renderMeta(campaign) {
  const text = getText();
  const cards = [
    { label: text.meta.market, value: getMappedLabel(text.marketLabels, campaign.targetMarket) },
    { label: text.meta.channel, value: getMappedLabel(text.channelLabels, campaign.channel) },
    { label: text.meta.angle, value: getMappedLabel(text.angleLabels, campaign.angle) },
    { label: text.meta.language, value: campaign.languageLabel },
    { label: text.meta.source, value: getMappedLabel(text.sourceMap, campaign.generationSource) },
    { label: text.meta.queue, value: campaign.queueWindow ? formatTimestamp(campaign.queueWindow) : "-" }
  ];

  elements.metaDetail.innerHTML = cards
    .map(
      (card) => `
        <div class="meta-card">
          <strong>${card.label}</strong>
          <span>${card.value}</span>
        </div>
      `
    )
    .join("");
}

function renderWorkflow(campaign) {
  const text = getText();
  elements.workflow.className = "workflow-steps";
  elements.workflow.innerHTML = campaign.workflow
    .map(
      (step) => `
        <div class="workflow-step workflow-step-${step.state}">
          <span class="workflow-dot" aria-hidden="true"></span>
          <strong>${getMappedLabel(text.workflowLabels, step.key)}</strong>
          <span>${getMappedLabel(text.workflowStates, step.state)}</span>
        </div>
      `
    )
    .join("");
}

function buildActivityCopy(entry) {
  if (UI_LOCALE === "zh") {
    const zh = {
      campaign_created: "活动工作区创建完成",
      poll_attached: "互动投票已接入",
      facts_attached: "事实层已同步",
      draft_saved: "草稿已保存",
      queued: "已加入发布队列",
      brief_exported: "运营简报已导出"
    };
    return zh[entry.code] || "活动已更新";
  }

  const en = {
    campaign_created: "Campaign workspace created",
    poll_attached: "Poll attached",
    facts_attached: "Fact layer synced",
    draft_saved: "Draft saved",
    queued: "Queued for publishing",
    brief_exported: "Operator brief exported"
  };
  return en[entry.code] || "Campaign updated";
}

function renderActivity(campaign) {
  if (!campaign.activity.length) {
    elements.activity.className = "activity-log empty-state";
    elements.activity.innerHTML = `<p>-</p>`;
    return;
  }

  elements.activity.className = "activity-log";
  elements.activity.innerHTML = campaign.activity
    .map(
      (entry) => `
        <div class="activity-item">
          <div class="activity-row">
            <strong>${buildActivityCopy(entry)}</strong>
            <span class="activity-time">${formatTimestamp(entry.createdAt)}</span>
          </div>
          <p>${entry.code}</p>
        </div>
      `
    )
    .join("");
}

function renderPoll(poll) {
  const text = getText();
  if (!poll) {
    elements.poll.className = "poll-summary empty-state";
    elements.poll.innerHTML = `<p>${text.poll.empty}</p>`;
    return;
  }

  elements.poll.className = "poll-summary";
  elements.poll.innerHTML = `
    <div class="poll-summary-head">
      <strong>${text.poll.title}</strong>
      <span>${poll.totalVotes} ${text.poll.votes}</span>
    </div>
    <p>${poll.question}</p>
    ${poll.options
      .map(
        (option) => `
          <div class="poll-summary-row">
            <div class="activity-row">
              <strong>${option.label}</strong>
              <span class="activity-time">${option.share}%</span>
            </div>
            <div class="vote-bar-shell"><div class="vote-bar" style="width:${option.share}%"></div></div>
          </div>
        `
      )
      .join("")}
  `;
}

function renderFacts(campaign) {
  elements.facts.innerHTML = campaign.funFacts.length
    ? campaign.funFacts.map((fact) => `<li>${fact}</li>`).join("")
    : `<li>${getText().factsEmpty}</li>`;
}

function renderHotTakes(campaign) {
  elements.hotTakes.className = "activity-log";
  elements.hotTakes.innerHTML = campaign.hotTakes.length
    ? campaign.hotTakes.map((take) => `<div class="activity-item"><p>${take}</p></div>`).join("")
    : `<div class="activity-item"><p>${getText().hotTakesEmpty}</p></div>`;
}

function renderRevenueNotes() {
  const notes = getText().monetization;
  const cards = getText().revenueCards;
  elements.revenue.className = "content-detail-grid";
  elements.revenue.innerHTML = cards
    .map(
      (card, index) => `
        <article class="detail-card monetization-note">
          <p class="eyebrow">${card.title}</p>
          <p>${card.body}</p>
          <p class="micro-copy">${notes[index % notes.length]}</p>
        </article>
      `
    )
    .join("");
}

function renderBenchmarkNotes() {
  const notes = getText().benchmarkNotes;
  elements.benchmarks.className = "content-detail-grid";
  elements.benchmarks.innerHTML = notes
    .map(
      (note, index) => `
        <article class="detail-card">
          <p class="eyebrow">${UI_LOCALE === "zh" ? `信号 ${index + 1}` : `Signal ${index + 1}`}</p>
          <p>${note}</p>
        </article>
      `
    )
    .join("");
}

async function exportBrief(campaignId) {
  elements.feedback.textContent = getText().exportLoading;
  const data = await fetchJson(`/api/campaigns/${campaignId}/export-brief`, {
    method: "POST",
    body: JSON.stringify({})
  });
  downloadTextFile(data.filename, data.text);
  elements.feedback.textContent = getText().exportDone;
}

async function bootstrap() {
  const campaignId = QUERY.get("id");
  if (!campaignId) {
    throw new Error(getText().missingId);
  }

  const data = await fetchJson(`/api/campaigns/${campaignId}`);
  const campaign = data.campaign;
  const pollData = campaign.generatedPollId
    ? await fetchJson(`/api/polls/${campaign.generatedPollId}/results`).catch(() => null)
    : null;

  renderHero(campaign);
  renderContent(campaign);
  renderMeta(campaign);
  renderWorkflow(campaign);
  renderActivity(campaign);
  renderPoll(pollData ? pollData.poll : null);
  renderFacts(campaign);
  renderHotTakes(campaign);
  renderRevenueNotes();
  renderBenchmarkNotes();

  elements.studioLink.href = buildStudioLink(campaign.id);
  elements.fixtureLink.href = buildFixtureLink(campaign.match.id);
  elements.exportButton.addEventListener("click", async () => {
    await exportBrief(campaign.id);
  });
}

bootstrap().catch((error) => {
  elements.hero.className = "detail-hero-grid empty-state";
  elements.hero.innerHTML = `<p>${getText().loadError}: ${error.message}</p>`;
});

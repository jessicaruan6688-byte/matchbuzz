const state = {
  matches: [],
  currentMatch: null,
  selectedMatchId: null,
  selectedTheme: "classic",
  generatedPollId: null,
  supportPollId: null,
  latestContent: null,
  currentCampaign: null,
  campaigns: [],
  customMatches: new Map()
};

const UI_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const QUERY = new URLSearchParams(window.location.search);
const TeamUI = window.MatchBuzzTeams || null;
const FALLBACK_NEWS_HOME_URL = "https://www.bbc.com/sport/football";

const UI_TEXT = {
  en: {
    placeholderSocial: "Generated social copy will appear here.",
    placeholderVideo: "A short-form video hook will appear here.",
    placeholderChant: "A fan support chant will appear here.",
    placeholderRecap: "A recap angle will appear here.",
    placeholderTags: "#WorldCupBuzz #MatchBuzz",
    generating: "Generating content...",
    generatedTitle: (result) => `${withFlagLabel(result.match.homeTeam)} vs ${withFlagLabel(result.match.awayTeam)} · ${result.sceneLabel}`,
    pollEmptyTitle: "Generate content to create a live poll.",
    pollEmptyBody: "Your generated poll will appear here.",
    voteSuffix: "votes",
    voteButton: "Vote",
    copy: "Copy",
    copied: "Copied",
    copyCaption: "Copy Caption",
    reportDone: "Report flow recorded. In production this would open a moderation review.",
    reportReason: "User requested moderation review from the ops panel.",
    loadFailed: "Failed to load MatchBuzz",
    supportQuestion: (match) => `Who are you backing in ${withFlagLabel(match.homeTeam)} vs ${withFlagLabel(match.awayTeam)}?`,
    sharePlaceholderHeadline: "Build a World Cup campaign",
    sharePlaceholderCaption: "Localized content, live interaction, and exportable matchday assets.",
    stageMap: {
      "Featured Rivalry": "Featured Rivalry",
      "Featured Knockout Theme": "Featured Knockout Theme",
      "Host Region Spotlight": "Host Region Spotlight"
    },
    storylineMap: {},
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
    metaLabels: {
      source: "Generation Source",
      market: "Target Market",
      channel: "Channel",
      angle: "Content Angle",
      scene: "Campaign Scene",
      queue: "Queue Window",
      interaction: "Interaction"
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
    noCampaignName: "Generate a package to create the first campaign workspace.",
    metaFallback: "Not set",
    interactionReady: "Live poll attached",
    interactionPending: "Poll not attached",
    emptyActivity: "Generate content to create the first campaign timeline.",
    emptyCampaignList: "Your saved campaigns will appear here.",
    queueChip: (count) => `${count} queued`,
    createdSuccess: "Campaign workspace created from generated assets.",
    saveSuccess: "Draft saved to operator workspace.",
    queueSuccess: "Campaign added to publish queue.",
    exportSuccess: "Operator brief exported.",
    saving: "Saving draft...",
    queueing: "Queueing campaign...",
    exporting: "Exporting brief...",
    updatedAt: "Updated",
    fixtureBoardEmpty: "No fixtures available yet.",
    fixtureBoardBadges: ["Featured", "Creator-ready", "Fan route"],
    fixtureBoardActions: {
      detail: "Fixture",
      studio: "Build pack",
      community: "Room"
    },
    fixtureBoardMeta: {
      kickoff: "Kickoff",
      city: "City"
    },
    newsRead: "Read Story",
    newsPublished: "Published",
    newsUnavailable: "Live football headlines are temporarily unavailable.",
    newsFallbackSummary: "Open the original report for the latest football update.",
    newsSourceLive: "BBC Sport live links",
    newsSourceFallback: "BBC Sport cached links"
  },
  zh: {
    placeholderSocial: "这里会显示生成后的社媒文案。",
    placeholderVideo: "这里会显示短视频口播稿。",
    placeholderChant: "这里会显示球迷应援口号。",
    placeholderRecap: "这里会显示赛后复盘角度。",
    placeholderTags: "#世界杯热度 #MatchBuzz",
    generating: "正在生成内容...",
    generatedTitle: (result) => `${withFlagLabel(result.match.homeTeam)} vs ${withFlagLabel(result.match.awayTeam)} · ${result.sceneLabel}`,
    pollEmptyTitle: "先生成内容，再创建互动投票。",
    pollEmptyBody: "生成后的投票会显示在这里。",
    voteSuffix: "票",
    voteButton: "投票",
    copy: "复制",
    copied: "已复制",
    copyCaption: "复制文案",
    reportDone: "已记录举报流程。正式版中这里会进入审核处理。",
    reportReason: "用户在运营面板中请求内容审核。",
    loadFailed: "MatchBuzz 加载失败",
    supportQuestion: (match) => `${withFlagLabel(match.homeTeam)} vs ${withFlagLabel(match.awayTeam)}，你支持哪支球队？`,
    sharePlaceholderHeadline: "创建世界杯活动",
    sharePlaceholderCaption: "多语言内容、实时互动和可导出的比赛素材。",
    stageMap: {
      "Featured Rivalry": "焦点宿敌战",
      "Featured Knockout Theme": "焦点淘汰赛主题",
      "Host Region Spotlight": "东道主区域焦点"
    },
    storylineMap: {
      "arg-bra": "这是一场围绕控制力、创造力和关键时刻戏剧性展开的南美焦点对决。",
      "esp-fra": "这场比赛把控球、抗压出球和终结效率结合成了一场高强度战术对抗。",
      "mex-usa": "这是一场由情绪、节奏和区域身份认同共同推动的大热比赛。"
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
    metaLabels: {
      source: "生成来源",
      market: "目标市场",
      channel: "分发渠道",
      angle: "内容角度",
      scene: "活动场景",
      queue: "排队时间",
      interaction: "互动状态"
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
    noCampaignName: "先生成一版内容，创建第一个活动工作区。",
    metaFallback: "未设置",
    interactionReady: "互动投票已接入",
    interactionPending: "暂未接入投票",
    emptyActivity: "生成内容后，这里会出现活动时间线。",
    emptyCampaignList: "保存后的活动会显示在这里。",
    queueChip: (count) => `${count} 个排队中`,
    createdSuccess: "已根据生成内容创建活动工作区。",
    saveSuccess: "草稿已保存到运营工作区。",
    queueSuccess: "活动已加入发布队列。",
    exportSuccess: "运营简报已导出。",
    saving: "正在保存草稿...",
    queueing: "正在加入发布队列...",
    exporting: "正在导出简报...",
    updatedAt: "更新于",
    fixtureBoardEmpty: "暂时还没有可展示的比赛。",
    fixtureBoardBadges: ["焦点比赛", "创作优先", "社区流量"],
    fixtureBoardActions: {
      detail: "详情页",
      studio: "生成内容",
      community: "球迷房"
    },
    fixtureBoardMeta: {
      kickoff: "开球",
      city: "城市"
    },
    newsRead: "打开原文",
    newsPublished: "发布时间",
    newsUnavailable: "暂时无法加载实时足球新闻。",
    newsFallbackSummary: "打开原文查看完整报道。",
    newsSourceLive: "BBC Sport 实时链接",
    newsSourceFallback: "BBC Sport 缓存链接"
  }
};

const elements = {
  form: document.querySelector("#generator-form"),
  matchSelect: document.querySelector("#match-select"),
  supportTeamSelect: document.querySelector("#support-team-select"),
  marketSelect: document.querySelector("#market-select"),
  languageSelect: document.querySelector("#language-select"),
  channelSelect: document.querySelector("#channel-select"),
  sceneSelect: document.querySelector("#scene-select"),
  angleSelect: document.querySelector("#angle-select"),
  funToggle: document.querySelector("#fun-toggle"),
  snapshotTitle: document.querySelector("#snapshot-title"),
  snapshotStoryline: document.querySelector("#snapshot-storyline"),
  snapshotStage: document.querySelector("#snapshot-stage"),
  snapshotCity: document.querySelector("#snapshot-city"),
  outputTitle: document.querySelector("#output-title"),
  languageChip: document.querySelector("#language-chip"),
  headlineCopy: document.querySelector("#headline-copy"),
  socialCopy: document.querySelector("#social-copy"),
  videoCopy: document.querySelector("#video-copy"),
  chantCopy: document.querySelector("#chant-copy"),
  recapCopy: document.querySelector("#recap-copy"),
  hashtagsCopy: document.querySelector("#hashtags-copy"),
  generatedPollQuestion: document.querySelector("#generated-poll-question"),
  generatedPollTotal: document.querySelector("#generated-poll-total"),
  generatedPollOptions: document.querySelector("#generated-poll-options"),
  supportQuestion: document.querySelector("#support-question"),
  supportTotal: document.querySelector("#support-total"),
  supportOptions: document.querySelector("#support-options"),
  trendingTags: document.querySelector("#trending-tags"),
  hotTakes: document.querySelector("#hot-takes"),
  funFactsList: document.querySelector("#fun-facts-list"),
  sharePreview: document.querySelector("#share-preview"),
  downloadLink: document.querySelector("#download-link"),
  copyCaptionButton: document.querySelector("#copy-caption-button"),
  reportButton: document.querySelector("#report-button"),
  reportFeedback: document.querySelector("#report-feedback"),
  fixtureBoard: document.querySelector("#fixture-board"),
  campaignName: document.querySelector("#campaign-name"),
  campaignStatusPill: document.querySelector("#campaign-status-pill"),
  campaignMetaGrid: document.querySelector("#campaign-meta-grid"),
  workflowSteps: document.querySelector("#workflow-steps"),
  campaignDetailLink: document.querySelector("#campaign-detail-link"),
  saveDraftButton: document.querySelector("#save-draft-button"),
  queueCampaignButton: document.querySelector("#queue-campaign-button"),
  exportBriefButton: document.querySelector("#export-brief-button"),
  opsFeedback: document.querySelector("#ops-feedback"),
  activityLog: document.querySelector("#activity-log"),
  campaignList: document.querySelector("#campaign-list"),
  campaignQueueChip: document.querySelector("#campaign-queue-chip"),
  newsSourcePill: document.querySelector("#news-source-pill"),
  newsTicker: document.querySelector("#news-ticker"),
  topNewsGrid: document.querySelector("#top-news-grid"),
  aiBriefingList: document.querySelector("#ai-briefing-list"),
  coverageNewsList: document.querySelector("#coverage-news-list"),
  playerNewsList: document.querySelector("#player-news-list")
};

function getUiText() {
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

function formatKickoff(value) {
  return new Intl.DateTimeFormat(UI_LOCALE === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

function formatTimestamp(value) {
  if (!value) {
    return getUiText().metaFallback;
  }

  return new Intl.DateTimeFormat(UI_LOCALE === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatNewsTimestamp(value) {
  if (!value) {
    return getUiText().metaFallback;
  }

  return new Intl.DateTimeFormat(UI_LOCALE === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderTeamMarkup(teamName) {
  if (TeamUI && typeof TeamUI.renderFlagMarkup === "function") {
    return TeamUI.renderFlagMarkup(teamName, {
      label: teamName,
      compact: true
    });
  }

  return escapeHtml(withFlagLabel(teamName));
}

function getFixtureDetailPath(matchId) {
  const target = UI_LOCALE === "zh" ? "/zh/match.html" : "/match.html";
  return `${target}?id=${encodeURIComponent(matchId)}`;
}

function getStudioPathForMatch(matchId) {
  const target = UI_LOCALE === "zh" ? "/zh/index.html" : "/";
  return `${target}?matchId=${encodeURIComponent(matchId)}#studio`;
}

function getCommunityPathForMatch(match) {
  const target = UI_LOCALE === "zh" ? "/zh/community.html" : "/community.html";
  const query = new URLSearchParams({
    fixtureId: match.id,
    fixtureLabel: `${match.homeTeam} vs ${match.awayTeam}`
  });
  return `${target}?${query.toString()}`;
}

function withFlagLabel(teamName) {
  if (TeamUI && typeof TeamUI.withEmojiLabel === "function") {
    return TeamUI.withEmojiLabel(teamName);
  }
  return teamName;
}

function getFieldText(element) {
  return "value" in element ? element.value.trim() : element.textContent.trim();
}

function setFieldText(element, value) {
  if ("value" in element) {
    element.value = value;
    return;
  }
  element.textContent = value;
}

function getMappedLabel(map, key) {
  return map[key] || key || getUiText().metaFallback;
}

function isCustomMatchId(matchId) {
  return state.customMatches.has(matchId);
}

function buildCustomMatchPayload(match) {
  return {
    id: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickOff: match.kickOff,
    city: match.city,
    stage: match.stage,
    storyline: match.storyline,
    facts: match.facts || [],
    tags: match.tags || [],
    hotTakes: match.hotTakes || [],
    leagueId: match.leagueId,
    league: match.league,
    season: match.season,
    round: match.round,
    homeBadge: match.homeBadge,
    awayBadge: match.awayBadge,
    leagueBadge: match.leagueBadge,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore
  };
}

function getSceneLabel(scene) {
  return getMappedLabel(getUiText().sceneLabels, scene);
}

function getStatusLabel(status) {
  return getMappedLabel(getUiText().statusMap, status);
}

function getSourceLabel(source) {
  return getMappedLabel(getUiText().sourceMap, source);
}

function buildCampaignName(campaign) {
  return `${withFlagLabel(campaign.match.homeTeam)} vs ${withFlagLabel(campaign.match.awayTeam)} · ${getSceneLabel(campaign.scene)}`;
}

function getCampaignDetailHref(campaignId) {
  const basePath = UI_LOCALE === "zh" ? "/zh/campaign.html" : "/campaign.html";
  return `${basePath}?id=${encodeURIComponent(campaignId)}`;
}

function buildActivityCopy(entry) {
  const text = getUiText();

  switch (entry.code) {
    case "campaign_created":
      return UI_LOCALE === "zh"
        ? {
            title: "活动工作区已创建",
            detail: `${getSceneLabel(entry.meta.scene)}内容已生成，目标市场为${getMappedLabel(
              text.marketLabels,
              entry.meta.market
            )}。`
          }
        : {
            title: "Campaign workspace created",
            detail: `${getSceneLabel(entry.meta.scene)} assets are ready for ${getMappedLabel(
              text.marketLabels,
              entry.meta.market
            )}.`
          };
    case "poll_attached":
      return UI_LOCALE === "zh"
        ? {
            title: "互动层已接入",
            detail: "生成投票已挂到当前活动，可直接用于球迷互动。"
          }
        : {
            title: "Interaction layer attached",
            detail: "The generated poll is attached and ready for fan voting."
          };
    case "facts_attached":
      return UI_LOCALE === "zh"
        ? {
            title: "趣味信息已同步",
            detail: `已接入 ${entry.meta.count || 0} 条公开安全的足球信息。`
          }
        : {
            title: "Fact layer synced",
            detail: `${entry.meta.count || 0} safe football facts were added to the package.`
          };
    case "draft_saved":
      return UI_LOCALE === "zh"
        ? {
            title: "草稿已保存",
            detail: entry.meta.auto
              ? "系统已自动创建审校节点并保存当前版本。"
              : `已更新 ${entry.meta.changedFields || 0} 个字段并保存到运营工作区。`
          }
        : {
            title: "Draft saved",
            detail: entry.meta.auto
              ? "The workflow auto-created a review checkpoint before queueing."
              : `${entry.meta.changedFields || 0} fields were updated and saved to the operator workspace.`
          };
    case "queued":
      return UI_LOCALE === "zh"
        ? {
            title: "已加入发布队列",
            detail: `将面向${getMappedLabel(text.channelLabels, entry.meta.channel)}在 ${formatTimestamp(
              entry.meta.queueWindow
            )} 左右发布。`
          }
        : {
            title: "Queued for publishing",
            detail: `Scheduled for ${getMappedLabel(text.channelLabels, entry.meta.channel)} around ${formatTimestamp(
              entry.meta.queueWindow
            )}.`
          };
    case "brief_exported":
      return UI_LOCALE === "zh"
        ? {
            title: "运营简报已导出",
            detail: "可直接用于答辩展示、内部对齐或后续交接。"
          }
        : {
            title: "Operator brief exported",
            detail: "The brief is ready for pitch review, ops alignment, or handoff."
          };
    default:
      return UI_LOCALE === "zh"
        ? {
            title: "活动已更新",
            detail: "当前活动状态已刷新。"
          }
        : {
            title: "Campaign updated",
            detail: "The current campaign state was refreshed."
          };
  }
}

function renderMatchOptions(matches) {
  elements.matchSelect.innerHTML = matches
    .map((match) => {
      const stage = getUiText().stageMap[match.stage] || match.stage;
      const prefix = isCustomMatchId(match.id)
        ? UI_LOCALE === "zh"
          ? "真实赛事"
          : "Real Fixture"
        : "";
      return `<option value="${match.id}">${prefix ? `${prefix} · ` : ""}${withFlagLabel(match.homeTeam)} vs ${withFlagLabel(match.awayTeam)} · ${stage}</option>`;
    })
    .join("");
}

function renderFixtureBoard(matches) {
  if (!elements.fixtureBoard) {
    return;
  }

  if (!matches.length) {
    elements.fixtureBoard.innerHTML = `<article class="fixture-card fixture-card-loading"><p>${getUiText().fixtureBoardEmpty}</p></article>`;
    return;
  }

  const text = getUiText();
  elements.fixtureBoard.innerHTML = matches
    .slice(0, 3)
    .map((match, index) => {
      const badge = text.fixtureBoardBadges[index] || text.fixtureBoardBadges[text.fixtureBoardBadges.length - 1];
      const stage = text.stageMap[match.stage] || match.stage;
      const city = match.city || text.metaFallback;
      const storyline = text.storylineMap[match.id] || match.storyline;

      return `
        <article class="fixture-card${index === 0 ? " fixture-card-featured" : ""}">
          <div class="fixture-card-top">
            <span class="status-pill${index % 2 === 1 ? " status-pill-alt" : ""}">${escapeHtml(badge)}</span>
            <span class="fixture-card-kickoff">${escapeHtml(formatKickoff(match.kickOff))}</span>
          </div>
          <div class="fixture-card-title">
            <strong>${renderTeamMarkup(match.homeTeam)}</strong>
            <span>vs</span>
            <strong>${renderTeamMarkup(match.awayTeam)}</strong>
          </div>
          <div class="fixture-card-meta">
            <span>${escapeHtml(stage)}</span>
            <span>${escapeHtml(text.fixtureBoardMeta.city)} · ${escapeHtml(city)}</span>
          </div>
          <p class="fixture-card-story">${escapeHtml(storyline)}</p>
          <div class="fixture-card-routes">
            <span>${escapeHtml(text.fixtureBoardMeta.kickoff)} · ${escapeHtml(formatKickoff(match.kickOff))}</span>
            <span>${escapeHtml(stage)}</span>
          </div>
          <div class="fixture-card-actions">
            <a class="button button-secondary" href="${getFixtureDetailPath(match.id)}">${escapeHtml(text.fixtureBoardActions.detail)}</a>
            <a class="button button-primary" href="${getStudioPathForMatch(match.id)}">${escapeHtml(text.fixtureBoardActions.studio)}</a>
            <a class="button button-secondary" href="${getCommunityPathForMatch(match)}">${escapeHtml(text.fixtureBoardActions.community)}</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSupportTeams(match) {
  elements.supportTeamSelect.innerHTML = [match.homeTeam, match.awayTeam]
    .map((team) => `<option value="${team}">${withFlagLabel(team)}</option>`)
    .join("");
}

function renderSnapshot(match) {
  elements.snapshotTitle.textContent = `${withFlagLabel(match.homeTeam)} vs ${withFlagLabel(match.awayTeam)} · ${formatKickoff(match.kickOff)}`;
  elements.snapshotStoryline.textContent = getUiText().storylineMap[match.id] || match.storyline;
  elements.snapshotStage.textContent = getUiText().stageMap[match.stage] || match.stage;
  elements.snapshotCity.textContent = match.city;
}

function applyQueryPresets(afterMatch = false) {
  const genericFields = [
    [elements.languageSelect, QUERY.get("language")],
    [elements.marketSelect, QUERY.get("market")],
    [elements.channelSelect, QUERY.get("channel")],
    [elements.sceneSelect, QUERY.get("scene")],
    [elements.angleSelect, QUERY.get("angle")]
  ];

  if (!afterMatch) {
    genericFields.forEach(([element, value]) => {
      if (value && Array.from(element.options).some((option) => option.value === value)) {
        element.value = value;
      }
    });
    return;
  }

  const supportTeam = QUERY.get("supportTeam");
  if (supportTeam && Array.from(elements.supportTeamSelect.options).some((option) => option.value === supportTeam)) {
    elements.supportTeamSelect.value = supportTeam;
  }
}

function renderTrending(tags, hotTakes) {
  elements.trendingTags.innerHTML = tags.map((tag) => `<span>${tag}</span>`).join("");
  elements.hotTakes.innerHTML = hotTakes.map((take) => `<div>${take}</div>`).join("");
}

function renderFacts(facts) {
  elements.funFactsList.innerHTML = facts.map((fact) => `<li>${fact}</li>`).join("");
}

function setPlaceholderContent() {
  const text = getUiText();
  setFieldText(elements.socialCopy, text.placeholderSocial);
  setFieldText(elements.videoCopy, text.placeholderVideo);
  setFieldText(elements.chantCopy, text.placeholderChant);
  setFieldText(elements.recapCopy, text.placeholderRecap);
  setFieldText(elements.hashtagsCopy, text.placeholderTags);
}

function renderGeneratedContent(result) {
  state.latestContent = {
    match: result.match,
    language: result.language,
    languageLabel: result.languageLabel,
    scene: result.scene,
    sceneLabel: result.sceneLabel,
    supportTeam: result.supportTeam,
    content: {
      ...result.content,
      hashtags: [...result.content.hashtags]
    }
  };

  elements.outputTitle.textContent = getUiText().generatedTitle(result);
  elements.languageChip.textContent = result.languageLabel;
  setFieldText(elements.headlineCopy, result.content.headline);
  setFieldText(elements.socialCopy, result.content.socialPost);
  setFieldText(elements.videoCopy, result.content.videoScript);
  setFieldText(elements.chantCopy, result.content.chant);
  setFieldText(elements.recapCopy, result.content.recap);
  setFieldText(elements.hashtagsCopy, result.content.hashtags.join(" "));
}

function renderTopNewsCard(item) {
  const title = escapeHtml(item.title);
  const summary = escapeHtml(item.summary || getUiText().newsFallbackSummary);
  const source = escapeHtml(item.source || "Football News");
  const link = escapeHtml(item.link);
  const timeLabel = item.publishedAt
    ? `${getUiText().newsPublished} ${formatNewsTimestamp(item.publishedAt)}`
    : getUiText().newsPublished;
  const visual = item.image
    ? `
        <div class="news-card-visual-shell">
          <img class="news-card-visual" src="${escapeHtml(item.image)}" alt="${title}" loading="lazy" />
        </div>
      `
    : `<div class="news-card-fallback" aria-hidden="true">⚽</div>`;

  return `
    <article class="panel news-card">
      ${visual}
      <div class="news-card-copy">
        <p class="eyebrow">${source}</p>
        <h4>
          <a class="news-card-title-link" href="${link}" target="_blank" rel="noreferrer">${title}</a>
        </h4>
        <p class="depth-copy">${summary}</p>
        <div class="news-card-meta">
          <span>${escapeHtml(timeLabel)}</span>
          <a class="button button-primary" href="${link}" target="_blank" rel="noreferrer">${getUiText().newsRead}</a>
        </div>
      </div>
    </article>
  `;
}

function renderPlayerNewsItem(item) {
  const title = escapeHtml(item.title);
  const source = escapeHtml(item.source || "Football News");
  const timeLabel = item.publishedAt
    ? `${source} · ${formatNewsTimestamp(item.publishedAt)}`
    : source;

  return `
    <a class="storyline-item" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">
      <strong>${title}</strong>
      <span>${escapeHtml(timeLabel)}</span>
    </a>
  `;
}

function buildFallbackNewsItem() {
  return {
    id: "news-provider-home",
    title: UI_LOCALE === "zh" ? "打开 BBC Sport Football 查看最新足球新闻" : "Open BBC Sport Football for the latest football news",
    link: FALLBACK_NEWS_HOME_URL,
    summary: getUiText().newsFallbackSummary,
    image: null,
    publishedAt: null,
    source: "BBC Sport"
  };
}

function renderAiBriefingItem(item) {
  return `
    <div class="storyline-item">
      <strong>${escapeHtml(item.headline || "")}</strong>
      <span>${escapeHtml(item.sourceLabel || (UI_LOCALE === "zh" ? "GMI Cloud 首页洞察" : "GMI Cloud homepage briefing"))}</span>
    </div>
  `;
}

async function loadAiBriefing() {
  if (!elements.aiBriefingList) {
    return;
  }

  const data = await fetchJson(`/api/briefing?language=${UI_LOCALE}`);
  const items = Array.isArray(data.items) ? data.items : [];
  const sourceLabel =
    data.source === "remote-llm"
      ? UI_LOCALE === "zh"
        ? "GMI Cloud 实时生成"
        : "GMI Cloud live generation"
      : UI_LOCALE === "zh"
        ? "模板回退"
        : "Template fallback";

  elements.aiBriefingList.innerHTML = items
    .slice(0, 3)
    .map((item) => renderAiBriefingItem({ ...item, sourceLabel }))
    .join("");
}

async function loadTopNews() {
  if (!elements.topNewsGrid || !elements.newsTicker || !elements.newsSourcePill) {
    return;
  }

  const data = await fetchJson("/api/news/football?limit=6");
  const items = Array.isArray(data.items) ? data.items : [];
  const effectiveItems = items.length ? items : [buildFallbackNewsItem()];

  elements.newsSourcePill.textContent =
    data.provider || (data.mode === "live" || data.mode === "live-cache" ? getUiText().newsSourceLive : getUiText().newsSourceFallback);

  elements.topNewsGrid.innerHTML = effectiveItems.slice(0, 3).map(renderTopNewsCard).join("");

  if (elements.coverageNewsList) {
    elements.coverageNewsList.innerHTML = effectiveItems.slice(0, 3).map(renderPlayerNewsItem).join("");
  }

  if (elements.playerNewsList) {
    const playerNewsItems = (
      effectiveItems.slice(3, 6).length ? effectiveItems.slice(3, 6) : effectiveItems.slice(0, 3)
    ).map(renderPlayerNewsItem);
    elements.playerNewsList.innerHTML = playerNewsItems.join("");
  }
  const tickerItems = effectiveItems.concat(effectiveItems);
  elements.newsTicker.innerHTML = `
      <div class="headline-ticker-track">
        ${tickerItems
          .map(
            (item) => `
              <a class="headline-ticker-item" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">
                <span aria-hidden="true">⚽</span>
                <span>${escapeHtml(item.title)}</span>
              </a>
            `
          )
          .join("")}
      </div>
    `;
}

function renderPoll(container, poll, voteHandler) {
  const text = getUiText();
  container.innerHTML = poll.options
    .map(
      (option) => `
        <div class="vote-option">
          <div class="vote-meta">
            <strong>${option.label}</strong>
            <span>${option.share}% · ${option.votes} ${text.voteSuffix}</span>
          </div>
          <div class="vote-bar-shell"><div class="vote-bar" style="width:${option.share}%"></div></div>
          <button class="button button-secondary" data-option-id="${option.id}" type="button">${text.voteButton}</button>
        </div>
      `
    )
    .join("");

  container.querySelectorAll("button[data-option-id]").forEach((button) => {
    button.addEventListener("click", () => voteHandler(button.dataset.optionId));
  });
}

async function refreshSupportPoll() {
  if (!state.supportPollId) {
    return;
  }

  const data = await fetchJson(`/api/polls/${state.supportPollId}/results`);
  elements.supportQuestion.textContent = state.currentMatch
    ? getUiText().supportQuestion(state.currentMatch)
    : data.poll.question;
  elements.supportTotal.textContent = `${data.poll.totalVotes} ${getUiText().voteSuffix}`;
  renderPoll(elements.supportOptions, data.poll, async (optionId) => {
    await fetchJson(`/api/polls/${state.supportPollId}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionId })
    });
    await refreshSupportPoll();
  });
}

async function refreshGeneratedPoll() {
  if (!state.generatedPollId) {
    elements.generatedPollQuestion.textContent = getUiText().pollEmptyTitle;
    elements.generatedPollTotal.textContent = `0 ${getUiText().voteSuffix}`;
    elements.generatedPollOptions.innerHTML = `<p>${getUiText().pollEmptyBody}</p>`;
    return;
  }

  const data = await fetchJson(`/api/polls/${state.generatedPollId}/results`);
  elements.generatedPollQuestion.textContent = data.poll.question;
  elements.generatedPollTotal.textContent = `${data.poll.totalVotes} ${getUiText().voteSuffix}`;
  renderPoll(elements.generatedPollOptions, data.poll, async (optionId) => {
    await fetchJson(`/api/polls/${state.generatedPollId}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionId })
    });
    await refreshGeneratedPoll();
  });
}

async function createGeneratedPoll(result) {
  const data = await fetchJson("/api/polls", {
    method: "POST",
    body: JSON.stringify({
      matchId: result.match.id,
      match: isCustomMatchId(result.match.id) ? buildCustomMatchPayload(state.currentMatch) : undefined,
      question: result.content.pollQuestion,
      options: result.content.pollOptions
    })
  });

  state.generatedPollId = data.pollId;
  await refreshGeneratedPoll();
}

function getSharePayload() {
  const placeholderMatch = state.currentMatch;
  const content = state.latestContent ? syncLatestContentFromEditors() : null;

  if (content && state.latestContent) {
    return {
      matchId: state.latestContent.match.id,
      supportTeam: state.latestContent.supportTeam,
      headline: content.headline,
      caption: content.socialPost.slice(0, 112),
      language: state.latestContent.language,
      theme: state.selectedTheme,
      match: isCustomMatchId(state.latestContent.match.id) ? buildCustomMatchPayload(state.currentMatch) : undefined
    };
  }

  if (!placeholderMatch) {
    return null;
  }

  return {
    matchId: placeholderMatch.id,
    supportTeam: elements.supportTeamSelect.value || placeholderMatch.homeTeam,
    headline: getUiText().sharePlaceholderHeadline,
    caption: getUiText().sharePlaceholderCaption,
    language: elements.languageSelect.value || "en",
    theme: state.selectedTheme,
    match: isCustomMatchId(placeholderMatch.id) ? buildCustomMatchPayload(placeholderMatch) : undefined
  };
}

async function refreshShareCard() {
  const payload = getSharePayload();
  if (!payload) {
    return;
  }

  const card = await fetchJson("/api/generate/share-card", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(card.svg)}`;
  elements.sharePreview.src = dataUrl;
  elements.downloadLink.href = dataUrl;
  elements.downloadLink.download = card.filename;
}

async function handleMatchChange() {
  const matchId = elements.matchSelect.value;
  state.selectedMatchId = matchId;

  if (isCustomMatchId(matchId)) {
    const match = state.customMatches.get(matchId);
    state.currentMatch = match;
    state.supportPollId = match.supportPollId || null;
    renderSupportTeams(match);
    renderSnapshot(match);
    renderFacts(match.facts || []);
    renderTrending(match.tags || [], match.hotTakes || []);
    await refreshSupportPoll();
    state.generatedPollId = null;
    await refreshGeneratedPoll();
    await refreshShareCard();
    return;
  }

  const matchData = await fetchJson(`/api/matches/${matchId}`);
  const match = matchData.match;
  state.currentMatch = match;
  state.supportPollId = match.supportPollId;

  renderSupportTeams(match);
  renderSnapshot(match);

  const [factsData, trendingData] = await Promise.all([
    fetchJson(`/api/fun-facts/${matchId}?language=${elements.languageSelect.value}`),
    fetchJson(`/api/trending/${matchId}`)
  ]);

  renderFacts(factsData.facts);
  renderTrending(trendingData.tags, trendingData.hotTakes);
  await refreshSupportPoll();
  state.generatedPollId = null;
  await refreshGeneratedPoll();
  await refreshShareCard();
}

function collectGenerationPayload() {
  const payload = {
    matchId: elements.matchSelect.value,
    supportTeam: elements.supportTeamSelect.value,
    targetMarket: elements.marketSelect.value,
    language: elements.languageSelect.value,
    channel: elements.channelSelect.value,
    scene: elements.sceneSelect.value,
    angle: elements.angleSelect.value,
    includeFun: elements.funToggle.checked
  };

  if (state.currentMatch && isCustomMatchId(payload.matchId)) {
    payload.match = buildCustomMatchPayload(state.currentMatch);
  };

  return payload;
}

function parseHashtags(rawText) {
  return rawText
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`));
}

function syncLatestContentFromEditors() {
  if (!state.latestContent) {
    return null;
  }

  state.latestContent.content = {
    headline: getFieldText(elements.headlineCopy),
    socialPost: getFieldText(elements.socialCopy),
    videoScript: getFieldText(elements.videoCopy),
    chant: getFieldText(elements.chantCopy),
    recap: getFieldText(elements.recapCopy),
    hashtags: parseHashtags(getFieldText(elements.hashtagsCopy))
  };

  return state.latestContent.content;
}

function buildCampaignMetaCards(campaign) {
  const text = getUiText();
  return [
    { label: text.metaLabels.source, value: getSourceLabel(campaign.generationSource) },
    { label: text.metaLabels.market, value: getMappedLabel(text.marketLabels, campaign.targetMarket) },
    { label: text.metaLabels.channel, value: getMappedLabel(text.channelLabels, campaign.channel) },
    { label: text.metaLabels.angle, value: getMappedLabel(text.angleLabels, campaign.angle) },
    { label: text.metaLabels.scene, value: getSceneLabel(campaign.scene) },
    { label: text.metaLabels.queue, value: formatTimestamp(campaign.queueWindow) },
    {
      label: text.metaLabels.interaction,
      value: campaign.generatedPollId ? text.interactionReady : text.interactionPending
    }
  ];
}

function renderCampaignMeta(campaign) {
  const cards = campaign
    ? buildCampaignMetaCards(campaign)
    : [
        { label: getUiText().metaLabels.source, value: getUiText().metaFallback },
        { label: getUiText().metaLabels.market, value: getUiText().metaFallback },
        { label: getUiText().metaLabels.channel, value: getUiText().metaFallback },
        { label: getUiText().metaLabels.angle, value: getUiText().metaFallback }
      ];

  elements.campaignMetaGrid.innerHTML = cards
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
  const steps = campaign
    ? campaign.workflow
    : [
        { key: "inputs_locked", state: "active" },
        { key: "content_generated", state: "pending" },
        { key: "editor_review", state: "pending" },
        { key: "publish_queue", state: "pending" }
      ];

  elements.workflowSteps.innerHTML = steps
    .map(
      (step) => `
        <div class="workflow-step workflow-step-${step.state}">
          <span class="workflow-dot" aria-hidden="true"></span>
          <strong>${getMappedLabel(getUiText().workflowLabels, step.key)}</strong>
          <span>${getMappedLabel(getUiText().workflowStates, step.state)}</span>
        </div>
      `
    )
    .join("");
}

function setCampaignStatusPill(status) {
  const classNames = {
    draft: "status-pill",
    ready: "status-pill status-pill-ready",
    queued: "status-pill status-pill-queued"
  };

  elements.campaignStatusPill.className = classNames[status] || "status-pill";
  elements.campaignStatusPill.textContent = getStatusLabel(status);
}

function setCampaignButtonsEnabled(enabled) {
  elements.saveDraftButton.disabled = !enabled;
  elements.queueCampaignButton.disabled = !enabled;
  elements.exportBriefButton.disabled = !enabled;
}

function renderActivityLog(campaign) {
  if (!campaign || !campaign.activity.length) {
    elements.activityLog.className = "activity-log empty-state";
    elements.activityLog.innerHTML = `<p>${getUiText().emptyActivity}</p>`;
    return;
  }

  elements.activityLog.className = "activity-log";
  elements.activityLog.innerHTML = campaign.activity
    .map((entry) => {
      const copy = buildActivityCopy(entry);
      return `
        <div class="activity-item">
          <div class="activity-row">
            <strong>${copy.title}</strong>
            <span class="activity-time">${formatTimestamp(entry.createdAt)}</span>
          </div>
          <p>${copy.detail}</p>
        </div>
      `;
    })
    .join("");
}

function renderCampaignList() {
  const queuedCount = state.campaigns.filter((campaign) => campaign.status === "queued").length;
  elements.campaignQueueChip.textContent = getUiText().queueChip(queuedCount);

  if (!state.campaigns.length) {
    elements.campaignList.className = "campaign-list empty-state";
    elements.campaignList.innerHTML = `<p>${getUiText().emptyCampaignList}</p>`;
    return;
  }

  elements.campaignList.className = "campaign-list";
  elements.campaignList.innerHTML = state.campaigns
    .map((campaign) => {
      const active = state.currentCampaign && state.currentCampaign.id === campaign.id ? " campaign-list-item-active" : "";
      return `
        <button class="campaign-list-item${active}" data-campaign-id="${campaign.id}" type="button">
          <div class="campaign-list-row">
            <strong>${campaign.matchLabel}</strong>
            <span class="campaign-pill">${getStatusLabel(campaign.status)}</span>
          </div>
          <p>${getSceneLabel(campaign.scene)} · ${getMappedLabel(getUiText().marketLabels, campaign.targetMarket)} · ${getMappedLabel(
            getUiText().channelLabels,
            campaign.channel
          )}</p>
          <p>${getUiText().updatedAt} ${formatTimestamp(campaign.updatedAt)}</p>
        </button>
      `;
    })
    .join("");

  elements.campaignList.querySelectorAll("button[data-campaign-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadCampaign(button.dataset.campaignId);
    });
  });
}

function renderCampaign(campaign) {
  state.currentCampaign = campaign;
  elements.campaignName.textContent = campaign ? buildCampaignName(campaign) : getUiText().noCampaignName;
  setCampaignStatusPill(campaign ? campaign.status : "draft");
  renderCampaignMeta(campaign);
  renderWorkflow(campaign);
  renderActivityLog(campaign);
  setCampaignButtonsEnabled(Boolean(campaign));
  if (elements.campaignDetailLink) {
    if (campaign) {
      elements.campaignDetailLink.hidden = false;
      elements.campaignDetailLink.href = getCampaignDetailHref(campaign.id);
    } else {
      elements.campaignDetailLink.hidden = true;
      elements.campaignDetailLink.href = getCampaignDetailHref("draft");
    }
  }
  renderCampaignList();
}

async function refreshCampaignList() {
  const data = await fetchJson("/api/campaigns");
  state.campaigns = data.campaigns;
  renderCampaignList();
}

function applyCampaignToForm(campaign) {
  const currentMatch = state.matches.find((match) => match.id === campaign.matchId);

  if (currentMatch) {
    state.currentMatch = currentMatch;
    state.supportPollId = currentMatch.supportPollId;
    elements.matchSelect.value = currentMatch.id;
    renderSupportTeams(currentMatch);
    renderSnapshot(currentMatch);
  } else {
    state.currentMatch = {
      ...campaign.match,
      storyline: elements.snapshotStoryline.textContent,
      supportPollId: null
    };
    renderSupportTeams(campaign.match);
    renderSnapshot({
      ...campaign.match,
      storyline: campaign.match.storyline || elements.snapshotStoryline.textContent
    });
  }

  elements.supportTeamSelect.value = campaign.supportTeam;
  elements.marketSelect.value = campaign.targetMarket;
  elements.languageSelect.value = campaign.language;
  elements.channelSelect.value = campaign.channel;
  elements.sceneSelect.value = campaign.scene;
  elements.angleSelect.value = campaign.angle;
  elements.funToggle.checked = campaign.includeFun;
}

async function loadCampaign(campaignId) {
  const data = await fetchJson(`/api/campaigns/${campaignId}`);
  const campaign = data.campaign;

  applyCampaignToForm(campaign);

  renderGeneratedContent({
    match: campaign.match,
    language: campaign.language,
    languageLabel: campaign.languageLabel,
    scene: campaign.scene,
    sceneLabel: getSceneLabel(campaign.scene),
    supportTeam: campaign.supportTeam,
    content: campaign.content
  });

  renderFacts(campaign.funFacts);
  renderTrending(campaign.trending, campaign.hotTakes);

  state.generatedPollId = campaign.generatedPollId;
  await refreshSupportPoll();
  await refreshGeneratedPoll();
  renderCampaign(campaign);
  await refreshShareCard();
}

async function createCampaignFromResult(result, payload) {
  const data = await fetchJson("/api/campaigns", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      match: payload.match || null,
      generationSource: result.generationSource,
      generatedPollId: state.generatedPollId,
      content: result.content,
      funFacts: result.funFacts,
      trending: result.trending,
      hotTakes: result.hotTakes
    })
  });

  renderCampaign(data.campaign);
  await refreshCampaignList();
}

async function generateCurrentContent() {
  const payload = collectGenerationPayload();

  elements.outputTitle.textContent = getUiText().generating;
  elements.opsFeedback.textContent = "";

  const result = await fetchJson("/api/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  renderGeneratedContent(result);

  if (result.funFacts.length) {
    renderFacts(result.funFacts);
  }

  await createGeneratedPoll(result);
  await refreshShareCard();
  await createCampaignFromResult(result, payload);
  elements.opsFeedback.textContent = getUiText().createdSuccess;
}

async function handleGenerate(event) {
  event.preventDefault();
  await generateCurrentContent();
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function wireCopyButtons() {
  document.querySelectorAll(".copy-trigger").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.querySelector(`#${button.dataset.copyTarget}`);
      if (!target) {
        return;
      }

      await copyText(getFieldText(target));
      button.textContent = getUiText().copied;
      setTimeout(() => {
        button.textContent = getUiText().copy;
      }, 1200);
    });
  });
}

function wireThemeButtons() {
  document.querySelectorAll(".theme-chip").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll(".theme-chip").forEach((chip) => chip.classList.remove("theme-chip-active"));
      button.classList.add("theme-chip-active");
      state.selectedTheme = button.dataset.theme;
      await refreshShareCard();
    });
  });
}

function wireHeroMotion() {
  const heroVisual = document.querySelector("[data-hero-visual]");
  if (!heroVisual || window.matchMedia("(max-width: 720px)").matches) {
    return;
  }

  const glow = heroVisual.querySelector("[data-hero-glow]");
  const cards = Array.from(heroVisual.querySelectorAll("[data-float-card]"));

  if (!cards.length) {
    return;
  }

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let frameId = null;
  let visibleCount = 0;
  let lastPointer = null;
  let travel = 0;
  let hideTimer = null;

  const syncVisibleCards = () => {
    cards.forEach((card, index) => {
      card.classList.toggle("hero-float-visible", index < visibleCount);
    });
  };

  const render = () => {
    currentX += (targetX - currentX) * 0.09;
    currentY += (targetY - currentY) * 0.09;

    cards.forEach((card, index) => {
      const depth = Number(card.dataset.depth || 0.16);
      const factor = 54 + index * 8;
      const rotate = currentX * depth * 10;
      card.style.transform = `translate3d(${currentX * factor * depth}px, ${currentY * factor * depth}px, 0) rotate(${rotate}deg)`;
    });

    if (glow) {
      glow.style.transform = `translate3d(${currentX * 28}px, ${currentY * 28}px, 0)`;
    }

    if (Math.abs(targetX - currentX) < 0.002 && Math.abs(targetY - currentY) < 0.002) {
      frameId = null;
      return;
    }

    frameId = window.requestAnimationFrame(render);
  };

  const queueRender = () => {
    if (frameId === null) {
      frameId = window.requestAnimationFrame(render);
    }
  };

  const revealNextCard = () => {
    visibleCount = Math.min(cards.length, visibleCount + 1);
    syncVisibleCards();
  };

  heroVisual.addEventListener("mousemove", (event) => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    const bounds = heroVisual.getBoundingClientRect();
    targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

    if (!lastPointer) {
      lastPointer = { x: event.clientX, y: event.clientY };
      if (visibleCount === 0) {
        revealNextCard();
      }
    } else {
      travel += Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
      lastPointer = { x: event.clientX, y: event.clientY };

      while (travel >= 110 && visibleCount < cards.length) {
        travel -= 110;
        revealNextCard();
      }
    }

    queueRender();
  });

  heroVisual.addEventListener("mouseleave", () => {
    targetX = 0;
    targetY = 0;
    travel = 0;
    lastPointer = null;
    hideTimer = window.setTimeout(() => {
      visibleCount = 0;
      syncVisibleCards();
    }, 90);
    queueRender();
  });
}

function wireShareCopy() {
  elements.copyCaptionButton.addEventListener("click", async () => {
    if (!state.latestContent) {
      return;
    }

    const content = syncLatestContentFromEditors();
    const text = `${content.socialPost}\n\n${content.hashtags.join(" ")}`;
    await copyText(text);
    elements.copyCaptionButton.textContent = getUiText().copied;
    setTimeout(() => {
      elements.copyCaptionButton.textContent = getUiText().copyCaption;
    }, 1200);
  });
}

function wireReportButton() {
  elements.reportButton.addEventListener("click", async () => {
    await fetchJson("/api/report", {
      method: "POST",
      body: JSON.stringify({
        reason: getUiText().reportReason
      })
    });
    elements.reportFeedback.textContent = getUiText().reportDone;
  });
}

async function persistCurrentDraft(showFeedback = true) {
  if (!state.currentCampaign) {
    return null;
  }

  syncLatestContentFromEditors();

  if (showFeedback) {
    elements.opsFeedback.textContent = getUiText().saving;
  }

  const data = await fetchJson(`/api/campaigns/${state.currentCampaign.id}/save-draft`, {
    method: "POST",
    body: JSON.stringify({
      targetMarket: elements.marketSelect.value,
      channel: elements.channelSelect.value,
      angle: elements.angleSelect.value,
      content: {
        headline: state.latestContent.content.headline,
        socialPost: state.latestContent.content.socialPost,
        videoScript: state.latestContent.content.videoScript,
        chant: state.latestContent.content.chant,
        recap: state.latestContent.content.recap,
        hashtags: state.latestContent.content.hashtags
      }
    })
  });

  renderCampaign(data.campaign);
  await refreshCampaignList();
  await refreshShareCard();

  if (showFeedback) {
    elements.opsFeedback.textContent = getUiText().saveSuccess;
  }

  return data.campaign;
}

async function queueCurrentCampaign() {
  if (!state.currentCampaign) {
    return;
  }

  elements.opsFeedback.textContent = getUiText().queueing;
  await persistCurrentDraft(false);

  const data = await fetchJson(`/api/campaigns/${state.currentCampaign.id}/queue`, {
    method: "POST",
    body: JSON.stringify({})
  });

  renderCampaign(data.campaign);
  await refreshCampaignList();
  elements.opsFeedback.textContent = getUiText().queueSuccess;
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

async function exportCurrentBrief() {
  if (!state.currentCampaign) {
    return;
  }

  elements.opsFeedback.textContent = getUiText().exporting;
  await persistCurrentDraft(false);

  const data = await fetchJson(`/api/campaigns/${state.currentCampaign.id}/export-brief`, {
    method: "POST",
    body: JSON.stringify({})
  });

  renderCampaign(data.campaign);
  await refreshCampaignList();
  downloadTextFile(data.filename, data.text);
  elements.opsFeedback.textContent = getUiText().exportSuccess;
}

function wireOpsButtons() {
  elements.saveDraftButton.addEventListener("click", async () => {
    await persistCurrentDraft(true);
  });

  elements.queueCampaignButton.addEventListener("click", async () => {
    await queueCurrentCampaign();
  });

  elements.exportBriefButton.addEventListener("click", async () => {
    await exportCurrentBrief();
  });
}

async function preloadFixtureFromQuery() {
  const fixtureId = QUERY.get("fixtureId");
  if (!fixtureId) {
    return null;
  }

  const data = await fetchJson(`/api/real/fixtures/${fixtureId}`);
  const fixture = data.fixture;
  state.customMatches.set(fixture.id, fixture);
  state.matches = [fixture].concat(state.matches.filter((match) => match.id !== fixture.id));
  return fixture.id;
}

async function bootstrap() {
  if (TeamUI && typeof TeamUI.decorateFlagNodes === "function") {
    TeamUI.decorateFlagNodes(document);
  }
  setPlaceholderContent();
  renderCampaign(null);
  wireCopyButtons();
  wireThemeButtons();
  wireHeroMotion();
  wireShareCopy();
  wireReportButton();
  wireOpsButtons();

  elements.form.addEventListener("submit", handleGenerate);
  elements.matchSelect.addEventListener("change", handleMatchChange);
  elements.languageSelect.addEventListener("change", handleMatchChange);

  const data = await fetchJson("/api/matches");
  state.matches = data.matches;
  await Promise.all([loadTopNews(), loadAiBriefing()]);
  const preloadedFixtureId = await preloadFixtureFromQuery();
  renderMatchOptions(state.matches);
  renderFixtureBoard(state.matches);
  const matchIdFromQuery = QUERY.get("matchId");
  if (preloadedFixtureId) {
    elements.matchSelect.value = preloadedFixtureId;
  } else if (matchIdFromQuery && Array.from(elements.matchSelect.options).some((option) => option.value === matchIdFromQuery)) {
    elements.matchSelect.value = matchIdFromQuery;
  }
  applyQueryPresets(false);
  await handleMatchChange();
  applyQueryPresets(true);
  await refreshCampaignList();

  const campaignId = QUERY.get("campaignId");
  if (campaignId) {
    await loadCampaign(campaignId);
  }
}

bootstrap().catch((error) => {
  elements.outputTitle.textContent = getUiText().loadFailed;
  setFieldText(elements.socialCopy, error.message);
});

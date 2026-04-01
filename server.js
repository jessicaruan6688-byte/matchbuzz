const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { URL } = require("url");

loadLocalEnv();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = resolveDataDir(process.env.DATA_DIR);
const DB_PATH = path.join(DATA_DIR, "matchbuzz.sqlite");
const APP_HOST = process.env.APP_HOST || "127.0.0.1";
const SITE_URL = String(process.env.SITE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const DEFAULT_GMI_API_URL = "https://api.gmi-serving.com/v1/chat/completions";
const DEFAULT_GMI_MODEL = "MiniMaxAI/MiniMax-M2.7";
const GMI_MODEL_ALIASES = {
  "b55d47ed-0d1e-467e-ae93-f1500402d184": "MiniMaxAI/MiniMax-M2.7",
  "minimax-m2-7": "MiniMaxAI/MiniMax-M2.7",
  "minimaxai/minimax-m2.7": "MiniMaxAI/MiniMax-M2.7"
};

const CONFIG = {
  llm: {
    apiUrl: process.env.GMI_API_URL || process.env.LLM_API_URL || DEFAULT_GMI_API_URL,
    apiKey: process.env.GMI_API_KEY || process.env.LLM_API_KEY || "",
    model: resolveConfiguredModel(process.env.GMI_MODEL || process.env.LLM_MODEL || DEFAULT_GMI_MODEL),
    apiStyle: process.env.LLM_API_STYLE || "openai-chat",
    authHeader: process.env.LLM_API_AUTH_HEADER || "Authorization",
    authPrefix: process.env.LLM_API_AUTH_PREFIX || "Bearer"
  },
  matchData: {
    apiUrl: process.env.MATCH_DATA_API_URL || "",
    apiKey: process.env.MATCH_DATA_API_KEY || "",
    apiStyle: process.env.MATCH_DATA_API_STYLE || "matchbuzz-json",
    authHeader: process.env.MATCH_DATA_API_AUTH_HEADER || "Authorization",
    authPrefix: process.env.MATCH_DATA_API_AUTH_PREFIX || "Bearer",
    cacheMs: Number(process.env.MATCH_DATA_CACHE_MS || 300000)
  },
  realFixtures: {
    baseUrl: process.env.REAL_FIXTURE_API_URL || "https://www.thesportsdb.com/api/v1/json/123",
    leagueId: process.env.REAL_FIXTURE_LEAGUE_ID || "4328",
    season: process.env.REAL_FIXTURE_SEASON || "2025-2026",
    cacheMs: Number(process.env.REAL_FIXTURE_CACHE_MS || 300000)
  }
};

function resolveDataDir(rawValue) {
  const configured = String(rawValue || "").trim();
  if (!configured) {
    if (process.env.VERCEL) {
      return path.join("/tmp", "matchbuzz-data");
    }
    return path.join(__dirname, "data");
  }
  return path.resolve(configured);
}

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      return;
    }

    const key = trimmed.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) {
      return;
    }

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

function resolveConfiguredModel(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const alias = GMI_MODEL_ALIASES[raw] || GMI_MODEL_ALIASES[raw.toLowerCase()];
  return alias || raw;
}

const remoteMatchesCache = {
  expiresAt: 0,
  items: null
};

const realFixturesCache = {
  upcoming: {
    expiresAt: 0,
    items: null
  },
  recent: {
    expiresAt: 0,
    items: null
  },
  table: {
    expiresAt: 0,
    items: null
  }
};

const pageIntelCache = new Map();
const FOOTBALL_NEWS_FEED_URL =
  process.env.FOOTBALL_NEWS_FEED_URL || "https://feeds.bbci.co.uk/sport/football/rss.xml";
const footballNewsCache = {
  expiresAt: 0,
  items: [],
  provider: "BBC Sport RSS",
  fetchedAt: null
};
const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MEMBERSHIP_RULES = {
  signupBonus: 120,
  checkInBonus: 18,
  referralBonuses: {
    level1: 80,
    level2: 40,
    level3: 20
  },
  luckyBonuses: [
    {
      key: "lucky-7",
      points: 77,
      match: (memberNumber) => String(memberNumber).endsWith("7")
    },
    {
      key: "lucky-77",
      points: 177,
      match: (memberNumber) => String(memberNumber).endsWith("77")
    },
    {
      key: "lucky-777",
      points: 777,
      match: (memberNumber) => String(memberNumber).endsWith("777")
    },
    {
      key: "lucky-10000",
      points: 5000,
      match: (memberNumber) => Number(memberNumber) > 0 && Number(memberNumber) % 10000 === 0
    }
  ]
};
const WATCH_PARTY_POINTS_RULES = {
  pointsPerCredit: 120,
  discountValuePerCredit: 10,
  maxCreditsPerBooking: 4
};
const TRAFFIC_EVENT_TYPES = ["page_view", "cta_click", "conversion"];
const PLAYER_IMAGE_URLS = {
  messi: "https://r2.thesportsdb.com/images/media/player/thumb/kpfsvp1725295651.jpg",
  mbappe: "https://r2.thesportsdb.com/images/media/player/thumb/0yw04y1771265385.jpg",
  bellingham: "https://r2.thesportsdb.com/images/media/player/thumb/rfg8xd1771263826.jpg"
};
const PLAYER_IMAGE_PROXY_PATHS = {
  messi: "/api/media/player-photo/messi",
  mbappe: "/api/media/player-photo/mbappe",
  bellingham: "/api/media/player-photo/bellingham"
};
const PLAYER_FALLBACK_META = {
  messi: { name: "Messi", number: "10", top: "#7bdcff", bottom: "#1f5b98" },
  mbappe: { name: "Mbappe", number: "7", top: "#5da2ff", bottom: "#0f255d" },
  bellingham: { name: "Bellingham", number: "22", top: "#ffd86c", bottom: "#8a6414" }
};
const MEMBERSHIP_REWARD_CATALOG = [
  {
    id: "ticket-credit-10",
    title: "USD 10 Ticket Credit",
    titleZh: "10 美元票务抵扣",
    description: "Use points on selected ticketing and watch-party reservations.",
    descriptionZh: "可用于指定票务和观赛活动的积分抵扣。",
    partner: "Ticketing partners",
    partnerZh: "票务合作方",
    cost: 320,
    category: "ticketing",
    ctaPath: "/watch-parties.html",
    ctaPathZh: "/zh/watch-parties.html"
  },
  {
    id: "fan-club-priority",
    title: "Fan Club Priority Pass",
    titleZh: "球迷会优先通行证",
    description: "Unlock premium fan-room badges, pinned comments, and queue priority.",
    descriptionZh: "解锁球迷房徽章、置顶评论和优先入场权益。",
    partner: "Fan clubs",
    partnerZh: "球迷会",
    cost: 180,
    category: "community",
    ctaPath: "/community.html",
    ctaPathZh: "/zh/community.html"
  },
  {
    id: "sponsor-gear-drop",
    title: "Sponsor Gear Drop",
    titleZh: "赞助商周边兑换",
    description: "Redeem co-branded merch packs from sponsor activations and ad partners.",
    descriptionZh: "兑换赞助商联名周边和广告合作礼包。",
    partner: "Brand sponsors",
    partnerZh: "品牌赞助商",
    cost: 240,
    category: "sponsor",
    ctaPath: "/partners.html",
    ctaPathZh: "/zh/partners.html"
  },
  {
    id: "watch-party-fastlane",
    title: "Watch Party Fast Lane",
    titleZh: "观赛活动快速通道",
    description: "Apply points to seat holds, fast-lane check-in, and partner event access.",
    descriptionZh: "可用于座位预留、快速签到和合作活动入场。",
    partner: "Event operators",
    partnerZh: "活动合作方",
    cost: 260,
    category: "events",
    ctaPath: "/watch-parties.html",
    ctaPathZh: "/zh/watch-parties.html"
  }
];
const STATIC_FOOTBALL_NEWS_FALLBACK = [
  {
    id: "fallback-1",
    title: "Lionel Messi 2026 tracker: Inter Miami, Argentina stats and goals",
    link: "https://www.espn.com/soccer/story/_/id/47978642/lionel-messi-2026-tracker-inter-miami-argentina-games-goals-assists-stats",
    summary: "Messi's 2026 form tracker across Inter Miami and Argentina, including goals, assists, and match rhythm.",
    image: PLAYER_IMAGE_PROXY_PATHS.messi,
    publishedAt: "2026-03-07T12:00:00Z",
    source: "ESPN"
  },
  {
    id: "fallback-2",
    title: "Lionel Messi scores 900th career goal in Inter Miami win",
    link: "https://www.espn.com/soccer/story/_/id/48022638/lionel-messi-scores-900th-career-goal-inter-miami-beat-cf-montreal",
    summary: "A milestone match for Messi as Inter Miami keep global attention fixed on his 2026 season.",
    image: PLAYER_IMAGE_PROXY_PATHS.messi,
    publishedAt: "2026-02-20T12:00:00Z",
    source: "ESPN"
  },
  {
    id: "fallback-3",
    title: "Kylian Mbappe focused on another France World Cup triumph",
    link: "https://www.espn.com/soccer/story/_/id/46966620/kylian-mbappe-too-focused-another-france-world-cup-triumph-dwell-400-goals",
    summary: "Mbappe frames the season around France and the next World Cup cycle rather than personal goal milestones.",
    image: PLAYER_IMAGE_PROXY_PATHS.mbappe,
    publishedAt: "2025-11-15T12:00:00Z",
    source: "ESPN"
  },
  {
    id: "fallback-4",
    title: "Jude Bellingham eyes trophies after a poor 2025",
    link: "https://www.espn.com/soccer/story/_/id/47461587/real-madrid-jude-bellingham-eyes-trophies-poor-2025",
    summary: "Bellingham resets expectations with silverware and big-stage control as the priority for the new cycle.",
    image: PLAYER_IMAGE_PROXY_PATHS.bellingham,
    publishedAt: "2025-12-31T12:00:00Z",
    source: "ESPN"
  },
  {
    id: "fallback-5",
    title: "All you need to know one year out from the 2026 World Cup",
    link: "https://www.espn.com/soccer/story/_/id/45486885/all-need-know-one-year-2026-world-cup",
    summary: "A broad tournament overview covering hosts, format, venues, and key build-up storylines for 2026.",
    image: null,
    publishedAt: "2025-06-11T12:00:00Z",
    source: "ESPN"
  },
  {
    id: "fallback-6",
    title: "Thomas Tuchel ready to chase England's 2026 World Cup dream",
    link: "https://www.espn.com/soccer/story/_/id/47214871/2026-world-cup-england-thomas-tuchel-ready-realise-childhood-dream-tournament",
    summary: "England's 2026 storyline centers on tournament ambition, squad identity, and knockout-stage pressure.",
    image: PLAYER_IMAGE_PROXY_PATHS.bellingham,
    publishedAt: "2025-12-06T12:00:00Z",
    source: "ESPN"
  }
];

const matches = [
  {
    id: "arg-bra",
    homeTeam: "Argentina",
    awayTeam: "Brazil",
    kickOff: "2026-06-19T20:00:00Z",
    city: "New York / New Jersey",
    stage: "Featured Rivalry",
    storyline: "A heavyweight South American rivalry built on control, creativity, and late-match drama.",
    facts: [
      "Both fanbases turn any neutral venue into a home crowd within minutes.",
      "This rivalry is usually framed as structure versus improvisation.",
      "Public football culture around this fixture travels especially well in Spanish and Portuguese-speaking markets."
    ],
    tags: ["#WorldCupBuzz", "#Argentina", "#Brazil", "#RivalryNight"],
    hotTakes: [
      "The midfield duel will shape the entire tempo.",
      "One transition moment could decide everything.",
      "The crowd energy will matter as much as the tactics."
    ]
  },
  {
    id: "esp-fra",
    homeTeam: "Spain",
    awayTeam: "France",
    kickOff: "2026-06-23T18:30:00Z",
    city: "Dallas",
    stage: "Featured Knockout Theme",
    storyline: "Possession, press resistance, and elite finishing turn this into a high-IQ contest.",
    facts: [
      "This fixture is perfect for tactical storytelling and creator explainers.",
      "It performs well with audiences that prefer analysis over pure fandom.",
      "Brand accounts can position this match as elegance versus efficiency."
    ],
    tags: ["#WorldCupBuzz", "#Spain", "#France", "#TacticalBattle"],
    hotTakes: [
      "Who controls central spaces will own the narrative.",
      "A single set piece may break the balance.",
      "The first 15 minutes will reveal the true momentum."
    ]
  },
  {
    id: "mex-usa",
    homeTeam: "Mexico",
    awayTeam: "USA",
    kickOff: "2026-06-27T01:00:00Z",
    city: "Mexico City",
    stage: "Host Region Spotlight",
    storyline: "Emotion, tempo, and regional pride make this one of the loudest matchups in the tournament conversation.",
    facts: [
      "The atmosphere around this matchup is a product in itself for fan communities.",
      "It is ideal for bilingual English-Spanish campaigns.",
      "Supporter identity is usually the strongest conversion trigger for this fixture."
    ],
    tags: ["#WorldCupBuzz", "#Mexico", "#USMNT", "#HostEnergy"],
    hotTakes: [
      "This game will be driven by nerve before tactics.",
      "The louder team mentality wins the marginal moments.",
      "Second-half substitutions could swing the entire story."
    ]
  }
];

const polls = new Map();
const campaigns = new Map();
const communityRooms = new Map();
const watchParties = new Map();
const sponsorPackages = new Map();
let campaignSequence = 1;
let activitySequence = 1;
let memberSequence = 1;
let db = null;

const factTranslations = {
  zh: {
    "arg-bra": [
      "两边球迷都能在几分钟内把中立场地变成主场氛围。",
      "这组对决常被解读为结构对即兴、控制对灵感。",
      "这场比赛的公共足球文化话题，天然适合在西语和葡语市场传播。"
    ],
    "esp-fra": [
      "这组对决非常适合做战术型内容和高质量复盘。",
      "它在偏分析向、偏内容深度的观众里通常更容易引发讨论。",
      "对品牌方来说，这场比赛很适合包装成优雅与效率的对抗。"
    ],
    "mex-usa": [
      "这组比赛的主场氛围本身就足以成为传播内容。",
      "它非常适合英语和西语双语运营。",
      "在这场比赛里，球迷身份认同往往比单纯比分更能带动传播。"
    ]
  },
  es: {
    "arg-bra": [
      "Ambas hinchadas convierten cualquier sede neutral en una localía en cuestión de minutos.",
      "Esta rivalidad suele explicarse como estructura contra improvisación.",
      "La cultura pública alrededor de este duelo viaja especialmente bien en mercados hispanohablantes y lusófonos."
    ],
    "esp-fra": [
      "Este cruce es ideal para contar fútbol desde la táctica y los detalles.",
      "Rinde muy bien con audiencias que prefieren análisis por encima de la reacción inmediata.",
      "Las marcas pueden posicionarlo como elegancia contra eficiencia."
    ],
    "mex-usa": [
      "La atmósfera alrededor de este duelo ya funciona como producto para comunidades de fans.",
      "Es una oportunidad muy fuerte para campañas bilingües en inglés y español.",
      "La identidad del aficionado suele ser el mejor disparador de conversión en este partido."
    ]
  },
  id: {
    "arg-bra": [
      "Kedua basis suporter bisa mengubah venue netral menjadi terasa seperti kandang dalam hitungan menit.",
      "Rivalitas ini sering dibaca sebagai struktur melawan improvisasi.",
      "Budaya publik di sekitar laga ini sangat kuat untuk pasar berbahasa Spanyol dan Portugis."
    ],
    "esp-fra": [
      "Laga ini sangat cocok untuk storytelling taktik dan konten analisis.",
      "Performanya kuat di audiens yang suka pembahasan cerdas, bukan sekadar reaksi.",
      "Brand bisa membingkainya sebagai elegansi melawan efisiensi."
    ],
    "mex-usa": [
      "Atmosfer di sekitar duel ini sendiri sudah menjadi produk bagi komunitas fans.",
      "Ini sangat ideal untuk kampanye bilingual Inggris-Spanyol.",
      "Identitas suporter biasanya menjadi pemicu konversi terkuat dalam laga ini."
    ]
  }
};

const languageBundles = {
  zh: {
    label: "中文",
    sceneNames: {
      pre_match: "赛前预热",
      live: "赛中互动",
      post_match: "赛后复盘"
    },
    build(match, supportTeam, scene, includeFun) {
      const opposition = supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
      const funLine = includeFun ? ` 趣味点：${match.facts[0]}` : "";

      if (scene === "live") {
        return {
          headline: `${supportTeam} 球迷，现在就是情绪最高点`,
          socialPost: `${supportTeam} 正在和 ${opposition} 进入最关键的拉扯阶段。现在最适合发起投票、带动评论区和球迷站队讨论。${funLine}`,
          videoScript: `${supportTeam} 在提速，${opposition} 在试图稳住节奏，接下来的几分钟很可能直接改写整场比赛的气氛。`,
          recap: `${supportTeam} 在关键阶段把情绪和讨论度都拉了起来，适合继续做实时互动内容。`,
          chant: `${supportTeam} 顶住现在，把声音拉满。`,
          pollQuestion: `${supportTeam} 对阵 ${opposition}，现在最能代表比赛气氛的是什么？`,
          pollOptions: ["进攻压迫", "中场博弈", "防守韧性", "最后时刻剧情"],
          hashtags: [match.tags[0], `#${supportTeam.replace(/\s+/g, "")}`, "#世界杯互动", "#实时讨论"]
        };
      }

      if (scene === "post_match") {
        return {
          headline: `${supportTeam} 用比赛内容留下了明确态度`,
          socialPost: `${supportTeam} 用比赛气质、执行力和关键瞬间，把这场对决的赛后讨论牢牢抓在自己手里。${opposition} 也制造了压力，但叙事重心仍然偏向 ${supportTeam}。${funLine}`,
          videoScript: `终场哨响之后，一个判断已经很清楚：${supportTeam} 不只是踢完了一场比赛，而是交出了一次有辨识度的世界杯表达。`,
          recap: `${supportTeam} 给这场比赛留下了清晰的复盘角度，适合做战术、情绪和社区三条内容线。`,
          chant: `${supportTeam} 带着气势上场，也带着记忆点离场。`,
          pollQuestion: `${supportTeam} 对阵 ${opposition}，赛后最值得记住的是什么？`,
          pollOptions: ["情绪张力", "战术调整", "关键个人瞬间", "球迷氛围"],
          hashtags: [match.tags[0], "#赛后复盘", "#足球内容", `#${supportTeam.replace(/\s+/g, "")}`]
        };
      }

      return {
        headline: `${supportTeam} 已经把赛前氛围拉起来了`,
        socialPost: `今晚的关键词是自豪感、节奏和世界杯情绪。${supportTeam} 对阵 ${opposition} 的这场比赛，在开球前就已经具备全球传播话题。${funLine}`,
        videoScript: `强强对话、全球关注、球迷情绪到位。${supportTeam} 带着信念登场，${opposition} 带着传统回应，这是一场非常适合做传播和互动的比赛。`,
        recap: `${supportTeam} 在赛前阶段已经具备了很强的内容叙事，适合创作者、球迷社区和品牌账号快速切入。`,
        chant: `${supportTeam} 今晚一起，把气氛拉满。`,
        pollQuestion: `${supportTeam} 对阵 ${opposition}，赛前最强的话题线是什么？`,
        pollOptions: ["进攻对控制", "战术纪律", "球星聚焦", "球场氛围"],
        hashtags: [match.tags[0], "#赛前预热", "#通往决赛", `#${supportTeam.replace(/\s+/g, "")}`]
      };
    }
  },
  en: {
    label: "English",
    sceneNames: {
      pre_match: "pre-match hype",
      live: "live interaction",
      post_match: "post-match recap"
    },
    build(match, supportTeam, scene, includeFun) {
      const opposition = supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
      const funLine = includeFun ? ` Fun angle: ${match.facts[0]}` : "";

      if (scene === "live") {
        return {
          headline: `${supportTeam} fans, every touch matters now`,
          socialPost: `${supportTeam} are in the pressure zone against ${opposition}. This is the moment to flood the timeline with belief, noise, and bold predictions.${funLine}`,
          videoScript: `${supportTeam} are pushing the tempo, ${opposition} are trying to reset the rhythm, and the next five minutes could change the whole mood of this match.`,
          recap: `${supportTeam} stayed emotionally present and kept the conversation alive every time the game tilted.`,
          chant: `${supportTeam} on the rise, hold the line tonight.`,
          pollQuestion: `What defines the live mood of ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "Fast attacking momentum",
            "Midfield chess match",
            "Defensive resilience",
            "Late drama loading"
          ],
          hashtags: [match.tags[0], `#${supportTeam.replace(/\s+/g, "")}`, "#LiveFootball", "#FanReaction"]
        };
      }

      if (scene === "post_match") {
        return {
          headline: `${supportTeam} leave a statement after the whistle`,
          socialPost: `${supportTeam} turned this matchup with personality, discipline, and moments that fans will replay for days. ${opposition} forced big questions, but the emotional edge stayed with ${supportTeam}.${funLine}`,
          videoScript: `Final whistle, big noise, and one clear takeaway: ${supportTeam} gave their supporters a performance with identity. This was more than a result, it was a message.`,
          recap: `${supportTeam} gave the game a clear shape, matched the pressure, and made the post-match conversation about intent instead of luck.`,
          chant: `${supportTeam} walked in ready and walked out remembered.`,
          pollQuestion: `What will fans remember most from ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "The emotional momentum",
            "A tactical adjustment",
            "One iconic individual moment",
            "The crowd connection"
          ],
          hashtags: [match.tags[0], "#PostMatch", "#FootballCulture", `#${supportTeam.replace(/\s+/g, "")}`]
        };
      }

      return {
        headline: `${supportTeam} are ready to own the buildup`,
        socialPost: `Tonight is about pride, tempo, and tournament energy. ${supportTeam} meet ${opposition} with a story that already feels global, and the fan conversation starts before kickoff.${funLine}`,
        videoScript: `Big rivalry, global audience, and a fanbase ready to travel through every moment. ${supportTeam} step in with belief, ${opposition} answer with legacy, and this is built for noise.`,
        recap: `${supportTeam} enter with a strong emotional angle and a clean storyline for creators, fan pages, and brand activations.`,
        chant: `${supportTeam} all in, all night, all noise.`,
        pollQuestion: `Which storyline is strongest before ${supportTeam} vs ${opposition}?`,
        pollOptions: [
          "Attack versus control",
          "Tactical discipline",
          "Star player spotlight",
          "Hostile atmosphere factor"
        ],
        hashtags: [match.tags[0], "#PreMatch", "#RoadToTheFinal", `#${supportTeam.replace(/\s+/g, "")}`]
      };
    }
  },
  es: {
    label: "Español",
    sceneNames: {
      pre_match: "previa del partido",
      live: "interacción en vivo",
      post_match: "resumen postpartido"
    },
    build(match, supportTeam, scene, includeFun) {
      const opposition = supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
      const funLine = includeFun ? ` Dato para compartir: ${match.facts[0]}` : "";

      if (scene === "live") {
        return {
          headline: `${supportTeam} vive su momento más intenso`,
          socialPost: `${supportTeam} entra en la zona de máxima presión contra ${opposition}. Es el momento ideal para activar a la afición y llenar la conversación de energía.${funLine}`,
          videoScript: `${supportTeam} acelera, ${opposition} intenta ordenar el partido, y los próximos minutos pueden cambiar por completo el tono del encuentro.`,
          recap: `${supportTeam} sostuvo la emoción y mantuvo viva la conversación cada vez que el partido cambió de ritmo.`,
          chant: `${supportTeam}, arriba ahora, no sueltes la noche.`,
          pollQuestion: `¿Qué define el ambiente en vivo de ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "Ataque con impulso",
            "Batalla en el medio",
            "Resistencia defensiva",
            "Drama final"
          ],
          hashtags: [match.tags[0], `#${supportTeam.replace(/\s+/g, "")}`, "#EnVivo", "#ReaccionDeLaAficion"]
        };
      }

      if (scene === "post_match") {
        return {
          headline: `${supportTeam} deja huella tras el silbatazo final`,
          socialPost: `${supportTeam} resolvió este partido con personalidad, orden y momentos que la afición va a repetir durante días. ${opposition} exigió muchísimo, pero el pulso emocional quedó del lado de ${supportTeam}.${funLine}`,
          videoScript: `Se terminó el partido y queda una idea clara: ${supportTeam} jugó con identidad. Más que un resultado, fue una declaración competitiva.`,
          recap: `${supportTeam} dio forma al partido, respondió a la presión y dejó una narrativa postpartido mucho más fuerte que cualquier lectura superficial.`,
          chant: `${supportTeam} salió a competir y salió para quedarse en la memoria.`,
          pollQuestion: `¿Qué recordará más la afición de ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "La emoción del partido",
            "El ajuste táctico",
            "Un momento individual icónico",
            "La conexión con la grada"
          ],
          hashtags: [match.tags[0], "#PostPartido", "#CulturaFutbolera", `#${supportTeam.replace(/\s+/g, "")}`]
        };
      }

      return {
        headline: `${supportTeam} ya domina la previa`,
        socialPost: `Esta noche se juega con orgullo, ritmo y energía mundialista. ${supportTeam} enfrenta a ${opposition} con una historia lista para explotar en redes incluso antes del inicio.${funLine}`,
        videoScript: `Gran rivalidad, audiencia global y una afición lista para vivir cada segundo. ${supportTeam} llega con convicción, ${opposition} con historia, y el contexto es perfecto para generar conversación.`,
        recap: `${supportTeam} llega con una narrativa clara y muy útil para creadores, comunidades y marcas.`,
        chant: `${supportTeam}, con todo, toda la noche.`,
        pollQuestion: `¿Qué narrativa pesa más antes de ${supportTeam} vs ${opposition}?`,
        pollOptions: [
          "Ataque contra control",
          "Disciplina táctica",
          "Figura estelar",
          "Factor ambiente"
        ],
        hashtags: [match.tags[0], "#Previa", "#CaminoALaFinal", `#${supportTeam.replace(/\s+/g, "")}`]
      };
    }
  },
  id: {
    label: "Bahasa Indonesia",
    sceneNames: {
      pre_match: "pemanasan sebelum laga",
      live: "interaksi langsung",
      post_match: "ringkasan setelah laga"
    },
    build(match, supportTeam, scene, includeFun) {
      const opposition = supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
      const funLine = includeFun ? ` Fakta seru: ${match.facts[0]}` : "";

      if (scene === "live") {
        return {
          headline: `Suporter ${supportTeam}, sekarang momen penentunya`,
          socialPost: `${supportTeam} sedang masuk fase paling menegangkan melawan ${opposition}. Saatnya dorong percakapan, voting, dan dukungan real-time.${funLine}`,
          videoScript: `${supportTeam} menaikkan tempo, ${opposition} mencoba menenangkan ritme, dan lima menit berikutnya bisa mengubah seluruh suasana pertandingan.`,
          recap: `${supportTeam} tetap menjaga emosi pertandingan dan membuat percakapan fans terus hidup di setiap momentum.`,
          chant: `${supportTeam} naik terus, tahan malam ini.`,
          pollQuestion: `Apa yang paling menentukan mood laga ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "Serangan cepat",
            "Duel lini tengah",
            "Pertahanan disiplin",
            "Drama akhir laga"
          ],
          hashtags: [match.tags[0], `#${supportTeam.replace(/\s+/g, "")}`, "#LiveMatch", "#SuaraFans"]
        };
      }

      if (scene === "post_match") {
        return {
          headline: `${supportTeam} meninggalkan kesan kuat setelah laga`,
          socialPost: `${supportTeam} membawa pertandingan ini dengan karakter, disiplin, dan momen yang akan terus diputar ulang oleh fans. ${opposition} memberi tekanan besar, tapi narasi emosional tetap milik ${supportTeam}.${funLine}`,
          videoScript: `Peluit akhir berbunyi dan satu hal terlihat jelas: ${supportTeam} tampil dengan identitas. Ini bukan sekadar hasil, ini adalah pernyataan.`,
          recap: `${supportTeam} membentuk arah pertandingan, menjawab tekanan, dan membuat pembahasan setelah laga terasa lebih besar dari sekadar angka.`,
          chant: `${supportTeam} datang siap, pulang dikenang.`,
          pollQuestion: `Apa yang paling diingat fans dari ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "Momentum emosional",
            "Perubahan taktik",
            "Momen individu ikonik",
            "Koneksi dengan penonton"
          ],
          hashtags: [match.tags[0], "#AfterMatch", "#BudayaBola", `#${supportTeam.replace(/\s+/g, "")}`]
        };
      }

      return {
        headline: `${supportTeam} siap menguasai suasana sebelum kickoff`,
        socialPost: `Malam ini adalah soal harga diri, tempo, dan energi turnamen. ${supportTeam} menghadapi ${opposition} dalam laga yang sudah terasa global bahkan sebelum mulai.${funLine}`,
        videoScript: `Rivalitas besar, penonton global, dan basis fans yang siap hidup di setiap momen. ${supportTeam} datang dengan keyakinan, ${opposition} menjawab dengan warisan, dan semuanya siap ramai.`,
        recap: `${supportTeam} masuk dengan cerita yang kuat dan cocok untuk kreator, komunitas fans, dan aktivasi brand.`,
        chant: `${supportTeam} penuh suara, penuh tenaga, sepanjang malam.`,
        pollQuestion: `Narasi apa yang paling kuat sebelum ${supportTeam} vs ${opposition}?`,
        pollOptions: [
          "Serangan lawan kontrol",
          "Disiplin taktik",
          "Sorotan pemain bintang",
          "Faktor atmosfer"
        ],
        hashtags: [match.tags[0], "#PreMatch", "#RoadToFinal", `#${supportTeam.replace(/\s+/g, "")}`]
      };
    }
  }
};

function hasRemoteLlm() {
  return Boolean(CONFIG.llm.apiUrl && CONFIG.llm.model && CONFIG.llm.apiKey);
}

function hasRemoteMatchData() {
  return Boolean(CONFIG.matchData.apiUrl);
}

function buildAuthHeaders(config) {
  const headers = {
    Accept: "application/json"
  };

  if (!config.apiKey) {
    return headers;
  }

  const headerName = config.authHeader || "Authorization";
  const prefix = config.authPrefix ? `${config.authPrefix} ` : "";
  headers[headerName] = `${prefix}${config.apiKey}`.trim();
  return headers;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeEnum(value, allowed, fallback) {
  const clean = sanitizeText(value);
  return allowed.includes(clean) ? clean : fallback;
}

function sanitizeHashtags(value, fallback = []) {
  const tags = Array.isArray(value)
    ? value
        .map((entry) => sanitizeText(entry))
        .filter(Boolean)
        .map((entry) => (entry.startsWith("#") ? entry : `#${entry.replace(/\s+/g, "")}`))
        .slice(0, 6)
    : [];
  return tags.length ? tags : fallback;
}

function normalizeCampaignContent(raw, fallback = {}) {
  return {
    headline: sanitizeText(raw.headline).slice(0, 180) || fallback.headline || "",
    socialPost: sanitizeText(raw.socialPost).slice(0, 900) || fallback.socialPost || "",
    videoScript: sanitizeText(raw.videoScript).slice(0, 700) || fallback.videoScript || "",
    recap: sanitizeText(raw.recap).slice(0, 700) || fallback.recap || "",
    chant: sanitizeText(raw.chant).slice(0, 220) || fallback.chant || "",
    hashtags: sanitizeHashtags(raw.hashtags, fallback.hashtags || [])
  };
}

function nextCampaignId() {
  const id = `cmp-${String(campaignSequence).padStart(4, "0")}`;
  campaignSequence += 1;
  return id;
}

function nextActivityId() {
  const id = `act-${String(activitySequence).padStart(5, "0")}`;
  activitySequence += 1;
  return id;
}

function toStringList(value) {
  return Array.isArray(value)
    ? value
        .map((entry) => sanitizeText(entry))
        .filter(Boolean)
    : [];
}

function buildDefaultStoryline(homeTeam, awayTeam, stage) {
  return `${homeTeam} vs ${awayTeam} is positioned as a ${stage.toLowerCase()} story built for global football audiences.`;
}

function compactHashtag(value) {
  return `#${String(value || "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 24)}`;
}

function normalizeKickoff(value, fallback = new Date().toISOString()) {
  const raw = sanitizeText(value);
  if (!raw) {
    return fallback;
  }

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  return `${raw}Z`;
}

function buildGenericFacts(match, leagueLabel) {
  return [
    `${leagueLabel} · ${match.stage}.`,
    `${match.city} is the current host context for ${match.homeTeam} vs ${match.awayTeam}.`,
    `${match.homeTeam} and ${match.awayTeam} are useful for cross-market football storytelling and engagement.`
  ];
}

function buildGenericHotTakes(match) {
  return [
    `${match.homeTeam} vs ${match.awayTeam} should be framed around momentum, emotion, and matchday participation.`,
    `This fixture can support creator clips, fan polls, and sponsor storytelling in one workflow.`,
    `The strongest operator angle is to connect pre-match buildup with a live interaction layer.`
  ];
}

function normalizeMatchInput(raw) {
  const homeTeam = sanitizeText(raw.homeTeam || raw.strHomeTeam);
  const awayTeam = sanitizeText(raw.awayTeam || raw.strAwayTeam);

  if (!homeTeam || !awayTeam) {
    return null;
  }

  const stage = sanitizeText(raw.stage || raw.strLeague || raw.competition || "Featured Match");
  const city =
    sanitizeText(raw.city || raw.strVenue || raw.venue || raw.strCountry || "TBD");
  const id =
    sanitizeText(raw.id || raw.idEvent || raw.matchId) ||
    `custom-${slugify(`${homeTeam}-${awayTeam}-${raw.dateEvent || raw.kickOff || stage}`)}`;

  const match = {
    id,
    homeTeam,
    awayTeam,
    kickOff: normalizeKickoff(raw.kickOff || raw.strTimestamp || `${raw.dateEvent || ""}T${raw.strTime || "00:00:00"}`),
    city,
    stage,
    storyline:
      sanitizeText(raw.storyline || raw.strStoryline) || buildDefaultStoryline(homeTeam, awayTeam, stage),
    facts: toStringList(raw.facts).length > 0 ? toStringList(raw.facts) : buildGenericFacts({ homeTeam, awayTeam, city, stage }, stage),
    tags:
      toStringList(raw.tags).length > 0
        ? toStringList(raw.tags)
        : ["#MatchBuzz", compactHashtag(homeTeam), compactHashtag(awayTeam), compactHashtag(stage)],
    hotTakes: toStringList(raw.hotTakes).length > 0 ? toStringList(raw.hotTakes) : buildGenericHotTakes({ homeTeam, awayTeam })
  };

  if (raw.leagueId || raw.idLeague) {
    match.leagueId = sanitizeText(raw.leagueId || raw.idLeague);
  }
  if (raw.league || raw.strLeague) {
    match.league = sanitizeText(raw.league || raw.strLeague);
  }
  if (raw.season || raw.strSeason) {
    match.season = sanitizeText(raw.season || raw.strSeason);
  }
  if (raw.round || raw.intRound) {
    match.round = sanitizeText(raw.round || raw.intRound);
  }
  if (raw.homeBadge || raw.strHomeTeamBadge) {
    match.homeBadge = sanitizeText(raw.homeBadge || raw.strHomeTeamBadge);
  }
  if (raw.awayBadge || raw.strAwayTeamBadge) {
    match.awayBadge = sanitizeText(raw.awayBadge || raw.strAwayTeamBadge);
  }
  if (raw.leagueBadge || raw.strLeagueBadge) {
    match.leagueBadge = sanitizeText(raw.leagueBadge || raw.strLeagueBadge);
  }
  if (raw.poster || raw.strPoster) {
    match.poster = sanitizeText(raw.poster || raw.strPoster);
  }
  if (raw.banner || raw.strBanner) {
    match.banner = sanitizeText(raw.banner || raw.strBanner);
  }
  if (raw.thumb || raw.strThumb) {
    match.thumb = sanitizeText(raw.thumb || raw.strThumb);
  }
  if (raw.status || raw.strStatus) {
    match.status = sanitizeText(raw.status || raw.strStatus);
  }
  if (raw.homeScore !== undefined || raw.intHomeScore !== undefined) {
    match.homeScore = raw.homeScore ?? raw.intHomeScore ?? null;
  }
  if (raw.awayScore !== undefined || raw.intAwayScore !== undefined) {
    match.awayScore = raw.awayScore ?? raw.intAwayScore ?? null;
  }
  if (raw.venueId || raw.idVenue) {
    match.venueId = sanitizeText(raw.venueId || raw.idVenue);
  }
  if (raw.homeTeamId || raw.idHomeTeam) {
    match.homeTeamId = sanitizeText(raw.homeTeamId || raw.idHomeTeam);
  }
  if (raw.awayTeamId || raw.idAwayTeam) {
    match.awayTeamId = sanitizeText(raw.awayTeamId || raw.idAwayTeam);
  }
  if (raw.country || raw.strCountry) {
    match.country = sanitizeText(raw.country || raw.strCountry);
  }

  return ensureSupportPoll(match);
}

function buildRealFixtureStoryline(event) {
  const stage = `${event.strLeague || "League football"} round ${event.intRound || "TBD"}`;
  return `${event.strHomeTeam} vs ${event.strAwayTeam} arrives as a ${stage} story built for live football audiences and creator distribution.`;
}

function normalizeRealFixture(raw) {
  const match = normalizeMatchInput({
    id: `real-${sanitizeText(raw.idEvent)}`,
    homeTeam: raw.strHomeTeam,
    awayTeam: raw.strAwayTeam,
    kickOff: raw.strTimestamp || `${raw.dateEvent || ""}T${raw.strTime || "00:00:00"}`,
    city: raw.strVenue || raw.strCountry || "TBD",
    stage: `${raw.strLeague || "League"} · Round ${sanitizeText(raw.intRound || "TBD")}`,
    storyline: buildRealFixtureStoryline(raw),
    facts: [
      `${raw.strLeague || "League football"} in season ${raw.strSeason || CONFIG.realFixtures.season}.`,
      `${raw.strVenue || "Venue TBD"} hosts this fixture${raw.strCountry ? ` in ${raw.strCountry}` : ""}.`,
      raw.strStatus === "Match Finished"
        ? `The latest recorded score is ${raw.strHomeTeam} ${raw.intHomeScore ?? 0} - ${raw.intAwayScore ?? 0} ${raw.strAwayTeam}.`
        : `${raw.strHomeTeam} and ${raw.strAwayTeam} are scheduled for an upcoming kickoff.`
    ],
    tags: [
      "#RealFootballFeed",
      compactHashtag(raw.strHomeTeam),
      compactHashtag(raw.strAwayTeam),
      compactHashtag(raw.strLeague || "Football")
    ],
    hotTakes: [
      `${raw.strHomeTeam} vs ${raw.strAwayTeam} is a useful live test case for multi-market football content ops.`,
      `This fixture can support pre-match, live, and post-match publishing in one workflow.`,
      `The operator opportunity is to turn the match page into a localized distribution engine.`
    ],
    leagueId: raw.idLeague,
    league: raw.strLeague,
    season: raw.strSeason,
    round: raw.intRound,
    homeBadge: raw.strHomeTeamBadge,
    awayBadge: raw.strAwayTeamBadge,
    leagueBadge: raw.strLeagueBadge,
    poster: raw.strPoster,
    banner: raw.strBanner,
    thumb: raw.strThumb,
    status: raw.strStatus,
    homeScore: raw.intHomeScore,
    awayScore: raw.intAwayScore,
    venueId: raw.idVenue,
    homeTeamId: raw.idHomeTeam,
    awayTeamId: raw.idAwayTeam,
    country: raw.strCountry
  });

  return match;
}

function getRealFixtureId(value) {
  return sanitizeText(value).replace(/^real-/, "");
}

async function fetchRealFixturesFeed(scope) {
  const cacheKey = scope === "recent" ? "recent" : "upcoming";
  const endpoint =
    cacheKey === "recent"
      ? `eventspastleague.php?id=${CONFIG.realFixtures.leagueId}`
      : `eventsnextleague.php?id=${CONFIG.realFixtures.leagueId}`;

  const cache = realFixturesCache[cacheKey];
  if (cache.items && cache.expiresAt > Date.now()) {
    return cache.items;
  }

  const response = await fetch(`${CONFIG.realFixtures.baseUrl}/${endpoint}`);
  if (!response.ok) {
    throw new Error(`Real fixtures provider returned ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload.events) ? payload.events.map(normalizeRealFixture).filter(Boolean) : [];
  cache.items = items;
  cache.expiresAt = Date.now() + CONFIG.realFixtures.cacheMs;
  return items;
}

async function fetchRealFixturesTable() {
  if (realFixturesCache.table.items && realFixturesCache.table.expiresAt > Date.now()) {
    return realFixturesCache.table.items;
  }

  const response = await fetch(
    `${CONFIG.realFixtures.baseUrl}/lookuptable.php?l=${CONFIG.realFixtures.leagueId}&s=${CONFIG.realFixtures.season}`
  );
  if (!response.ok) {
    throw new Error(`Real table provider returned ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload.table)
    ? payload.table.map((entry) => ({
        rank: Number(entry.intRank || 0),
        teamId: sanitizeText(entry.idTeam),
        team: sanitizeText(entry.strTeam),
        badge: sanitizeText(entry.strBadge),
        played: Number(entry.intPlayed || 0),
        win: Number(entry.intWin || 0),
        draw: Number(entry.intDraw || 0),
        loss: Number(entry.intLoss || 0),
        goalsFor: Number(entry.intGoalsFor || 0),
        goalsAgainst: Number(entry.intGoalsAgainst || 0),
        goalDifference: Number(entry.intGoalDifference || 0),
        points: Number(entry.intPoints || 0),
        form: sanitizeText(entry.strForm),
        description: sanitizeText(entry.strDescription)
      }))
    : [];

  realFixturesCache.table.items = items;
  realFixturesCache.table.expiresAt = Date.now() + CONFIG.realFixtures.cacheMs;
  return items;
}

async function getRealFixtureDetail(matchId) {
  const rawId = getRealFixtureId(matchId);
  const [upcoming, recent] = await Promise.all([fetchRealFixturesFeed("upcoming"), fetchRealFixturesFeed("recent")]);
  const cached = upcoming.concat(recent).find((item) => getRealFixtureId(item.id) === rawId);
  let table = [];

  try {
    table = await fetchRealFixturesTable();
  } catch (error) {
    table = [];
  }

  if (cached) {
    return {
      fixture: cached,
      table: table.slice(0, 6),
      upcoming: upcoming.filter((item) => item.id !== cached.id).slice(0, 4),
      recent: recent.filter((item) => item.id !== cached.id).slice(0, 4)
    };
  }

  const response = await fetch(`${CONFIG.realFixtures.baseUrl}/lookupevent.php?id=${rawId}`);
  if (!response.ok) {
    throw new Error(`Real event provider returned ${response.status}`);
  }

  const payload = await response.json();
  const item = Array.isArray(payload.events) && payload.events[0] ? normalizeRealFixture(payload.events[0]) : null;
  if (!item) {
    throw new Error("Real event provider returned no usable event");
  }

  return {
    fixture: item,
    table: table.slice(0, 6),
    upcoming: upcoming.filter((entry) => entry.id !== item.id).slice(0, 4),
    recent: recent.filter((entry) => entry.id !== item.id).slice(0, 4)
  };
}

function decodeXmlEntities(value) {
  return String(value || "").replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (!entity) {
      return match;
    }

    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    const map = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'"
    };
    return map[entity] || match;
  });
}

function stripXmlTags(value) {
  return decodeXmlEntities(
    String(value || "")
      .replace(/^<!\[CDATA\[/, "")
      .replace(/\]\]>$/, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractXmlTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? match[1] : "";
}

function extractNewsImage(block, description) {
  const mediaImage =
    block.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] ||
    block.match(/<media:content[^>]*url="([^"]+)"/i)?.[1] ||
    description.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
    "";

  return sanitizeText(mediaImage);
}

function normalizeFootballNewsItem(block, index) {
  const title = stripXmlTags(extractXmlTag(block, "title"));
  const link = stripXmlTags(extractXmlTag(block, "link"));
  const descriptionRaw = extractXmlTag(block, "description");
  const summary = stripXmlTags(descriptionRaw);
  const publishedRaw = stripXmlTags(extractXmlTag(block, "pubDate"));
  const publishedAt = publishedRaw && !Number.isNaN(new Date(publishedRaw).getTime()) ? new Date(publishedRaw).toISOString() : null;
  const image = extractNewsImage(block, descriptionRaw);

  if (!title || !link) {
    return null;
  }

  return {
    id: `news-${index + 1}`,
    title,
    link,
    summary: summary && summary !== title ? summary : "Open the original report for the latest football update.",
    image: image || null,
    publishedAt,
    source: "BBC Sport"
  };
}

function getStaticFootballNewsFallback(limit = 6) {
  return STATIC_FOOTBALL_NEWS_FALLBACK.slice(0, Math.max(1, Number(limit || 6))).map((item) => ({ ...item }));
}

async function fetchFootballNews(limit = 6) {
  const normalizedLimit = Math.max(3, Math.min(8, Number(limit || 6)));

  if (footballNewsCache.items.length && footballNewsCache.expiresAt > Date.now()) {
    return {
      provider: footballNewsCache.provider,
      fetchedAt: footballNewsCache.fetchedAt,
      items: footballNewsCache.items.slice(0, normalizedLimit),
      mode: "live-cache"
    };
  }

  try {
    const response = await fetch(FOOTBALL_NEWS_FEED_URL, {
      headers: {
        "User-Agent": "MatchBuzz/1.0 (+football homepage news feed)"
      }
    });
    if (!response.ok) {
      throw new Error(`Football news feed returned ${response.status}`);
    }

    const xml = await response.text();
    const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
    const items = itemBlocks.map(normalizeFootballNewsItem).filter(Boolean).slice(0, normalizedLimit);

    if (!items.length) {
      throw new Error("Football news feed returned no usable items");
    }

    footballNewsCache.items = items;
    footballNewsCache.fetchedAt = new Date().toISOString();
    footballNewsCache.expiresAt = Date.now() + 10 * 60 * 1000;

    return {
      provider: footballNewsCache.provider,
      fetchedAt: footballNewsCache.fetchedAt,
      items,
      mode: "live"
    };
  } catch (error) {
    const fallbackItems = footballNewsCache.items.length
      ? footballNewsCache.items.slice(0, normalizedLimit)
      : getStaticFootballNewsFallback(normalizedLimit);

    return {
      provider: footballNewsCache.items.length ? footballNewsCache.provider : "ESPN football links",
      fetchedAt: footballNewsCache.fetchedAt,
      items: fallbackItems,
      mode: footballNewsCache.items.length ? "cache-fallback" : "fallback-static"
    };
  }
}

async function resolveMatchPayload(payload) {
  const localMatch = payload.matchId ? await getMatch(payload.matchId) : null;
  if (localMatch) {
    return localMatch;
  }

  if (payload.match) {
    return normalizeMatchInput(payload.match);
  }

  return null;
}

function buildQueueWindow(match, scene) {
  const kickOff = new Date(match.kickOff);
  if (Number.isNaN(kickOff.getTime())) {
    return null;
  }

  const offsets = {
    pre_match: -75,
    live: 12,
    post_match: 105
  };
  const offsetMinutes = offsets[scene] ?? -75;
  return new Date(kickOff.getTime() + offsetMinutes * 60_000).toISOString();
}

function buildCampaignWorkflow(campaign) {
  const reviewed = Boolean(campaign.reviewedAt);
  const queued = Boolean(campaign.queuedAt);

  return [
    { key: "inputs_locked", state: "done" },
    { key: "content_generated", state: "done" },
    { key: "editor_review", state: reviewed ? "done" : "active" },
    { key: "publish_queue", state: queued ? "done" : reviewed ? "active" : "pending" }
  ];
}

function appendCampaignActivity(campaign, code, meta = {}) {
  const entry = {
    id: nextActivityId(),
    code,
    meta,
    createdAt: new Date().toISOString()
  };
  campaign.activity.unshift(entry);
  campaign.updatedAt = entry.createdAt;
  return entry;
}

function serializeCampaign(campaign) {
  return {
    id: campaign.id,
    matchId: campaign.match.id,
    match: {
      id: campaign.match.id,
      homeTeam: campaign.match.homeTeam,
      awayTeam: campaign.match.awayTeam,
      kickOff: campaign.match.kickOff,
      city: campaign.match.city,
      stage: campaign.match.stage
    },
    supportTeam: campaign.supportTeam,
    language: campaign.language,
    languageLabel: campaign.languageLabel,
    scene: campaign.scene,
    targetMarket: campaign.targetMarket,
    channel: campaign.channel,
    angle: campaign.angle,
    includeFun: campaign.includeFun,
    generationSource: campaign.generationSource,
    generatedPollId: campaign.generatedPollId || null,
    status: campaign.status,
    queueWindow: campaign.queueWindow,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    reviewedAt: campaign.reviewedAt,
    queuedAt: campaign.queuedAt,
    exportedAt: campaign.exportedAt,
    workflow: buildCampaignWorkflow(campaign),
    content: {
      ...campaign.content,
      hashtags: [...campaign.content.hashtags]
    },
    funFacts: [...campaign.funFacts],
    trending: [...campaign.trending],
    hotTakes: [...campaign.hotTakes],
    activity: campaign.activity.map((entry) => ({
      ...entry,
      meta: { ...entry.meta }
    }))
  };
}

function serializeCampaignSummary(campaign) {
  return {
    id: campaign.id,
    matchId: campaign.match.id,
    matchLabel: `${campaign.match.homeTeam} vs ${campaign.match.awayTeam}`,
    supportTeam: campaign.supportTeam,
    language: campaign.language,
    scene: campaign.scene,
    targetMarket: campaign.targetMarket,
    channel: campaign.channel,
    angle: campaign.angle,
    status: campaign.status,
    generationSource: campaign.generationSource,
    queueWindow: campaign.queueWindow,
    updatedAt: campaign.updatedAt
  };
}

function listCampaignSummaries() {
  return Array.from(campaigns.values())
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .map(serializeCampaignSummary);
}

function cloneValue(value) {
  return structuredClone(value);
}

function parseStoredJson(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function syncCampaignSequenceFromId(id) {
  const match = /^cmp-(\d+)$/.exec(String(id || ""));
  if (match) {
    campaignSequence = Math.max(campaignSequence, Number(match[1]) + 1);
  }
}

function syncActivitySequenceFromCampaign(campaign) {
  (campaign.activity || []).forEach((entry) => {
    const match = /^act-(\d+)$/.exec(String(entry.id || ""));
    if (match) {
      activitySequence = Math.max(activitySequence, Number(match[1]) + 1);
    }
  });
}

function persistPoll(poll) {
  if (!db || !poll?.id) {
    return;
  }

  db.prepare(
    `
      INSERT INTO polls (id, match_id, created_at, payload_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        match_id = excluded.match_id,
        created_at = excluded.created_at,
        payload_json = excluded.payload_json
    `
  ).run(poll.id, poll.matchId || null, poll.createdAt || new Date().toISOString(), JSON.stringify(poll));
}

function persistCampaign(campaign) {
  if (!db || !campaign?.id) {
    return;
  }

  db.prepare(
    `
      INSERT INTO campaigns (id, status, updated_at, payload_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at,
        payload_json = excluded.payload_json
    `
  ).run(campaign.id, campaign.status || "draft", campaign.updatedAt || new Date().toISOString(), JSON.stringify(campaign));
}

function persistCommunityRoom(room) {
  if (!db || !room?.id) {
    return;
  }

  db.prepare(
    `
      INSERT INTO community_rooms (id, market, status, member_count, updated_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        market = excluded.market,
        status = excluded.status,
        member_count = excluded.member_count,
        updated_at = excluded.updated_at,
        payload_json = excluded.payload_json
    `
  ).run(
    room.id,
    room.market || "global",
    room.status || "open",
    Number(room.memberCount || 0),
    room.updatedAt || new Date().toISOString(),
    JSON.stringify(room)
  );
}

function persistWatchParty(party) {
  if (!db || !party?.id) {
    return;
  }

  db.prepare(
    `
      INSERT INTO watch_parties (id, fixture_id, city, start_at, seats_left, updated_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        fixture_id = excluded.fixture_id,
        city = excluded.city,
        start_at = excluded.start_at,
        seats_left = excluded.seats_left,
        updated_at = excluded.updated_at,
        payload_json = excluded.payload_json
    `
  ).run(
    party.id,
    party.fixtureId || null,
    party.city || "TBD",
    party.startAt || new Date().toISOString(),
    Number(party.seatsLeft || 0),
    party.updatedAt || new Date().toISOString(),
    JSON.stringify(party)
  );
}

function persistSponsorPackage(item) {
  if (!db || !item?.id) {
    return;
  }

  db.prepare(
    `
      INSERT INTO sponsor_packages (id, tier, sort_order, updated_at, payload_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tier = excluded.tier,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at,
        payload_json = excluded.payload_json
    `
  ).run(item.id, item.tier || "package", Number(item.sortOrder || 0), item.updatedAt || new Date().toISOString(), JSON.stringify(item));
}

function loadPollsFromStorage() {
  if (!db) {
    return;
  }

  const rows = db.prepare("SELECT payload_json FROM polls").all();
  rows.forEach((row) => {
    const poll = parseStoredJson(row.payload_json, null);
    if (poll?.id) {
      polls.set(poll.id, poll);
    }
  });
}

function loadCampaignsFromStorage() {
  if (!db) {
    return;
  }

  const rows = db.prepare("SELECT payload_json FROM campaigns").all();
  rows.forEach((row) => {
    const campaign = parseStoredJson(row.payload_json, null);
    if (campaign?.id) {
      campaigns.set(campaign.id, campaign);
      syncCampaignSequenceFromId(campaign.id);
      syncActivitySequenceFromCampaign(campaign);
    }
  });
}

function loadCommerceFromStorage() {
  if (!db) {
    return;
  }

  db.prepare("SELECT payload_json FROM community_rooms").all().forEach((row) => {
    const room = parseStoredJson(row.payload_json, null);
    if (room?.id) {
      communityRooms.set(room.id, room);
    }
  });

  db.prepare("SELECT payload_json FROM watch_parties").all().forEach((row) => {
    const party = parseStoredJson(row.payload_json, null);
    if (party?.id) {
      watchParties.set(party.id, party);
    }
  });

  db.prepare("SELECT payload_json FROM sponsor_packages").all().forEach((row) => {
    const item = parseStoredJson(row.payload_json, null);
    if (item?.id) {
      sponsorPackages.set(item.id, item);
    }
  });
}

function listRoomMembers(roomId, limit = 8) {
  if (!db) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT display_name, market, favorite_team, locale, created_at
        FROM room_members
        WHERE room_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `
    )
    .all(roomId, Number(limit))
    .map((entry) => ({
      displayName: entry.display_name,
      market: entry.market,
      favoriteTeam: entry.favorite_team,
      locale: entry.locale,
      createdAt: entry.created_at
    }));
}

function buildSeedCommunityRooms() {
  const now = new Date().toISOString();

  return [
    {
      id: "room-argentina-worldwide",
      title: "Argentina Matchday Room",
      titleZh: "阿根廷比赛日球迷房",
      description:
        "Countdown copy, lineup reactions, and fast fan prompts for global Argentina supporters before and during the match.",
      descriptionZh: "给全球阿根廷球迷准备的赛前倒计时、首发讨论和赛中互动房间。",
      market: "latam",
      status: "open",
      statusZh: "开放中",
      memberCount: 1842,
      fixtureId: "arg-bra",
      fixtureLabel: "Argentina vs Brazil",
      fixtureLabelZh: "阿根廷 vs 巴西",
      city: "Global",
      cityZh: "全球连线",
      kickoff: "2026-06-19T20:00:00Z",
      languageFocus: ["English", "Spanish"],
      languageFocusZh: ["英语", "西语"],
      chips: ["Lineup debate", "Chants", "Watch-party links"],
      chipsZh: ["首发讨论", "助威口号", "观赛活动入口"],
      coverImage:
        PLAYER_IMAGE_PROXY_PATHS.messi,
      gallery: [
        PLAYER_IMAGE_PROXY_PATHS.messi,
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg/500px-2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg"
      ],
      featuredPlayer: {
        name: "Lionel Messi",
        nameZh: "梅西",
        photo:
          PLAYER_IMAGE_PROXY_PATHS.messi,
        note: "Legacy watch, tempo control, and crowd pull for every big-stage fixture.",
        noteZh: "传奇压场、节奏控制和顶级号召力，是这个房间最强的话题中心。"
      },
      feed: [
        {
          author: "Sofia",
          role: "Host",
          roleZh: "房主",
          body: "Countdown thread is live. Drop your starting XI and the opening-line caption you would post.",
          bodyZh: "倒计时帖已开启。把你的首发名单和第一条赛前文案发出来。",
          time: "2m ago",
          timeZh: "2 分钟前"
        },
        {
          author: "Mateo",
          role: "Creator",
          roleZh: "创作者",
          body: "Messi close-up clips are outperforming generic match posters again. Use the player-first cover.",
          bodyZh: "梅西近景素材的表现又比通用海报强，封面优先用球星特写。",
          time: "8m ago",
          timeZh: "8 分钟前"
        }
      ],
      updatedAt: now
    },
    {
      id: "room-france-nextwave",
      title: "France Next Wave Room",
      titleZh: "法国新世代球迷房",
      description:
        "A fast-moving room for France supporters, youth-story angles, and short-form creator hooks built around Mbappe.",
      descriptionZh: "围绕法国队、年轻球迷情绪和姆巴佩内容角度的高活跃互动房间。",
      market: "global",
      status: "open",
      statusZh: "开放中",
      memberCount: 1294,
      fixtureId: "esp-fra",
      fixtureLabel: "Spain vs France",
      fixtureLabelZh: "西班牙 vs 法国",
      city: "Paris / Global",
      cityZh: "巴黎 / 全球",
      kickoff: "2026-06-23T18:30:00Z",
      languageFocus: ["English", "French-style tone"],
      languageFocusZh: ["英语", "法语语感"],
      chips: ["Youth stars", "Short video hooks", "Fan vote kits"],
      chipsZh: ["新星叙事", "短视频开场", "投票模板"],
      coverImage:
        PLAYER_IMAGE_PROXY_PATHS.mbappe,
      gallery: [
        PLAYER_IMAGE_PROXY_PATHS.mbappe,
        PLAYER_IMAGE_PROXY_PATHS.bellingham
      ],
      featuredPlayer: {
        name: "Kylian Mbappe",
        nameZh: "姆巴佩",
        photo:
          PLAYER_IMAGE_PROXY_PATHS.mbappe,
        note: "Fast-twitch clips, pressure moments, and the kind of face that carries a global football page.",
        noteZh: "快节奏片段、关键时刻和极强识别度，让这个房间天然适合全球传播。"
      },
      feed: [
        {
          author: "Nina",
          role: "Moderator",
          roleZh: "主持人",
          body: "Use the youth-versus-experience angle. It works better here than generic rivalry copy.",
          bodyZh: "这里更适合打“新世代对抗经验派”的角度，不要只写普通宿敌文案。",
          time: "5m ago",
          timeZh: "5 分钟前"
        },
        {
          author: "Arman",
          role: "Fan lead",
          roleZh: "球迷管理员",
          body: "Pinned a vote for best first-touch highlight. The room is reacting well to skill-first prompts.",
          bodyZh: "我置顶了“最佳第一脚触球”投票，大家对技术型互动反应很好。",
          time: "16m ago",
          timeZh: "16 分钟前"
        }
      ],
      updatedAt: now
    },
    {
      id: "room-bellingham-clubhouse",
      title: "Bellingham Clubhouse",
      titleZh: "贝林厄姆讨论俱乐部",
      description:
        "A player-first room tracking breakout star narratives, cross-market fan interest, and photo-led storylines.",
      descriptionZh: "聚焦新生代球星、跨市场球迷兴趣和图片驱动叙事的球员向社区。",
      market: "sea",
      status: "open",
      statusZh: "开放中",
      memberCount: 938,
      fixtureId: "mex-usa",
      fixtureLabel: "Global Star Watch",
      fixtureLabelZh: "全球球星观察",
      city: "Southeast Asia",
      cityZh: "东南亚球迷圈",
      kickoff: "2026-06-27T01:00:00Z",
      languageFocus: ["English", "Bahasa Indonesia"],
      languageFocusZh: ["英语", "印尼语"],
      chips: ["Player photos", "Fan edits", "Debate prompts"],
      chipsZh: ["球星照片", "球迷二创", "讨论话题"],
      coverImage:
        PLAYER_IMAGE_PROXY_PATHS.bellingham,
      gallery: [
        PLAYER_IMAGE_PROXY_PATHS.bellingham,
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg/500px-2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg"
      ],
      featuredPlayer: {
        name: "Jude Bellingham",
        nameZh: "贝林厄姆",
        photo:
          PLAYER_IMAGE_PROXY_PATHS.bellingham,
        note: "Clean portraits, next-gen star language, and debate-heavy fan energy.",
        noteZh: "高清肖像、新世代球星语言和高讨论度，是这个房间的核心氛围。"
      },
      feed: [
        {
          author: "Raka",
          role: "Community lead",
          roleZh: "社区负责人",
          body: "Player-photo posts are getting the most saves. Keep the copy sharp and shorter.",
          bodyZh: "球星照片帖的收藏最高，文案保持锋利和更短会更好。",
          time: "11m ago",
          timeZh: "11 分钟前"
        },
        {
          author: "Luna",
          role: "Editor",
          roleZh: "编辑",
          body: "Add a fan-rating prompt after every player photo update. It keeps the room moving.",
          bodyZh: "每次更新球星照片后都补一个“你打几分”的问题，社区会更活跃。",
          time: "24m ago",
          timeZh: "24 分钟前"
        }
      ],
      updatedAt: now
    }
  ];
}

function buildSeedWatchParties() {
  const now = new Date().toISOString();

  return [
    {
      id: "party-singapore-kallang",
      title: "Singapore Midnight Matchhouse",
      titleZh: "新加坡深夜观赛局",
      summary: "Late-night football screening for fans who want live chants, creator clips, and sponsor activations in one room.",
      summaryZh: "适合深夜球迷、创作者和品牌联动的一站式线下观赛活动。",
      fixtureId: "arg-bra",
      fixtureLabel: "Argentina vs Brazil",
      fixtureLabelZh: "阿根廷 vs 巴西",
      city: "Singapore",
      cityZh: "新加坡",
      venue: "Kallang Rooftop Screen",
      venueZh: "加冷屋顶大屏观赛点",
      startAt: "2026-06-19T18:30:00Z",
      partner: "East Coast Fan Collective",
      partnerZh: "东海岸球迷联盟",
      seatsTotal: 120,
      seatsLeft: 42,
      priceLabel: "USD 22",
      priceLabelZh: "22 美元",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg/500px-2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg",
      perks: ["Big-screen live feed", "Sponsor merch booth", "Post-match creator meet-up"],
      perksZh: ["大屏直播", "赞助商周边摊位", "赛后创作者交流"],
      updatedAt: now
    },
    {
      id: "party-madrid-tactics-night",
      title: "Madrid Tactics Watch Night",
      titleZh: "马德里战术观赛夜",
      summary: "A tactical screening built for analysis-led fans, recap creators, and partner-led VIP seating.",
      summaryZh: "面向分析型球迷、复盘创作者和品牌 VIP 位的战术观赛活动。",
      fixtureId: "esp-fra",
      fixtureLabel: "Spain vs France",
      fixtureLabelZh: "西班牙 vs 法国",
      city: "Madrid",
      cityZh: "马德里",
      venue: "Centro Futbol Hub",
      venueZh: "Centro Futbol 观赛空间",
      startAt: "2026-06-23T17:15:00Z",
      partner: "Tactical Creator Circle",
      partnerZh: "战术内容创作者圈",
      seatsTotal: 90,
      seatsLeft: 27,
      priceLabel: "EUR 18",
      priceLabelZh: "18 欧元",
      image:
        PLAYER_IMAGE_PROXY_PATHS.mbappe,
      perks: ["Analyst host desk", "Live poll wall", "Partner VIP fast lane"],
      perksZh: ["分析主持台", "实时投票墙", "合作方 VIP 快速入场"],
      updatedAt: now
    },
    {
      id: "party-mexico-city-fan-night",
      title: "Mexico City Fan Night",
      titleZh: "墨西哥城球迷夜",
      summary: "A loud, social watch party with chants, street-style merch, and high-conversion fan bundles.",
      summaryZh: "主打热闹氛围、助威口号和高转化周边礼包的线下观赛活动。",
      fixtureId: "mex-usa",
      fixtureLabel: "Mexico vs USA",
      fixtureLabelZh: "墨西哥 vs 美国",
      city: "Mexico City",
      cityZh: "墨西哥城",
      venue: "Roma Norte Football Yard",
      venueZh: "Roma Norte 足球院子",
      startAt: "2026-06-27T00:00:00Z",
      partner: "Local Matchday Club",
      partnerZh: "本地比赛日俱乐部",
      seatsTotal: 150,
      seatsLeft: 63,
      priceLabel: "MXN 320",
      priceLabelZh: "320 墨西哥比索",
      image:
        PLAYER_IMAGE_PROXY_PATHS.messi,
      perks: ["Chant section", "Jersey raffle", "Fan-bundle pickup desk"],
      perksZh: ["助威区", "球衣抽奖", "球迷礼包领取"],
      updatedAt: now
    }
  ];
}

function buildSeedSponsorPackages() {
  const now = new Date().toISOString();

  return [
    {
      id: "pkg-live-poll-sponsor",
      tier: "media",
      sortOrder: 1,
      name: "Live Poll Sponsor",
      nameZh: "实时投票赞助包",
      summary: "Own the support meter, live prediction card, and room takeover around one matchday spike.",
      summaryZh: "拿下比赛日高峰里的支持率模块、实时预测卡和社区 takeover。",
      priceFrom: "From USD 2,500",
      priceFromZh: "2,500 美元起",
      audience: "150k football page impressions",
      audienceZh: "15 万足球页曝光",
      surfaces: ["Match page hero slot", "Poll module branding", "Fan-room pinned card"],
      surfacesZh: ["比赛页头部位", "投票模块品牌露出", "球迷房置顶卡片"],
      outcomes: ["Brand-safe live reach", "Regional language targeting", "Sponsor recall after the whistle"],
      outcomesZh: ["品牌安全曝光", "区域语言定向", "赛后品牌记忆"],
      updatedAt: now
    },
    {
      id: "pkg-watch-guide-takeover",
      tier: "commerce",
      sortOrder: 2,
      name: "Watch Guide Takeover",
      nameZh: "观赛指南合作包",
      summary: "Pair partner venues, watch-party conversion, and matchday city discovery inside one localized guide.",
      summaryZh: "把合作场地、观赛活动转化和城市导览整合进一份本地化观赛指南。",
      priceFrom: "From USD 4,200",
      priceFromZh: "4,200 美元起",
      audience: "High-intent fans near kickoff",
      audienceZh: "临近开球的高意图球迷",
      surfaces: ["Watch-party listings", "Fixture CTA rail", "Localized venue recommendations"],
      surfacesZh: ["观赛活动列表", "赛事 CTA 栏", "本地场地推荐"],
      outcomes: ["Ticket and reservation clicks", "Local event uplift", "Sponsor-led conversion path"],
      outcomesZh: ["票务与预约点击", "线下活动增长", "赞助驱动转化链路"],
      updatedAt: now
    },
    {
      id: "pkg-creator-distribution",
      tier: "distribution",
      sortOrder: 3,
      name: "Creator Distribution Bundle",
      nameZh: "创作者分发合作包",
      summary: "Push player-led clips, post-match edits, and sponsor inserts across multiple football creator surfaces.",
      summaryZh: "把球星短片、赛后剪辑和品牌插入分发到多种足球创作者渠道。",
      priceFrom: "From USD 3,300",
      priceFromZh: "3,300 美元起",
      audience: "Creator pages in EN, ES, ID",
      audienceZh: "英语、西语、印尼语创作者页面",
      surfaces: ["Short-video templates", "Player hub placements", "Cross-market caption packs"],
      surfacesZh: ["短视频模板", "球星中心露出", "跨市场文案包"],
      outcomes: ["Fast cross-market launch", "Player-first storytelling", "Repeatable sponsor format"],
      outcomesZh: ["快速跨市场上线", "球星优先叙事", "可复用赞助模版"],
      updatedAt: now
    }
  ];
}

function seedCommerceData() {
  buildSeedCommunityRooms().forEach((room) => {
    const existing = communityRooms.get(room.id);
    const nextRoom = existing
      ? {
          ...room,
          memberCount: Number(existing.memberCount || room.memberCount || 0),
          updatedAt: existing.updatedAt || room.updatedAt
        }
      : room;
    communityRooms.set(room.id, nextRoom);
    persistCommunityRoom(nextRoom);
  });

  buildSeedWatchParties().forEach((party) => {
    const existing = watchParties.get(party.id);
    const nextParty = existing
      ? {
          ...party,
          seatsLeft: Number(existing.seatsLeft ?? party.seatsLeft ?? 0),
          updatedAt: existing.updatedAt || party.updatedAt
        }
      : party;
    watchParties.set(party.id, nextParty);
    persistWatchParty(nextParty);
  });

  buildSeedSponsorPackages().forEach((item) => {
    sponsorPackages.set(item.id, item);
    persistSponsorPackage(item);
  });
}

function serializeCommunityRoom(room) {
  return {
    ...cloneValue(room),
    recentMembers: listRoomMembers(room.id, 8)
  };
}

function listCommunityRooms() {
  return Array.from(communityRooms.values())
    .sort((left, right) => Number(right.memberCount || 0) - Number(left.memberCount || 0))
    .map(serializeCommunityRoom);
}

function listWatchPartyItems() {
  return Array.from(watchParties.values())
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
    .map((item) => cloneValue(item));
}

function listSponsorPackageItems() {
  return Array.from(sponsorPackages.values())
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((item) => cloneValue(item));
}

function mapMemberRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    memberNumber: Number(row.member_number || 0),
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    favoriteTeam: row.favorite_team || null,
    locale: row.locale || "en",
    referralCode: row.referral_code,
    referredByMemberId: row.referred_by_member_id || null,
    pointsBalance: Number(row.points_balance || 0),
    totalPointsEarned: Number(row.total_points_earned || 0),
    totalPointsRedeemed: Number(row.total_points_redeemed || 0),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    lastCheckInAt: row.last_check_in_at || null
  };
}

function syncMemberSequenceFromStorage() {
  if (!db) {
    return;
  }

  const row = db.prepare("SELECT COALESCE(MAX(member_number), 0) AS max_member_number FROM members").get();
  memberSequence = Number(row?.max_member_number || 0) + 1;
}

function getMemberById(memberId) {
  if (!db || !memberId) {
    return null;
  }

  return mapMemberRow(db.prepare("SELECT * FROM members WHERE id = ?").get(memberId));
}

function getMemberByEmail(email) {
  if (!db || !email) {
    return null;
  }

  return mapMemberRow(db.prepare("SELECT * FROM members WHERE email = ?").get(normalizeEmail(email)));
}

function getMemberByReferralCode(referralCode) {
  if (!db || !referralCode) {
    return null;
  }

  return mapMemberRow(db.prepare("SELECT * FROM members WHERE referral_code = ?").get(String(referralCode).toUpperCase()));
}

function createMemberId() {
  return `mbr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

function createUniqueReferralCode(displayName) {
  const base = sanitizeText(displayName)
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 6) || "FAN";

  let candidate = `${base}${String(memberSequence).padStart(4, "0")}`;
  while (getMemberByReferralCode(candidate)) {
    candidate = `${base}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  }
  return candidate;
}

function getRewardById(rewardId) {
  return MEMBERSHIP_REWARD_CATALOG.find((item) => item.id === rewardId) || null;
}

function isSameUtcDay(left, right) {
  if (!left || !right) {
    return false;
  }

  return String(left).slice(0, 10) === String(right).slice(0, 10);
}

function awardMemberPoints(memberId, pointsDelta, eventCode, note = "", relatedMemberId = null) {
  const member = getMemberById(memberId);
  if (!member) {
    throw new Error("Member not found");
  }

  const delta = Number(pointsDelta || 0);
  const nextBalance = member.pointsBalance + delta;
  if (nextBalance < 0) {
    return { error: "Not enough points" };
  }

  const nextEarned = member.totalPointsEarned + (delta > 0 ? delta : 0);
  const nextRedeemed = member.totalPointsRedeemed + (delta < 0 ? Math.abs(delta) : 0);
  const createdAt = new Date().toISOString();

  db.prepare(
    `
      UPDATE members
      SET points_balance = ?, total_points_earned = ?, total_points_redeemed = ?
      WHERE id = ?
    `
  ).run(nextBalance, nextEarned, nextRedeemed, member.id);

  const result = db.prepare(
    `
      INSERT INTO member_points_ledger
      (member_id, event_code, points_delta, balance_after, note, related_member_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(member.id, eventCode, delta, nextBalance, note || null, relatedMemberId || null, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    memberId: member.id,
    eventCode,
    pointsDelta: delta,
    balanceAfter: nextBalance,
    note,
    relatedMemberId,
    createdAt
  };
}

function listMemberActivity(memberId, language = "en", limit = 12) {
  if (!db || !memberId) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT ledger.id, ledger.event_code, ledger.points_delta, ledger.balance_after, ledger.note, ledger.created_at,
               ledger.related_member_id, related.display_name AS related_name
        FROM member_points_ledger AS ledger
        LEFT JOIN members AS related ON related.id = ledger.related_member_id
        WHERE ledger.member_id = ?
        ORDER BY ledger.id DESC
        LIMIT ?
      `
    )
    .all(memberId, Number(limit))
    .map((row) => {
      const relatedName = row.related_name || null;
      const eventCode = row.event_code;
      let title = row.note || eventCode;

      if (eventCode === "signup") {
        title = language === "zh" ? "新会员注册奖励" : "New member signup bonus";
      } else if (eventCode === "daily-checkin") {
        title = language === "zh" ? "每日签到奖励" : "Daily check-in bonus";
      } else if (eventCode.startsWith("referral-level-")) {
        const level = eventCode.split("-").pop();
        title =
          language === "zh"
            ? `${level} 级推荐奖励${relatedName ? ` · ${relatedName}` : ""}`
            : `Level ${level} referral bonus${relatedName ? ` · ${relatedName}` : ""}`;
      } else if (eventCode.startsWith("redeem:")) {
        title = language === "zh" ? "积分兑换权益" : "Points redemption";
      } else if (eventCode.startsWith("lucky-")) {
        title = language === "zh" ? "幸运会员奖励" : "Lucky member bonus";
      }

      return {
        id: Number(row.id),
        eventCode,
        pointsDelta: Number(row.points_delta || 0),
        balanceAfter: Number(row.balance_after || 0),
        title,
        note: row.note || "",
        relatedName,
        createdAt: row.created_at
      };
    });
}

function listMemberLeaderboard(limit = 5) {
  if (!db) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT member_number, display_name, favorite_team, points_balance
        FROM members
        ORDER BY points_balance DESC, member_number ASC
        LIMIT ?
      `
    )
    .all(Number(limit))
    .map((row) => ({
      memberNumber: Number(row.member_number || 0),
      displayName: row.display_name,
      favoriteTeam: row.favorite_team || null,
      pointsBalance: Number(row.points_balance || 0)
    }));
}

function buildMembershipRules(locale = "en") {
  const isZh = locale === "zh";
  return {
    signupBonus: MEMBERSHIP_RULES.signupBonus,
    checkInBonus: MEMBERSHIP_RULES.checkInBonus,
    referralBonuses: [
      {
        level: 1,
        points: MEMBERSHIP_RULES.referralBonuses.level1,
        label: isZh ? "一级推荐" : "Level 1 referral"
      },
      {
        level: 2,
        points: MEMBERSHIP_RULES.referralBonuses.level2,
        label: isZh ? "二级推荐" : "Level 2 referral"
      },
      {
        level: 3,
        points: MEMBERSHIP_RULES.referralBonuses.level3,
        label: isZh ? "三级推荐" : "Level 3 referral"
      }
    ],
    luckyBonuses: [
      { key: "lucky-7", points: 77, label: isZh ? "尾号 7 幸运奖励" : "Lucky member number ending in 7" },
      { key: "lucky-77", points: 177, label: isZh ? "尾号 77 幸运奖励" : "Lucky member number ending in 77" },
      { key: "lucky-777", points: 777, label: isZh ? "尾号 777 幸运奖励" : "Lucky member number ending in 777" },
      { key: "lucky-10000", points: 5000, label: isZh ? "第 10000 位会员大奖" : "10,000th member jackpot" }
    ],
    watchPartyPoints: {
      pointsPerCredit: WATCH_PARTY_POINTS_RULES.pointsPerCredit,
      discountValuePerCredit: WATCH_PARTY_POINTS_RULES.discountValuePerCredit,
      maxCreditsPerBooking: WATCH_PARTY_POINTS_RULES.maxCreditsPerBooking,
      summary: isZh
        ? `每 ${WATCH_PARTY_POINTS_RULES.pointsPerCredit} 积分可抵扣 ${WATCH_PARTY_POINTS_RULES.discountValuePerCredit} 单位票价，单笔最多用 ${WATCH_PARTY_POINTS_RULES.maxCreditsPerBooking} 份。`
        : `Every ${WATCH_PARTY_POINTS_RULES.pointsPerCredit} points unlocks ${WATCH_PARTY_POINTS_RULES.discountValuePerCredit} off one booking credit, up to ${WATCH_PARTY_POINTS_RULES.maxCreditsPerBooking} credits per reservation.`
    }
  };
}

function listRewardCatalog(locale = "en") {
  const isZh = locale === "zh";
  return MEMBERSHIP_REWARD_CATALOG.map((item) => ({
    id: item.id,
    title: isZh ? item.titleZh : item.title,
    description: isZh ? item.descriptionZh : item.description,
    partner: isZh ? item.partnerZh : item.partner,
    category: item.category,
    cost: item.cost,
    ctaPath: isZh ? item.ctaPathZh : item.ctaPath
  }));
}

function getMembershipStats() {
  if (!db) {
    return {
      memberCount: 0,
      referralMembers: 0,
      totalPointsIssued: 0,
      totalPointsRedeemed: 0,
      activeSessions: 0
    };
  }

  const membersRow = db
    .prepare(
      `
        SELECT COUNT(*) AS member_count,
               COALESCE(SUM(CASE WHEN referred_by_member_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS referral_members,
               COALESCE(SUM(total_points_earned), 0) AS points_issued,
               COALESCE(SUM(total_points_redeemed), 0) AS points_redeemed
        FROM members
      `
    )
    .get();
  const sessionsRow = db
    .prepare("SELECT COUNT(*) AS active_sessions FROM member_sessions WHERE expires_at > ?")
    .get(new Date().toISOString());

  return {
    memberCount: Number(membersRow?.member_count || 0),
    referralMembers: Number(membersRow?.referral_members || 0),
    totalPointsIssued: Number(membersRow?.points_issued || 0),
    totalPointsRedeemed: Number(membersRow?.points_redeemed || 0),
    activeSessions: Number(sessionsRow?.active_sessions || 0)
  };
}

function buildMemberReferralNetwork(memberId, locale = "en") {
  if (!db || !memberId) {
    return {
      counts: { level1: 0, level2: 0, level3: 0, total: 0 },
      levels: []
    };
  }

  const rows = db
    .prepare(
      `
        SELECT id, member_number, display_name, favorite_team, locale, points_balance, referred_by_member_id
        FROM members
        ORDER BY member_number ASC
      `
    )
    .all();
  const byParent = new Map();

  rows.forEach((row) => {
    const parentId = row.referred_by_member_id || "__root__";
    if (!byParent.has(parentId)) {
      byParent.set(parentId, []);
    }
    byParent.get(parentId).push({
      id: row.id,
      memberNumber: Number(row.member_number || 0),
      displayName: row.display_name,
      favoriteTeam: row.favorite_team || null,
      locale: row.locale || "en",
      pointsBalance: Number(row.points_balance || 0)
    });
  });

  const level1 = byParent.get(memberId) || [];
  const level2 = level1.flatMap((item) => byParent.get(item.id) || []);
  const level3 = level2.flatMap((item) => byParent.get(item.id) || []);
  const levels = [
    {
      level: 1,
      bonus: MEMBERSHIP_RULES.referralBonuses.level1,
      title: locale === "zh" ? "一级推荐树" : "Level 1 referral tree",
      members: level1
    },
    {
      level: 2,
      bonus: MEMBERSHIP_RULES.referralBonuses.level2,
      title: locale === "zh" ? "二级推荐树" : "Level 2 referral tree",
      members: level2
    },
    {
      level: 3,
      bonus: MEMBERSHIP_RULES.referralBonuses.level3,
      title: locale === "zh" ? "三级推荐树" : "Level 3 referral tree",
      members: level3
    }
  ];

  return {
    counts: {
      level1: level1.length,
      level2: level2.length,
      level3: level3.length,
      total: level1.length + level2.length + level3.length
    },
    levels
  };
}

function serializeMember(member) {
  if (!member) {
    return null;
  }

  return {
    id: member.id,
    memberNumber: member.memberNumber,
    email: member.email,
    displayName: member.displayName,
    favoriteTeam: member.favoriteTeam,
    locale: member.locale,
    referralCode: member.referralCode,
    referredByMemberId: member.referredByMemberId,
    pointsBalance: member.pointsBalance,
    totalPointsEarned: member.totalPointsEarned,
    totalPointsRedeemed: member.totalPointsRedeemed,
    createdAt: member.createdAt,
    lastLoginAt: member.lastLoginAt,
    lastCheckInAt: member.lastCheckInAt
  };
}

function buildMembershipOverview(locale = "en", member = null, token = "") {
  return {
    token: token || null,
    member: serializeMember(member),
    stats: getMembershipStats(),
    rules: buildMembershipRules(locale),
    rewards: listRewardCatalog(locale),
    leaderboard: listMemberLeaderboard(5),
    network: member ? buildMemberReferralNetwork(member.id, locale) : null,
    activity: member ? listMemberActivity(member.id, locale, 12) : []
  };
}

function createSessionForMember(memberId) {
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashSessionToken(token);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + MEMBER_SESSION_TTL_MS).toISOString();

  db.prepare(
    `
      INSERT INTO member_sessions (token_hash, member_id, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `
  ).run(tokenHash, memberId, createdAt, createdAt, expiresAt);

  return token;
}

function revokeSessionToken(token) {
  if (!db || !token) {
    return;
  }

  db.prepare("DELETE FROM member_sessions WHERE token_hash = ?").run(hashSessionToken(token));
}

function getAuthenticatedMember(req) {
  if (!db) {
    return null;
  }

  const token = extractBearerToken(req);
  if (!token) {
    return null;
  }

  const row = db
    .prepare(
      `
        SELECT members.*
        FROM member_sessions
        INNER JOIN members ON members.id = member_sessions.member_id
        WHERE member_sessions.token_hash = ? AND member_sessions.expires_at > ?
      `
    )
    .get(hashSessionToken(token), new Date().toISOString());

  if (!row) {
    return null;
  }

  db.prepare("UPDATE member_sessions SET last_seen_at = ? WHERE token_hash = ?").run(
    new Date().toISOString(),
    hashSessionToken(token)
  );

  return mapMemberRow(row);
}

function createMemberAccount(payload, locale = "en") {
  const displayName = sanitizeText(payload.displayName || payload.name).slice(0, 80);
  const email = normalizeEmail(payload.email).slice(0, 160);
  const password = String(payload.password || "");
  const favoriteTeam = sanitizeText(payload.favoriteTeam).slice(0, 80) || null;
  const referralCode = sanitizeText(payload.referralCode).toUpperCase();

  if (!displayName || !email || !password) {
    return { error: "Display name, email, and password are required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (getMemberByEmail(email)) {
    return { error: "Email already registered" };
  }

  const referrer = referralCode ? getMemberByReferralCode(referralCode) : null;
  if (referralCode && !referrer) {
    return { error: "Referral code not found" };
  }

  const memberId = createMemberId();
  const memberNumber = memberSequence;
  const now = new Date().toISOString();
  const nextReferralCode = createUniqueReferralCode(displayName);
  const passwordHash = createPasswordHash(password);

  db.exec("BEGIN");
  try {
    db.prepare(
      `
        INSERT INTO members
        (id, member_number, email, display_name, password_hash, favorite_team, locale, referral_code, referred_by_member_id, created_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      memberId,
      memberNumber,
      email,
      displayName,
      passwordHash,
      favoriteTeam,
      locale,
      nextReferralCode,
      referrer?.id || null,
      now,
      now
    );

    memberSequence += 1;
    awardMemberPoints(memberId, MEMBERSHIP_RULES.signupBonus, "signup", locale === "zh" ? "注册即送积分" : "Signup bonus");

    let ancestor = referrer;
    [1, 2, 3].forEach((level) => {
      if (!ancestor) {
        return;
      }

      const points = MEMBERSHIP_RULES.referralBonuses[`level${level}`];
      awardMemberPoints(
        ancestor.id,
        points,
        `referral-level-${level}`,
        locale === "zh" ? `第 ${level} 级推荐奖励` : `Level ${level} referral reward`,
        memberId
      );
      ancestor = ancestor.referredByMemberId ? getMemberById(ancestor.referredByMemberId) : null;
    });

    MEMBERSHIP_RULES.luckyBonuses.forEach((bonus) => {
      if (bonus.match(memberNumber)) {
        awardMemberPoints(
          memberId,
          bonus.points,
          bonus.key,
          locale === "zh" ? "幸运会员编号奖励" : "Lucky member number reward"
        );
      }
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return { error: error.message || "Failed to create member" };
  }

  const member = getMemberById(memberId);
  const token = createSessionForMember(member.id);
  return buildMembershipOverview(locale, member, token);
}

function loginMemberAccount(payload, locale = "en") {
  const email = normalizeEmail(payload.email).slice(0, 160);
  const password = String(payload.password || "");
  const member = getMemberByEmail(email);

  if (!member || !verifyPasswordHash(password, member.passwordHash)) {
    return { error: "Invalid email or password" };
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE members SET last_login_at = ? WHERE id = ?").run(now, member.id);
  const refreshed = getMemberById(member.id);
  const token = createSessionForMember(member.id);
  return buildMembershipOverview(locale, refreshed, token);
}

function claimDailyCheckIn(memberId, locale = "en") {
  const member = getMemberById(memberId);
  if (!member) {
    return { error: "Member not found" };
  }

  const now = new Date().toISOString();
  if (isSameUtcDay(member.lastCheckInAt, now)) {
    return { error: locale === "zh" ? "今天已经签到过了" : "Daily check-in already claimed today" };
  }

  db.prepare("UPDATE members SET last_check_in_at = ? WHERE id = ?").run(now, member.id);
  const result = awardMemberPoints(
    member.id,
    MEMBERSHIP_RULES.checkInBonus,
    "daily-checkin",
    locale === "zh" ? "比赛日签到奖励" : "Matchday check-in reward"
  );
  if (result.error) {
    return result;
  }

  return buildMembershipOverview(locale, getMemberById(member.id));
}

function redeemMemberReward(memberId, rewardId, locale = "en") {
  const member = getMemberById(memberId);
  const reward = getRewardById(rewardId);

  if (!member || !reward) {
    return { error: locale === "zh" ? "会员或权益不存在" : "Member or reward not found" };
  }

  const redemption = awardMemberPoints(
    member.id,
    -Math.abs(reward.cost),
    `redeem:${reward.id}`,
    locale === "zh" ? `${reward.titleZh} 兑换` : `${reward.title} redemption`
  );

  if (redemption.error) {
    return { error: locale === "zh" ? "积分不足，无法兑换" : "Not enough points to redeem this reward" };
  }

  return {
    voucher: {
      rewardId: reward.id,
      code: `MB-${reward.id.toUpperCase().slice(0, 8)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      title: locale === "zh" ? reward.titleZh : reward.title,
      partner: locale === "zh" ? reward.partnerZh : reward.partner,
      cost: reward.cost,
      createdAt: redemption.createdAt
    },
    ...buildMembershipOverview(locale, getMemberById(member.id))
  };
}

function joinCommunityRoom(room, payload, locale = "en") {
  const displayName = sanitizeText(payload.name).slice(0, 80);
  if (!displayName) {
    return { error: "Name is required" };
  }

  const joinedAt = new Date().toISOString();
  const member = {
    displayName,
    market: sanitizeText(payload.market).slice(0, 80) || "Global",
    favoriteTeam: sanitizeText(payload.favoriteTeam).slice(0, 80) || null,
    locale,
    createdAt: joinedAt
  };

  db.prepare(
    `
      INSERT INTO room_members (room_id, display_name, market, favorite_team, locale, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(room.id, member.displayName, member.market, member.favoriteTeam, member.locale, member.createdAt);

  room.memberCount = Number(room.memberCount || 0) + 1;
  room.updatedAt = joinedAt;
  persistCommunityRoom(room);

  return {
    member,
    room: serializeCommunityRoom(room)
  };
}

function reserveWatchParty(party, payload, locale = "en") {
  const name = sanitizeText(payload.name).slice(0, 80);
  const email = sanitizeText(payload.email).slice(0, 160);
  const groupSize = Math.max(1, Math.min(8, Number(payload.groupSize || 1)));

  if (!name || !email) {
    return { error: "Name and email are required" };
  }

  if (groupSize > Number(party.seatsLeft || 0)) {
    return { error: "Not enough seats left" };
  }

  const createdAt = new Date().toISOString();
  const confirmationCode = `MB-${String(Date.now()).slice(-8)}`;

  db.prepare(
    `
      INSERT INTO watch_party_reservations
      (party_id, reservation_name, email, group_size, favorite_team, notes, locale, confirmation_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    party.id,
    name,
    email,
    groupSize,
    sanitizeText(payload.favoriteTeam).slice(0, 80) || null,
    sanitizeText(payload.notes).slice(0, 200) || null,
    locale,
    confirmationCode,
    createdAt
  );

  party.seatsLeft = Number(party.seatsLeft || 0) - groupSize;
  party.updatedAt = createdAt;
  persistWatchParty(party);

  return {
    reservation: {
      name,
      email,
      groupSize,
      confirmationCode,
      createdAt
    },
    party: cloneValue(party)
  };
}

function reserveWatchPartyWithPoints(party, payload, locale = "en", member = null) {
  const name = sanitizeText(payload.name).slice(0, 80);
  const email = sanitizeText(payload.email).slice(0, 160);
  const groupSize = Math.max(1, Math.min(8, Number(payload.groupSize || 1)));
  const usePoints = Boolean(payload.usePoints);
  const requestedCredits = Math.max(0, Math.min(8, Number(payload.pointsCredits || 0)));

  if (!name || !email) {
    return { error: "Name and email are required" };
  }

  if (groupSize > Number(party.seatsLeft || 0)) {
    return { error: "Not enough seats left" };
  }

  const quote = buildWatchPartyPointsQuote(party, groupSize, member);
  if (usePoints && !member) {
    return { error: locale === "zh" ? "请先登录会员账户，再使用积分抵扣" : "Sign in as a member before using points" };
  }

  const creditsApplied = usePoints ? Math.min(Math.max(1, requestedCredits || quote.defaultCredits), quote.maxCredits) : 0;
  if (usePoints && creditsApplied <= 0) {
    return {
      error:
        locale === "zh"
          ? "当前积分不足以抵扣这场观赛活动"
          : "You do not have enough points to apply a watch-party ticket credit"
    };
  }

  const pointsUsed = creditsApplied * WATCH_PARTY_POINTS_RULES.pointsPerCredit;
  const estimatedDiscount = creditsApplied * WATCH_PARTY_POINTS_RULES.discountValuePerCredit;
  const estimatedPayable = Math.max(quote.price.amount * groupSize - estimatedDiscount, 0);
  const createdAt = new Date().toISOString();
  const confirmationCode = `MB-${String(Date.now()).slice(-8)}`;
  let reservationId = null;

  db.exec("BEGIN");
  try {
    const reservationResult = db.prepare(
      `
        INSERT INTO watch_party_reservations
        (party_id, reservation_name, email, group_size, favorite_team, notes, locale, confirmation_code, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      party.id,
      name,
      email,
      groupSize,
      sanitizeText(payload.favoriteTeam).slice(0, 80) || null,
      sanitizeText(payload.notes).slice(0, 200) || null,
      locale,
      confirmationCode,
      createdAt
    );
    reservationId = Number(reservationResult.lastInsertRowid);

    if (pointsUsed > 0 && member) {
      const ledger = awardMemberPoints(
        member.id,
        -pointsUsed,
        `watch-party-credit:${party.id}`,
        locale === "zh" ? `${party.titleZh || party.title} 票务积分抵扣` : `${party.title} watch-party ticket credit`
      );
      if (ledger.error) {
        throw new Error(ledger.error);
      }

      db.prepare(
        `
          INSERT INTO watch_party_point_redemptions
          (reservation_id, party_id, member_id, points_used, credit_count, estimated_discount_value, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      ).run(reservationId, party.id, member.id, pointsUsed, creditsApplied, estimatedDiscount, createdAt);
    }

    party.seatsLeft = Number(party.seatsLeft || 0) - groupSize;
    party.updatedAt = createdAt;
    persistWatchParty(party);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return { error: error.message || "Reservation failed" };
  }

  return {
    reservation: {
      id: reservationId,
      name,
      email,
      groupSize,
      confirmationCode,
      createdAt,
      pointsUsed,
      creditsApplied,
      estimatedDiscount,
      estimatedPayable,
      priceLabel: party.priceLabel,
      currencyLabel: quote.price.currency
    },
    member: member ? serializeMember(getMemberById(member.id)) : null,
    party: cloneValue(party)
  };
}

function createSponsorLead(item, payload, locale = "en") {
  const companyName = sanitizeText(payload.companyName).slice(0, 120);
  const contactName = sanitizeText(payload.contactName).slice(0, 80);
  const email = sanitizeText(payload.email).slice(0, 160);

  if (!companyName || !contactName || !email) {
    return { error: "Company, contact, and email are required" };
  }

  const createdAt = new Date().toISOString();
  const lead = {
    packageId: item.id,
    companyName,
    contactName,
    email,
    market: sanitizeText(payload.market).slice(0, 80) || "Global",
    goal: sanitizeText(payload.goal).slice(0, 180) || null,
    fixtureId: sanitizeText(payload.fixtureId).slice(0, 120) || null,
    locale,
    createdAt
  };

  const result = db.prepare(
    `
      INSERT INTO sponsor_leads
      (package_id, company_name, contact_name, email, market, goal, fixture_id, locale, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    lead.packageId,
    lead.companyName,
    lead.contactName,
    lead.email,
    lead.market,
    lead.goal,
    lead.fixtureId,
    lead.locale,
    lead.createdAt
  );

  return {
    lead: {
      id: Number(result.lastInsertRowid),
      ...lead
    },
    package: cloneValue(item)
  };
}

function initStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      match_id TEXT,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS community_rooms (
      id TEXT PRIMARY KEY,
      market TEXT,
      status TEXT,
      member_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      market TEXT,
      favorite_team TEXT,
      locale TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watch_parties (
      id TEXT PRIMARY KEY,
      fixture_id TEXT,
      city TEXT,
      start_at TEXT,
      seats_left INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watch_party_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id TEXT NOT NULL,
      reservation_name TEXT NOT NULL,
      email TEXT NOT NULL,
      group_size INTEGER NOT NULL,
      favorite_team TEXT,
      notes TEXT,
      locale TEXT,
      confirmation_code TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watch_party_point_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL,
      party_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      points_used INTEGER NOT NULL,
      credit_count INTEGER NOT NULL,
      estimated_discount_value REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sponsor_packages (
      id TEXT PRIMARY KEY,
      tier TEXT,
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sponsor_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT NOT NULL,
      market TEXT,
      goal TEXT,
      fixture_id TEXT,
      locale TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      member_number INTEGER UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      favorite_team TEXT,
      locale TEXT,
      referral_code TEXT UNIQUE NOT NULL,
      referred_by_member_id TEXT,
      points_balance INTEGER DEFAULT 0,
      total_points_earned INTEGER DEFAULT 0,
      total_points_redeemed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL,
      last_check_in_at TEXT
    );

    CREATE TABLE IF NOT EXISTS member_sessions (
      token_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS member_points_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id TEXT NOT NULL,
      event_code TEXT NOT NULL,
      points_delta INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      note TEXT,
      related_member_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      field_key TEXT,
      model TEXT,
      status TEXT NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cached_tokens INTEGER DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      finish_reason TEXT,
      response_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS traffic_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT,
      session_id TEXT,
      event_type TEXT NOT NULL,
      page_key TEXT,
      path TEXT,
      locale TEXT,
      fixture_id TEXT,
      room_id TEXT,
      target_path TEXT,
      target_group TEXT,
      label TEXT,
      source TEXT,
      medium TEXT,
      campaign_code TEXT,
      content_code TEXT,
      referrer_host TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_traffic_events_created_at ON traffic_events (created_at);
    CREATE INDEX IF NOT EXISTS idx_traffic_events_event_type ON traffic_events (event_type);
    CREATE INDEX IF NOT EXISTS idx_traffic_events_source_medium ON traffic_events (source, medium);
    CREATE INDEX IF NOT EXISTS idx_traffic_events_page_key ON traffic_events (page_key);
    CREATE INDEX IF NOT EXISTS idx_traffic_events_fixture_id ON traffic_events (fixture_id);
  `);

  loadPollsFromStorage();
  loadCampaignsFromStorage();
  loadCommerceFromStorage();
  syncMemberSequenceFromStorage();
  seedSupportPolls();
  seedCommerceData();
}

function buildCampaignBrief(campaign) {
  const tags = campaign.content.hashtags.join(" ");
  return [
    "# MatchBuzz Operator Brief",
    "",
    `Campaign ID: ${campaign.id}`,
    `Match: ${campaign.match.homeTeam} vs ${campaign.match.awayTeam}`,
    `Support Team: ${campaign.supportTeam}`,
    `Market: ${campaign.targetMarket}`,
    `Channel: ${campaign.channel}`,
    `Language: ${campaign.language}`,
    `Scene: ${campaign.scene}`,
    `Generation Source: ${campaign.generationSource}`,
    `Queue Window: ${campaign.queueWindow || "TBD"}`,
    "",
    "## Content Package",
    `Headline: ${campaign.content.headline}`,
    "",
    "Social Post:",
    campaign.content.socialPost,
    "",
    "Video Script:",
    campaign.content.videoScript,
    "",
    "Support Chant:",
    campaign.content.chant,
    "",
    "Recap Angle:",
    campaign.content.recap,
    "",
    `Hashtags: ${tags}`,
    "",
    "## Interaction Layer",
    `Generated Poll: ${campaign.generatedPollId || "Not attached"}`,
    `Facts Attached: ${campaign.funFacts.length}`,
    `Trending Tags: ${campaign.trending.join(" ")}`,
    "",
    "## Recent Activity"
  ]
    .concat(
      campaign.activity.slice(0, 6).map((entry) => `- ${entry.code} @ ${entry.createdAt}`)
    )
    .join("\n");
}

function getCampaignCounts() {
  const items = Array.from(campaigns.values());
  return {
    total: items.length,
    draft: items.filter((entry) => entry.status === "draft").length,
    ready: items.filter((entry) => entry.status === "ready").length,
    queued: items.filter((entry) => entry.status === "queued").length
  };
}

function ensureSupportPoll(match, index = 0) {
  const pollId = `support-${match.id}`;
  match.supportPollId = pollId;

  if (!polls.has(pollId)) {
    const poll = {
      id: pollId,
      matchId: match.id,
      question: `Who are you backing in ${match.homeTeam} vs ${match.awayTeam}?`,
      options: [
        { id: "home", label: match.homeTeam, votes: 40 + index * 9 },
        { id: "away", label: match.awayTeam, votes: 35 + index * 7 }
      ],
      createdAt: new Date().toISOString()
    };

    polls.set(pollId, poll);
    persistPoll(poll);
  }

  return match;
}

function seedSupportPolls() {
  matches.forEach((match, index) => {
    ensureSupportPoll(match, index);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function sendSvg(res, svg) {
  res.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600"
  });
  res.end(svg);
}

function sendText(res, text, cacheControl = "public, max-age=3600") {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": cacheControl
  });
  res.end(text);
}

function sendXml(res, xml, cacheControl = "public, max-age=1800") {
  res.writeHead(200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": cacheControl
  });
  res.end(xml);
}

async function sendPlayerPhoto(res, playerId) {
  const sourceUrl = PLAYER_IMAGE_URLS[playerId];
  if (!sourceUrl) {
    sendSvg(res, buildPlayerFallbackSvg(playerId));
    return;
  }

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "MatchBuzz/1.0 (+player-photo-proxy)"
      }
    });

    if (!response.ok) {
      throw new Error(`Player photo provider returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new Error("Player photo provider returned non-image content");
    }
    const arrayBuffer = await response.arrayBuffer();
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400"
    });
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    sendSvg(res, buildPlayerFallbackSvg(playerId));
  }
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, file) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml; charset=utf-8",
      ".txt": "text/plain; charset=utf-8",
      ".xml": "application/xml; charset=utf-8"
    };

    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(file);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/[<>{}]/g, "")
    .trim();
}

function normalizeEmail(value) {
  return sanitizeText(value).toLowerCase();
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPasswordHash(password, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");
  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(String(password), salt, 64);
  const stored = Buffer.from(hash, "hex");
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function extractBearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    return "";
  }
  return header.slice("Bearer ".length).trim();
}

function buildPlayerFallbackSvg(playerId) {
  const meta = PLAYER_FALLBACK_META[playerId] || { name: "MatchBuzz", number: "MB", top: "#7ce3b3", bottom: "#1b7d4a" };
  const escapedName = String(meta.name).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedNumber = String(meta.number).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960" role="img" aria-label="${escapedName}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${meta.top}" />
          <stop offset="100%" stop-color="${meta.bottom}" />
        </linearGradient>
      </defs>
      <rect width="720" height="960" fill="url(#bg)" />
      <circle cx="360" cy="280" r="124" fill="rgba(255,255,255,0.22)" />
      <path d="M184 800c24-170 116-260 176-260s152 90 176 260" fill="rgba(10,26,14,0.34)" />
      <text x="58" y="146" fill="rgba(255,255,255,0.92)" font-family="Avenir Next,Segoe UI,sans-serif" font-size="176" font-weight="800">${escapedNumber}</text>
      <text x="58" y="888" fill="#f7fbf4" font-family="Avenir Next,Segoe UI,sans-serif" font-size="62" font-weight="800">${escapedName}</text>
      <text x="58" y="930" fill="rgba(247,251,244,0.72)" font-family="Avenir Next,Segoe UI,sans-serif" font-size="24" font-weight="600">MatchBuzz player card</text>
    </svg>
  `.trim();
}

function parsePriceLabel(priceLabel) {
  const raw = sanitizeText(priceLabel);
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  const amount = match ? Number(match[1]) : 0;
  const currency = raw.replace(/(\d+(?:\.\d+)?)/, "").trim() || "credits";
  return {
    raw,
    amount,
    currency
  };
}

function buildWatchPartyPointsQuote(party, groupSize, member) {
  const safeGroupSize = Math.max(1, Math.min(8, Number(groupSize || 1)));
  const price = parsePriceLabel(party?.priceLabel || "");
  const maxCreditsByBalance = member ? Math.floor(Number(member.pointsBalance || 0) / WATCH_PARTY_POINTS_RULES.pointsPerCredit) : 0;
  const maxCredits = Math.max(
    0,
    Math.min(maxCreditsByBalance, safeGroupSize, WATCH_PARTY_POINTS_RULES.maxCreditsPerBooking)
  );
  const requestedCredits = Math.max(0, Math.min(maxCredits, Number(safeGroupSize > 1 ? 1 : 1)));
  const pointsNeeded = requestedCredits * WATCH_PARTY_POINTS_RULES.pointsPerCredit;
  const estimatedDiscount = requestedCredits * WATCH_PARTY_POINTS_RULES.discountValuePerCredit;
  const estimatedTotal = Math.max(price.amount * safeGroupSize - estimatedDiscount, 0);

  return {
    price,
    safeGroupSize,
    maxCredits,
    defaultCredits: Math.min(requestedCredits, maxCredits),
    pointsPerCredit: WATCH_PARTY_POINTS_RULES.pointsPerCredit,
    discountValuePerCredit: WATCH_PARTY_POINTS_RULES.discountValuePerCredit,
    estimatedDiscount,
    estimatedTotal,
    pointsNeeded
  };
}

function normalizeRemoteMatch(raw, index) {
  const homeTeam = sanitizeText(
    raw.homeTeam || raw.home_team || raw.home?.name || raw.teams?.home?.name || raw.teams?.home || raw.participants?.[0]?.name
  );
  const awayTeam = sanitizeText(
    raw.awayTeam || raw.away_team || raw.away?.name || raw.teams?.away?.name || raw.teams?.away || raw.participants?.[1]?.name
  );

  if (!homeTeam || !awayTeam) {
    return null;
  }

  const stage = sanitizeText(raw.stage || raw.round || raw.phase || "Featured Match");
  const match = {
    id: slugify(raw.id || raw.matchId || `${homeTeam}-${awayTeam}`),
    homeTeam,
    awayTeam,
    kickOff: raw.kickOff || raw.kickoff || raw.startTime || raw.utcDate || new Date(Date.now() + index * 7200000).toISOString(),
    city: sanitizeText(raw.city || raw.venue?.city || raw.venue?.name || raw.venue || "TBD"),
    stage,
    storyline:
      sanitizeText(raw.storyline || raw.description || raw.summary) || buildDefaultStoryline(homeTeam, awayTeam, stage),
    facts:
      toStringList(raw.facts || raw.funFacts).length > 0
        ? toStringList(raw.facts || raw.funFacts)
        : [
            `${homeTeam} vs ${awayTeam} is being positioned as a global fan conversation fixture.`,
            `This matchup is useful for multi-language football storytelling and creator workflows.`,
            `The atmosphere, rivalry, and tournament timing make it a strong social distribution event.`
          ],
    tags:
      toStringList(raw.tags).length > 0
        ? toStringList(raw.tags)
        : ["#MatchBuzz", `#${homeTeam.replace(/\s+/g, "")}`, `#${awayTeam.replace(/\s+/g, "")}`, "#WorldFootball"],
    hotTakes:
      toStringList(raw.hotTakes || raw.talkingPoints).length > 0
        ? toStringList(raw.hotTakes || raw.talkingPoints)
        : [
            `${homeTeam} vs ${awayTeam} should be framed around momentum and emotional swings.`,
            `This fixture is likely to perform well with fans, creators, and sponsor storytelling.`,
            `A strong live interaction layer matters as much as the recap content here.`
          ]
  };

  return ensureSupportPoll(match, index);
}

function listLocalMatches() {
  return matches.map((match, index) => ensureSupportPoll(match, index));
}

async function fetchRemoteMatches() {
  const response = await fetch(CONFIG.matchData.apiUrl, {
    method: "GET",
    headers: buildAuthHeaders(CONFIG.matchData)
  });

  if (!response.ok) {
    throw new Error(`Match data provider returned ${response.status}`);
  }

  const payload = await response.json();
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.matches)
      ? payload.matches
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.events)
          ? payload.events
          : [];

  const normalized = candidates.map(normalizeRemoteMatch).filter(Boolean);
  if (!normalized.length) {
    throw new Error("Match data provider returned no usable matches");
  }

  remoteMatchesCache.expiresAt = Date.now() + CONFIG.matchData.cacheMs;
  remoteMatchesCache.items = normalized;
  return normalized;
}

async function listMatches() {
  if (!hasRemoteMatchData()) {
    return listLocalMatches();
  }

  if (remoteMatchesCache.items && remoteMatchesCache.expiresAt > Date.now()) {
    return remoteMatchesCache.items;
  }

  try {
    return await fetchRemoteMatches();
  } catch (error) {
    return listLocalMatches();
  }
}

async function getMatch(matchId) {
  const items = await listMatches();
  return items.find((match) => match.id === matchId);
}

function getBundle(language) {
  return languageBundles[language] || languageBundles.en;
}

function getLocalizedFacts(match, language) {
  return factTranslations[language]?.[match.id] || match.facts;
}

function moderateText(input) {
  const banned = ["rumor", "leak", "betting", "hack", "scandal"];
  const lower = String(input || "").toLowerCase();
  const hits = banned.filter((word) => lower.includes(word));
  return {
    safe: hits.length === 0,
    hits
  };
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (nestedError) {
        return null;
      }
    }
    return null;
  }
}

function normalizeGeneratedPayload(raw, fallback) {
  const pollOptions = Array.isArray(raw.pollOptions || raw.poll_options)
    ? (raw.pollOptions || raw.poll_options).map((option) => sanitizeText(option)).filter(Boolean).slice(0, 4)
    : [];
  const hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags
        .map((tag) => sanitizeText(tag))
        .filter(Boolean)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`))
        .slice(0, 5)
    : [];

  return {
    headline: sanitizeText(raw.headline) || fallback.headline,
    socialPost: sanitizeText(raw.socialPost || raw.social_post) || fallback.socialPost,
    videoScript: sanitizeText(raw.videoScript || raw.video_script) || fallback.videoScript,
    recap: sanitizeText(raw.recap) || fallback.recap,
    chant: sanitizeText(raw.chant) || fallback.chant,
    pollQuestion: sanitizeText(raw.pollQuestion || raw.poll_question) || fallback.pollQuestion,
    pollOptions: pollOptions.length === 4 ? pollOptions : fallback.pollOptions,
    hashtags: hashtags.length >= 3 ? hashtags : fallback.hashtags
  };
}

async function generateWithRemoteLlm(payload) {
  const userPrompt = buildRemotePromptText(payload);

  const [headline, socialPost, videoScript, recap, chant, pollQuestion, pollOptions, hashtags] = await Promise.all([
    callRemoteJsonField({
      key: "headline",
      userPrompt,
      systemPrompt: 'Return JSON only like {"headline":"..."} with one short football headline. Max 12 words.',
      maxTokens: 70,
      scope: "generate"
    }),
    callRemoteJsonField({
      key: "socialPost",
      userPrompt,
      systemPrompt: 'Return JSON only like {"socialPost":"..."} with one short matchday social post. Max 35 words.',
      maxTokens: 110,
      scope: "generate"
    }),
    callRemoteJsonField({
      key: "videoScript",
      userPrompt,
      systemPrompt: 'Return JSON only like {"videoScript":"..."} with one short voiceover line. Max 40 words.',
      maxTokens: 120,
      scope: "generate"
    }),
    callRemoteJsonField({
      key: "recap",
      userPrompt,
      systemPrompt: 'Return JSON only like {"recap":"..."} with one short recap angle. Max 28 words.',
      maxTokens: 90,
      scope: "generate"
    }),
    callRemoteJsonField({
      key: "chant",
      userPrompt,
      systemPrompt: 'Return JSON only like {"chant":"..."} with one short fan chant. Max 8 words.',
      maxTokens: 50,
      scope: "generate"
    }),
    callRemoteJsonField({
      key: "pollQuestion",
      userPrompt,
      systemPrompt: 'Return JSON only like {"pollQuestion":"..."} with one short poll question. Max 10 words.',
      maxTokens: 70,
      scope: "generate"
    }),
    callRemoteJsonField({
      key: "pollOptions",
      userPrompt,
      systemPrompt:
        'Return JSON only like {"pollOptions":["A","B","C","D"]}. Give exactly 4 short football poll options, each max 4 words.',
      maxTokens: 90,
      scope: "generate"
    }),
    callRemoteJsonField({
      key: "hashtags",
      userPrompt,
      systemPrompt:
        'Return JSON only like {"hashtags":["#One","#Two","#Three","#Four"]}. Give exactly 4 short hashtags.',
      maxTokens: 70,
      scope: "generate"
    })
  ]);

  return {
    headline,
    socialPost,
    videoScript,
    recap,
    chant,
    pollQuestion,
    pollOptions,
    hashtags
  };
}

function buildRemotePromptText(payload) {
  return [
    `Match: ${payload.match.homeTeam} vs ${payload.match.awayTeam}`,
    `Support team: ${payload.supportTeam}`,
    `City: ${payload.match.city || "TBD"}`,
    `Stage: ${payload.match.stage || "Featured match"}`,
    `Language: ${payload.languageLabel || payload.language || "English"}`,
    `Scene: ${payload.sceneLabel || payload.scene || "pre-match"}`,
    `Market: ${payload.targetMarket}`,
    `Channel: ${payload.channel}`,
    `Angle: ${payload.angle}`,
    payload.includeFun && payload.funFacts?.[0] ? `Fun fact: ${payload.funFacts[0]}` : "",
    payload.hotTakes?.[0] ? `Talking point: ${payload.hotTakes[0]}` : "",
    payload.tags?.length ? `Tags: ${payload.tags.slice(0, 3).join(" ")}` : "",
    "Keep it public, football-first, and brand-safe."
  ]
    .filter(Boolean)
    .join("\n");
}

async function callRemoteJsonField({ key, systemPrompt, userPrompt, maxTokens, scope = "json-field" }) {
  const startedAt = Date.now();
  let logged = false;

  try {
    const response = await fetch(CONFIG.llm.apiUrl, {
      method: "POST",
      headers: {
        ...buildAuthHeaders(CONFIG.llm),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: CONFIG.llm.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: Math.max(Number(maxTokens || 0), 1200),
        reasoning_split: true
      })
    });

    if (!response.ok) {
      recordLlmCallLog({
        fieldKey: key,
        scope,
        model: CONFIG.llm.model,
        status: "http_error",
        latencyMs: Date.now() - startedAt,
        errorMessage: `LLM provider returned ${response.status}`
      });
      logged = true;
      throw new Error(`LLM provider returned ${response.status}`);
    }

    const data = await response.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      data.content ||
      "";

    const parsed = extractJsonObject(content);
    if (!parsed || parsed[key] === undefined) {
      recordLlmCallLog({
        fieldKey: key,
        scope,
        model: sanitizeText(data.model) || CONFIG.llm.model,
        status: "parse_error",
        latencyMs: Date.now() - startedAt,
        usage: data.usage,
        finishReason: sanitizeText(data.choices?.[0]?.finish_reason || ""),
        responseId: sanitizeText(data.id || ""),
        errorMessage: `LLM provider did not return valid ${key} JSON`
      });
      logged = true;
      throw new Error(`LLM provider did not return valid ${key} JSON`);
    }

    recordLlmCallLog({
      fieldKey: key,
      scope,
      model: sanitizeText(data.model) || CONFIG.llm.model,
      status: "success",
      latencyMs: Date.now() - startedAt,
      usage: data.usage,
      finishReason: sanitizeText(data.choices?.[0]?.finish_reason || ""),
      responseId: sanitizeText(data.id || "")
    });
    logged = true;
    return parsed[key];
  } catch (error) {
    if (!logged) {
      recordLlmCallLog({
        fieldKey: key,
        scope,
        model: CONFIG.llm.model,
        status: "network_error",
        latencyMs: Date.now() - startedAt,
        errorMessage: error.message || "Remote LLM request failed"
      });
    }
    throw error;
  }
}

async function createGeneratedContent(payload) {
  const match = await resolveMatchPayload(payload);
  if (!match) {
    return { error: "Unknown match" };
  }

  const bundle = getBundle(payload.language);
  const supportTeam =
    payload.supportTeam === match.homeTeam || payload.supportTeam === match.awayTeam
      ? payload.supportTeam
      : match.homeTeam;
  const scene = ["pre_match", "live", "post_match"].includes(payload.scene) ? payload.scene : "pre_match";
  const includeFun = Boolean(payload.includeFun);
  const localizedFacts = getLocalizedFacts(match, payload.language);
  const fallbackGenerated = bundle.build({ ...match, facts: localizedFacts }, supportTeam, scene, includeFun);
  let generated = fallbackGenerated;
  let generationSource = "template";

  if (hasRemoteLlm()) {
    try {
      const remoteGenerated = await generateWithRemoteLlm({
        match: {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          city: match.city,
          stage: match.stage,
          storyline: match.storyline,
          kickOff: match.kickOff,
          league: match.league || null,
          round: match.round || null,
          status: match.status || null,
          homeScore: match.homeScore ?? null,
          awayScore: match.awayScore ?? null
        },
        supportTeam,
        opposition: supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam,
        language: payload.language || "en",
        languageLabel: bundle.label,
        scene,
        sceneLabel: bundle.sceneNames[scene],
        targetMarket: sanitizeEnum(payload.targetMarket, ["sea", "latam", "global"], "global"),
        channel: sanitizeEnum(payload.channel, ["fan_community", "creator_short", "brand_social"], "fan_community"),
        angle: sanitizeEnum(payload.angle, ["rivalry", "star_spotlight", "fan_culture", "tactical_debate"], "rivalry"),
        includeFun,
        funFacts: localizedFacts,
        hotTakes: match.hotTakes,
        tags: match.tags
      });

      generated = normalizeGeneratedPayload(remoteGenerated, fallbackGenerated);
      generationSource = "remote-llm";
    } catch (error) {
      generationSource = "template-fallback";
    }
  }

  return {
    match: {
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      city: match.city,
      stage: match.stage,
      storyline: match.storyline
    },
    language: payload.language || "en",
    languageLabel: bundle.label,
    generationSource,
    scene,
    sceneLabel: bundle.sceneNames[scene],
    targetMarket: sanitizeEnum(payload.targetMarket, ["sea", "latam", "global"], "global"),
    channel: sanitizeEnum(payload.channel, ["fan_community", "creator_short", "brand_social"], "fan_community"),
    angle: sanitizeEnum(payload.angle, ["rivalry", "star_spotlight", "fan_culture", "tactical_debate"], "rivalry"),
    supportTeam,
    opposition: supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam,
    content: generated,
    funFacts: includeFun ? localizedFacts : [],
    hotTakes: match.hotTakes,
    trending: match.tags
  };
}

function buildPageIntelFallback(page, language, context = {}) {
  const fixtureLabel = sanitizeText(context.fixtureLabel) || "tonight's fixture";
  const scope = context.scope === "recent" ? "recent" : "upcoming";
  const bundles = {
    en: {
      fixtures: {
        title: scope === "recent" ? "Replay the latest football swing" : "Open tonight's football board",
        copy:
          scope === "recent"
            ? "Jump from finished fixtures into the match page, then turn the sharpest angle into a recap or sponsor-ready package."
            : "Scan the next kickoffs, open one fixture, and move straight into match pages, creator flows, or live community actions.",
        chips: ["GMI matchday read", "Real fixture feed", "Open next click"]
      },
      match: {
        title: `Work the ${fixtureLabel} page like a real match hub`,
        copy: "Read the storyline, standings, and related fixtures, then route football traffic into rooms, watch parties, or sponsor inventory.",
        chips: ["Match context", "Community CTA", "Commerce CTA"]
      },
      community: {
        title: `Join the room moving around ${fixtureLabel}`,
        copy: "Open the room, react to the player storyline, and keep supporters moving into watch parties, polls, and repeat visits.",
        chips: ["Player-led rooms", "Live joins", "Repeat traffic"]
      },
      watchParties: {
        title: `Turn ${fixtureLabel} heat into reservations`,
        copy: "Use the football moment while it is live, push fans into local screenings, and capture real seat demand instead of static intent.",
        chips: ["Seat inventory", "Local events", "Real bookings"]
      },
      partners: {
        title: "Sell sponsor inventory beside football intent",
        copy: "Place sponsor offers beside match pages, fan rooms, and watch guides so brands buy exposure tied to real football traffic.",
        chips: ["Brand-safe reach", "Lead capture", "Football commerce"]
      },
      growth: {
        title: "Operate growth like a football product",
        copy:
          "Track channels, SEO surfaces, referral loops, and matchday conversion so World Cup traffic keeps returning after kickoff.",
        chips: ["Growth board", "SEO surfaces", "Referral loop"]
      }
    },
    zh: {
      fixtures: {
        title: scope === "recent" ? "先看刚结束的比赛走势" : "先打开今晚的足球赛程",
        copy:
          scope === "recent"
            ? "从最近结果进入比赛页，再把最强角度直接做成复盘、短视频或赞助内容。"
            : "先看下一批开球比赛，再顺着比赛页、生成台和社区页一路往下走。",
        chips: ["GMI 比赛情报", "真实赛程", "下一步动作"]
      },
      match: {
        title: `把 ${fixtureLabel} 当成真实比赛页来运营`,
        copy: "先看故事线、积分榜和关联比赛，再把高意图流量导向球迷房、观赛活动或赞助位。",
        chips: ["比赛上下文", "社区入口", "商业入口"]
      },
      community: {
        title: `围绕 ${fixtureLabel} 进入有热度的球迷房`,
        copy: "先进入房间、跟进球星话题，再把支持者继续导向投票、观赛活动和二次打开。",
        chips: ["球星主线", "实时加入", "持续回访"]
      },
      watchParties: {
        title: `把 ${fixtureLabel} 的热度转成预约`,
        copy: "趁比赛热度还在，把球迷导向本地观赛活动，拿到真实座位需求，而不是停留在点击意向。",
        chips: ["座位库存", "本地活动", "真实预约"]
      },
      partners: {
        title: "把赞助资源挂在真实足球流量旁边",
        copy: "把赞助合作放在比赛页、球迷房和观赛指南旁边，让品牌买到的是足球场景里的真实曝光。",
        chips: ["品牌安全", "线索收集", "足球变现"]
      },
      growth: {
        title: "像真实足球产品一样做增长",
        copy: "把渠道、SEO 页面、推荐裂变和比赛日转化放进同一块增长看板里持续优化。",
        chips: ["增长看板", "SEO 页面", "裂变循环"]
      }
    }
  };

  return cloneValue((bundles[language] || bundles.en)[page] || bundles.en.fixtures);
}

function buildPageIntelPrompt(page, language, context = {}) {
  const fixtureLabel = sanitizeText(context.fixtureLabel) || "tonight's fixture";
  const scope = context.scope === "recent" ? "recent" : "upcoming";

  if (language === "zh") {
    const prompts = {
      fixtures: {
        title: `为足球赛程页写一个中文标题，围绕${scope === "recent" ? "最近比赛结果" : "今晚赛程"}，12字以内，像真实体育产品标题，不像路演文案。`,
        copy: `为足球赛程页写一句中文用户提示，围绕${scope === "recent" ? "最近结果" : "即将开球的比赛"}、下一步点击和真实使用场景，26字以内，不要讲产品理念。`
      },
      match: {
        title: `为足球比赛详情页写一个中文标题，围绕${fixtureLabel}，14字以内，像真实体育 App。`,
        copy: "为足球比赛详情页写一句中文引导，包含比赛信息、后续动作或球迷互动，28字以内，语气直接。"
      },
      community: {
        title: `为足球球迷房页面写一个中文标题，围绕${fixtureLabel}或球迷热度，14字以内。`,
        copy: "写一句中文社区引导，让用户知道可以进房间、看球星话题、继续去观赛活动，28字以内。"
      },
      watchParties: {
        title: `为足球观赛活动页写一个中文标题，围绕${fixtureLabel}和线下观赛，14字以内。`,
        copy: "写一句中文预约引导，让用户知道可以选场地、订座位、继续参与足球活动，28字以内。"
      },
      partners: {
        title: "为足球赞助合作页写一个中文标题，围绕品牌曝光与比赛流量，14字以内。",
        copy: "写一句中文商业引导，让品牌知道这里能买到真实比赛流量和转化入口，28字以内。"
      },
      growth: {
        title: "为足球增长页写一个中文标题，围绕世界杯增长、SEO和裂变，14字以内。",
        copy: "写一句中文增长引导，包含渠道、SEO页面和会员裂变，28字以内，像真实运营后台。"
      }
    };

    return prompts[page] || prompts.fixtures;
  }

  const prompts = {
    fixtures: {
      title: `Write one short English title for a football fixtures page focused on ${scope} matches. Max 8 words. Product tone only.`,
      copy: "Write one short English sentence for a football fixtures page that tells users what to click next. Max 20 words. No pitch language."
    },
    match: {
      title: `Write one short English title for a football match page about ${fixtureLabel}. Max 9 words.`,
      copy: "Write one short English sentence for a football match page covering storyline, next click, or fan action. Max 20 words."
    },
    community: {
      title: `Write one short English title for a football fan room page linked to ${fixtureLabel}. Max 9 words.`,
      copy: "Write one short English sentence for a football community page telling fans to join, react, and keep moving. Max 20 words."
    },
    watchParties: {
      title: `Write one short English title for a football watch-party page linked to ${fixtureLabel}. Max 9 words.`,
      copy: "Write one short English sentence for a football watch-party page about reserving seats while match intent is hot. Max 20 words."
    },
    partners: {
      title: "Write one short English title for a football sponsor package page. Max 9 words.",
      copy: "Write one short English sentence for a football sponsor page about brand-safe matchday reach and conversion. Max 20 words."
    },
    growth: {
      title: "Write one short English title for a football growth operations page. Max 9 words.",
      copy: "Write one short English sentence for a football growth page about channels, SEO surfaces, and referral loops. Max 20 words."
    }
  };

  return prompts[page] || prompts.fixtures;
}

async function createPageIntel(page, language = "en", context = {}) {
  const fallback = buildPageIntelFallback(page, language, context);
  const cacheKey = JSON.stringify({
    page,
    language,
    fixtureLabel: sanitizeText(context.fixtureLabel),
    scope: sanitizeText(context.scope)
  });
  const cached = pageIntelCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cloneValue(cached.value);
  }

  if (!hasRemoteLlm()) {
    const value = {
      ...fallback,
      source: "template"
    };
    pageIntelCache.set(cacheKey, {
      expiresAt: Date.now() + 120000,
      value
    });
    return cloneValue(value);
  }

  const prompt = buildPageIntelPrompt(page, language, context);

  try {
    const [title, copy] = await Promise.all([
      callRemoteJsonField({
        key: "title",
        systemPrompt: 'Return JSON only like {"title":"..."} with a short football product headline.',
        userPrompt: prompt.title,
        maxTokens: 1200,
        scope: `page-intel:${page}`
      }),
      callRemoteJsonField({
        key: "copy",
        systemPrompt: 'Return JSON only like {"copy":"..."} with one direct football product sentence.',
        userPrompt: prompt.copy,
        maxTokens: 1200,
        scope: `page-intel:${page}`
      })
    ]);

    const value = {
      ...fallback,
      title: sanitizeText(title) || fallback.title,
      copy: sanitizeText(copy) || fallback.copy,
      source: "remote-llm"
    };

    pageIntelCache.set(cacheKey, {
      expiresAt: Date.now() + 120000,
      value
    });
    return cloneValue(value);
  } catch (error) {
    const value = {
      ...fallback,
      source: "template-fallback"
    };
    pageIntelCache.set(cacheKey, {
      expiresAt: Date.now() + 30000,
      value
    });
    return cloneValue(value);
  }
}

async function createDailyBriefing(language = "en") {
  const templates = {
    en: [
      { id: "messi", headline: "Messi watch: open the Argentina room before kickoff." },
      { id: "mbappe", headline: "Mbappe speedline: generate a creator pack for Spain vs France." },
      { id: "bellingham", headline: "Matchday crowd: turn player heat into watch-party demand." }
    ],
    zh: [
      { id: "messi", headline: "梅西观察：开球前先打开阿根廷球迷房。" },
      { id: "mbappe", headline: "姆巴佩速度线：一键生成西班牙 vs 法国创作者内容。" },
      { id: "bellingham", headline: "球星热度转化：把关注度直接导向观赛活动。" }
    ]
  };

  const prompts = [
    {
      id: "messi",
      prompt:
        language === "zh"
          ? "为首页写一条中文足球头条，围绕梅西、阿根廷球迷房和赛前热度，14字以内。"
          : "Write one short English football homepage headline about Lionel Messi, the Argentina fan room, and pre-match energy. Max 12 words."
    },
    {
      id: "mbappe",
      prompt:
        language === "zh"
          ? "为首页写一条中文足球头条，围绕姆巴佩、创作者内容和比赛日速度感，16字以内。"
          : "Write one short English football homepage headline about Kylian Mbappe, creator content, and matchday speed. Max 12 words."
    },
    {
      id: "bellingham",
      prompt:
        language === "zh"
          ? "为首页写一条中文足球头条，围绕贝林厄姆、观赛活动和球迷转化，16字以内。"
          : "Write one short English football homepage headline about Jude Bellingham, watch parties, and fan conversion. Max 12 words."
    }
  ];

  if (!hasRemoteLlm()) {
    return {
      items: templates[language] || templates.en,
      source: "template"
    };
  }

  try {
    const items = await Promise.all(
      prompts.map(async (entry) => ({
        id: entry.id,
        headline: await callRemoteJsonField({
          key: "headline",
          systemPrompt: 'Return JSON only like {"headline":"..."} with one short football homepage headline.',
          userPrompt: entry.prompt,
          maxTokens: 1200,
          scope: "homepage-briefing"
        })
      }))
    );

    return {
      items,
      source: "remote-llm"
    };
  } catch (error) {
    return {
      items: templates[language] || templates.en,
      source: "template-fallback"
    };
  }
}

async function createCampaign(payload) {
  const match = await resolveMatchPayload(payload);
  if (!match) {
    return { error: "Match not found" };
  }

  const campaign = {
    id: nextCampaignId(),
    match: {
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickOff: match.kickOff,
      city: match.city,
      stage: match.stage
    },
    supportTeam:
      payload.supportTeam === match.homeTeam || payload.supportTeam === match.awayTeam
        ? payload.supportTeam
        : match.homeTeam,
    language: sanitizeEnum(payload.language, ["en", "es", "id", "zh"], "en"),
    languageLabel: getBundle(payload.language).label,
    scene: sanitizeEnum(payload.scene, ["pre_match", "live", "post_match"], "pre_match"),
    targetMarket: sanitizeEnum(payload.targetMarket, ["sea", "latam", "global"], "global"),
    channel: sanitizeEnum(payload.channel, ["fan_community", "creator_short", "brand_social"], "fan_community"),
    angle: sanitizeEnum(payload.angle, ["rivalry", "star_spotlight", "fan_culture", "tactical_debate"], "rivalry"),
    includeFun: Boolean(payload.includeFun),
    generationSource: sanitizeText(payload.generationSource) || "template",
    generatedPollId: sanitizeText(payload.generatedPollId) || null,
    status: "draft",
    queueWindow: buildQueueWindow(match, sanitizeEnum(payload.scene, ["pre_match", "live", "post_match"], "pre_match")),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reviewedAt: null,
    queuedAt: null,
    exportedAt: null,
    content: normalizeCampaignContent(payload.content || {}),
    funFacts: toStringList(payload.funFacts || []).slice(0, 6),
    trending: sanitizeHashtags(payload.trending || [], []),
    hotTakes: toStringList(payload.hotTakes || []).slice(0, 6),
    activity: []
  };

  appendCampaignActivity(campaign, "campaign_created", {
    scene: campaign.scene,
    language: campaign.language,
    market: campaign.targetMarket
  });

  if (campaign.generatedPollId) {
    appendCampaignActivity(campaign, "poll_attached", {
      pollId: campaign.generatedPollId
    });
  }

  if (campaign.funFacts.length) {
    appendCampaignActivity(campaign, "facts_attached", {
      count: campaign.funFacts.length
    });
  }

  campaigns.set(campaign.id, campaign);
  persistCampaign(campaign);
  return { campaign: serializeCampaign(campaign) };
}

function updateCampaignDraft(campaign, payload) {
  const nextContent = normalizeCampaignContent(payload.content || {}, campaign.content);
  let changedFields = 0;

  ["headline", "socialPost", "videoScript", "recap", "chant"].forEach((field) => {
    if (campaign.content[field] !== nextContent[field]) {
      changedFields += 1;
    }
  });

  if (campaign.content.hashtags.join(" ") !== nextContent.hashtags.join(" ")) {
    changedFields += 1;
  }

  const nextMarket = sanitizeEnum(payload.targetMarket, ["sea", "latam", "global"], campaign.targetMarket);
  const nextChannel = sanitizeEnum(
    payload.channel,
    ["fan_community", "creator_short", "brand_social"],
    campaign.channel
  );
  const nextAngle = sanitizeEnum(
    payload.angle,
    ["rivalry", "star_spotlight", "fan_culture", "tactical_debate"],
    campaign.angle
  );

  if (nextMarket !== campaign.targetMarket) {
    changedFields += 1;
  }
  if (nextChannel !== campaign.channel) {
    changedFields += 1;
  }
  if (nextAngle !== campaign.angle) {
    changedFields += 1;
  }

  campaign.content = nextContent;
  campaign.targetMarket = nextMarket;
  campaign.channel = nextChannel;
  campaign.angle = nextAngle;
  campaign.status = "ready";
  campaign.reviewedAt = new Date().toISOString();
  appendCampaignActivity(campaign, "draft_saved", {
    changedFields
  });

  persistCampaign(campaign);
  return serializeCampaign(campaign);
}

function queueCampaign(campaign) {
  if (!campaign.reviewedAt) {
    campaign.reviewedAt = new Date().toISOString();
    appendCampaignActivity(campaign, "draft_saved", {
      changedFields: 0,
      auto: true
    });
  }

  campaign.status = "queued";
  campaign.queuedAt = new Date().toISOString();
  appendCampaignActivity(campaign, "queued", {
    channel: campaign.channel,
    queueWindow: campaign.queueWindow
  });

  persistCampaign(campaign);
  return serializeCampaign(campaign);
}

function exportCampaignBrief(campaign) {
  campaign.exportedAt = new Date().toISOString();
  appendCampaignActivity(campaign, "brief_exported", {
    format: "txt"
  });
  persistCampaign(campaign);

  return {
    filename: `${campaign.id}-brief.txt`,
    text: buildCampaignBrief(campaign),
    campaign: serializeCampaign(campaign)
  };
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildShareCard(match, payload) {
  const themes = {
    classic: ["#07111f", "#153157", "#ffd046"],
    energy: ["#0f2e16", "#1d7b4f", "#efff9a"],
    pulse: ["#280d36", "#6d2acb", "#ff8f3a"]
  };

  const themeKey = themes[payload.theme] ? payload.theme : "classic";
  const colors = themes[themeKey];
  const headline = escapeXml(payload.headline || `${payload.supportTeam || match.homeTeam} Matchday`);
  const caption = escapeXml(payload.caption || `${match.homeTeam} vs ${match.awayTeam}`);
  const supportTeam = escapeXml(payload.supportTeam || match.homeTeam);
  const language = escapeXml(getBundle(payload.language).label);
  const matchup = escapeXml(`${match.homeTeam} vs ${match.awayTeam}`);

  return {
    theme: themeKey,
    filename: `matchbuzz-${match.id}-${themeKey}.svg`,
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="${colors[0]}"/>
      <stop offset="0.5" stop-color="${colors[1]}"/>
      <stop offset="1" stop-color="#03060c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="32" fill="url(#bg)"/>
  <circle cx="1040" cy="124" r="168" fill="${colors[2]}" opacity="0.15"/>
  <circle cx="140" cy="560" r="200" fill="#ffffff" opacity="0.06"/>
  <text x="80" y="100" fill="#fff7d1" font-family="Avenir Next, Segoe UI, sans-serif" font-size="28" font-weight="700">MATCHBUZZ</text>
  <text x="80" y="182" fill="#ffffff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="64" font-weight="800">${headline}</text>
  <text x="80" y="246" fill="#d9e7ff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="30" font-weight="500">${caption}</text>
  <rect x="80" y="330" width="300" height="108" rx="24" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.12"/>
  <text x="112" y="375" fill="#eff4ff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="22" font-weight="700">SUPPORTED TEAM</text>
  <text x="112" y="418" fill="#ffffff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="34" font-weight="800">${supportTeam}</text>
  <rect x="404" y="330" width="300" height="108" rx="24" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.12"/>
  <text x="436" y="375" fill="#eff4ff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="22" font-weight="700">MATCHUP</text>
  <text x="436" y="418" fill="#ffffff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="34" font-weight="800">${matchup}</text>
  <rect x="728" y="330" width="212" height="108" rx="24" fill="${colors[2]}" fill-opacity="0.16" stroke="${colors[2]}" stroke-opacity="0.45"/>
  <text x="760" y="375" fill="#fff9d6" font-family="Avenir Next, Segoe UI, sans-serif" font-size="22" font-weight="700">LANGUAGE</text>
  <text x="760" y="418" fill="#ffffff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="34" font-weight="800">${language}</text>
  <text x="80" y="548" fill="#d9e7ff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="24" font-weight="600">Interactive World Cup content for fans, creators, and brand teams.</text>
  <text x="80" y="588" fill="${colors[2]}" font-family="Avenir Next, Segoe UI, sans-serif" font-size="28" font-weight="800">matchbuzz global football ops</text>
</svg>
    `.trim()
  };
}

function getSystemStatus() {
  return {
    appHost: APP_HOST,
    port: PORT,
    generation: {
      mode: hasRemoteLlm() ? "remote-llm" : "template",
      configured: hasRemoteLlm(),
      provider: CONFIG.llm.apiUrl ? "GMI Cloud Inference Engine" : "Local template fallback",
      apiUrlConfigured: Boolean(CONFIG.llm.apiUrl),
      modelConfigured: Boolean(CONFIG.llm.model),
      apiStyle: CONFIG.llm.apiStyle,
      model: CONFIG.llm.model || null
    },
    matchData: {
      mode: hasRemoteMatchData() ? "remote-data" : "local-fallback",
      configured: hasRemoteMatchData(),
      apiUrlConfigured: Boolean(CONFIG.matchData.apiUrl),
      apiStyle: CONFIG.matchData.apiStyle,
      cacheMs: CONFIG.matchData.cacheMs
    },
    realFixtures: {
      provider: "TheSportsDB",
      baseUrlConfigured: Boolean(CONFIG.realFixtures.baseUrl),
      leagueId: CONFIG.realFixtures.leagueId,
      season: CONFIG.realFixtures.season,
      cacheMs: CONFIG.realFixtures.cacheMs
    },
    campaigns: getCampaignCounts(),
    commerce: {
      communityRooms: communityRooms.size,
      watchParties: watchParties.size,
      sponsorPackages: sponsorPackages.size
    },
    membership: getMembershipStats(),
    llmUsage: getLlmUsageSummary(),
    ops: {
      latestLlmCalls: listRecentLlmCalls(12),
      latestMembers: listRecentMembers(8),
      latestLedger: listRecentMemberLedgerEntries(10),
      latestReservations: listRecentWatchPartyReservations(8),
      latestPointRedemptions: listRecentWatchPartyPointRedemptions(8),
      latestSponsorLeads: listRecentSponsorLeads(8)
    },
    storage: {
      provider: "SQLite",
      configured: Boolean(db),
      databasePath: DB_PATH,
      campaignsPersisted: campaigns.size,
      pollsPersisted: polls.size
    },
    requiredEnv: {
      llm: ["GMI_API_URL", "GMI_API_KEY", "GMI_MODEL"],
      matchData: ["MATCH_DATA_API_URL", "MATCH_DATA_API_KEY"],
      realFixtures: ["REAL_FIXTURE_API_URL", "REAL_FIXTURE_LEAGUE_ID", "REAL_FIXTURE_SEASON"]
    }
  };
}

function normalizeLlmUsage(usage) {
  return {
    promptTokens: Number(usage?.prompt_tokens || 0),
    completionTokens: Number(usage?.completion_tokens || 0),
    totalTokens: Number(usage?.total_tokens || 0),
    cachedTokens: Number(usage?.cached_read_input_tokens || usage?.prompt_tokens_details?.cached_tokens || 0)
  };
}

function recordLlmCallLog({ scope, fieldKey, model, status, latencyMs, usage, finishReason, responseId, errorMessage }) {
  if (!db) {
    return;
  }

  const normalizedUsage = normalizeLlmUsage(usage);
  db.prepare(
    `
      INSERT INTO llm_call_logs
      (scope, field_key, model, status, prompt_tokens, completion_tokens, total_tokens, cached_tokens, latency_ms, finish_reason, response_id, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    sanitizeText(scope).slice(0, 80) || "unknown",
    sanitizeText(fieldKey).slice(0, 80) || null,
    sanitizeText(model).slice(0, 160) || null,
    sanitizeText(status).slice(0, 40) || "unknown",
    normalizedUsage.promptTokens,
    normalizedUsage.completionTokens,
    normalizedUsage.totalTokens,
    normalizedUsage.cachedTokens,
    Math.max(0, Number(latencyMs || 0)),
    sanitizeText(finishReason).slice(0, 80) || null,
    sanitizeText(responseId).slice(0, 120) || null,
    sanitizeText(errorMessage).slice(0, 280) || null,
    new Date().toISOString()
  );
}

function getLlmUsageSummary() {
  if (!db) {
    return {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      lastCallAt: null,
      lastSuccessAt: null
    };
  }

  const row = db
    .prepare(
      `
        SELECT COUNT(*) AS total_calls,
               COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS success_calls,
               COALESCE(SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END), 0) AS failed_calls,
               COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
               COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
               COALESCE(SUM(total_tokens), 0) AS total_tokens,
               COALESCE(SUM(cached_tokens), 0) AS cached_tokens,
               MAX(created_at) AS last_call_at,
               MAX(CASE WHEN status = 'success' THEN created_at ELSE NULL END) AS last_success_at
        FROM llm_call_logs
      `
    )
    .get();

  return {
    totalCalls: Number(row?.total_calls || 0),
    successCalls: Number(row?.success_calls || 0),
    failedCalls: Number(row?.failed_calls || 0),
    promptTokens: Number(row?.prompt_tokens || 0),
    completionTokens: Number(row?.completion_tokens || 0),
    totalTokens: Number(row?.total_tokens || 0),
    cachedTokens: Number(row?.cached_tokens || 0),
    lastCallAt: row?.last_call_at || null,
    lastSuccessAt: row?.last_success_at || null
  };
}

function listRecentLlmCalls(limit = 12) {
  if (!db) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT id,
               scope,
               field_key,
               model,
               status,
               prompt_tokens,
               completion_tokens,
               total_tokens,
               cached_tokens,
               latency_ms,
               finish_reason,
               response_id,
               error_message,
               created_at
        FROM llm_call_logs
        ORDER BY id DESC
        LIMIT ?
      `
    )
    .all(Number(limit))
    .map((row) => ({
      id: Number(row.id || 0),
      scope: row.scope,
      fieldKey: row.field_key || null,
      model: row.model || null,
      status: row.status,
      promptTokens: Number(row.prompt_tokens || 0),
      completionTokens: Number(row.completion_tokens || 0),
      totalTokens: Number(row.total_tokens || 0),
      cachedTokens: Number(row.cached_tokens || 0),
      latencyMs: Number(row.latency_ms || 0),
      finishReason: row.finish_reason || null,
      responseId: row.response_id || null,
      errorMessage: row.error_message || null,
      createdAt: row.created_at
    }));
}

function listRecentMembers(limit = 8) {
  if (!db) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT child.member_number,
               child.display_name,
               child.email,
               child.favorite_team,
               child.locale,
               child.referral_code,
               child.points_balance,
               child.created_at,
               parent.display_name AS referred_by_name
        FROM members AS child
        LEFT JOIN members AS parent ON parent.id = child.referred_by_member_id
        ORDER BY datetime(child.created_at) DESC, child.member_number DESC
        LIMIT ?
      `
    )
    .all(Number(limit))
    .map((row) => ({
      memberNumber: Number(row.member_number || 0),
      displayName: row.display_name,
      email: row.email,
      favoriteTeam: row.favorite_team || null,
      locale: row.locale || "en",
      referralCode: row.referral_code,
      pointsBalance: Number(row.points_balance || 0),
      referredByName: row.referred_by_name || null,
      createdAt: row.created_at
    }));
}

function listRecentMemberLedgerEntries(limit = 10) {
  if (!db) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT ledger.id,
               ledger.event_code,
               ledger.points_delta,
               ledger.balance_after,
               ledger.note,
               ledger.created_at,
               member.member_number,
               member.display_name,
               member.email
        FROM member_points_ledger AS ledger
        INNER JOIN members AS member ON member.id = ledger.member_id
        ORDER BY ledger.id DESC
        LIMIT ?
      `
    )
    .all(Number(limit))
    .map((row) => ({
      id: Number(row.id || 0),
      eventCode: row.event_code,
      pointsDelta: Number(row.points_delta || 0),
      balanceAfter: Number(row.balance_after || 0),
      note: row.note || "",
      createdAt: row.created_at,
      memberNumber: Number(row.member_number || 0),
      displayName: row.display_name,
      email: row.email
    }));
}

function listRecentWatchPartyReservations(limit = 8) {
  if (!db) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT id,
               party_id,
               reservation_name,
               email,
               group_size,
               favorite_team,
               locale,
               confirmation_code,
               created_at
        FROM watch_party_reservations
        ORDER BY id DESC
        LIMIT ?
      `
    )
    .all(Number(limit))
    .map((row) => {
      const party = watchParties.get(row.party_id);
      return {
        id: Number(row.id || 0),
        partyId: row.party_id,
        partyTitle: party?.title || row.party_id,
        partyTitleZh: party?.titleZh || party?.title || row.party_id,
        reservationName: row.reservation_name,
        email: row.email,
        groupSize: Number(row.group_size || 0),
        favoriteTeam: row.favorite_team || null,
        locale: row.locale || "en",
        confirmationCode: row.confirmation_code,
        createdAt: row.created_at
      };
    });
}

function listRecentWatchPartyPointRedemptions(limit = 8) {
  if (!db) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT redemption.id,
               redemption.reservation_id,
               redemption.party_id,
               redemption.member_id,
               redemption.points_used,
               redemption.credit_count,
               redemption.estimated_discount_value,
               redemption.created_at,
               member.member_number,
               member.display_name
        FROM watch_party_point_redemptions AS redemption
        LEFT JOIN members AS member ON member.id = redemption.member_id
        ORDER BY redemption.id DESC
        LIMIT ?
      `
    )
    .all(Number(limit))
    .map((row) => {
      const party = watchParties.get(row.party_id);
      return {
        id: Number(row.id || 0),
        reservationId: Number(row.reservation_id || 0),
        partyId: row.party_id,
        partyTitle: party?.title || row.party_id,
        partyTitleZh: party?.titleZh || party?.title || row.party_id,
        memberId: row.member_id,
        memberNumber: Number(row.member_number || 0),
        displayName: row.display_name || null,
        pointsUsed: Number(row.points_used || 0),
        creditCount: Number(row.credit_count || 0),
        estimatedDiscountValue: Number(row.estimated_discount_value || 0),
        createdAt: row.created_at
      };
    });
}

function listRecentSponsorLeads(limit = 8) {
  if (!db) {
    return [];
  }

  return db
    .prepare(
      `
        SELECT id,
               package_id,
               company_name,
               contact_name,
               email,
               market,
               goal,
               fixture_id,
               locale,
               created_at
        FROM sponsor_leads
        ORDER BY id DESC
        LIMIT ?
      `
    )
    .all(Number(limit))
    .map((row) => {
      const item = sponsorPackages.get(row.package_id);
      return {
        id: Number(row.id || 0),
        packageId: row.package_id,
        packageName: item?.name || row.package_id,
        packageNameZh: item?.nameZh || item?.name || row.package_id,
        companyName: row.company_name,
        contactName: row.contact_name,
        email: row.email,
        market: row.market || null,
        goal: row.goal || null,
        fixtureId: row.fixture_id || null,
        locale: row.locale || "en",
        createdAt: row.created_at
      };
    });
}

function getWatchPartyReservationCount() {
  if (!db) {
    return 0;
  }

  const row = db.prepare("SELECT COUNT(*) AS total_count FROM watch_party_reservations").get();
  return Number(row?.total_count || 0);
}

function getSponsorLeadCount() {
  if (!db) {
    return 0;
  }

  const row = db.prepare("SELECT COUNT(*) AS total_count FROM sponsor_leads").get();
  return Number(row?.total_count || 0);
}

function safeParseUrlHost(value) {
  const raw = sanitizeText(value);
  if (!raw) {
    return "";
  }

  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch (error) {
    return raw.replace(/^https?:\/\//i, "").split("/")[0].replace(/^www\./, "");
  }
}

function normalizeTrafficMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((result, [key, entry]) => {
    const cleanKey = slugify(key).replace(/-/g, "_").slice(0, 32);
    const cleanValue = sanitizeText(entry).slice(0, 180);
    if (cleanKey && cleanValue) {
      result[cleanKey] = cleanValue;
    }
    return result;
  }, {});
}

function recordTrafficEvent(payload = {}) {
  if (!db) {
    return null;
  }

  const eventType = sanitizeEnum(sanitizeText(payload.eventType), TRAFFIC_EVENT_TYPES, "page_view");
  const event = {
    visitorId: sanitizeText(payload.visitorId).slice(0, 80),
    sessionId: sanitizeText(payload.sessionId).slice(0, 80),
    eventType,
    pageKey: sanitizeText(payload.pageKey).slice(0, 48),
    path: sanitizeText(payload.path).slice(0, 240) || "/",
    locale: sanitizeEnum(sanitizeText(payload.locale), ["en", "zh"], "en"),
    fixtureId: sanitizeText(payload.fixtureId).slice(0, 80),
    roomId: sanitizeText(payload.roomId).slice(0, 80),
    targetPath: sanitizeText(payload.targetPath).slice(0, 240),
    targetGroup: sanitizeText(payload.targetGroup).slice(0, 48),
    label: sanitizeText(payload.label).slice(0, 160),
    source: sanitizeText(payload.source).slice(0, 80) || "direct",
    medium: sanitizeText(payload.medium).slice(0, 80) || "none",
    campaignCode: sanitizeText(payload.campaign).slice(0, 120),
    contentCode: sanitizeText(payload.content).slice(0, 120),
    referrerHost: safeParseUrlHost(payload.referrerHost || payload.referrer),
    metadataJson: JSON.stringify(normalizeTrafficMetadata(payload.metadata)),
    createdAt: new Date().toISOString()
  };

  db.prepare(`
      INSERT INTO traffic_events (
        visitor_id,
        session_id,
        event_type,
        page_key,
        path,
        locale,
        fixture_id,
        room_id,
        target_path,
        target_group,
        label,
        source,
        medium,
        campaign_code,
        content_code,
        referrer_host,
        metadata_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
    event.visitorId,
    event.sessionId,
    event.eventType,
    event.pageKey,
    event.path,
    event.locale,
    event.fixtureId,
    event.roomId,
    event.targetPath,
    event.targetGroup,
    event.label,
    event.source,
    event.medium,
    event.campaignCode,
    event.contentCode,
    event.referrerHost,
    event.metadataJson,
    event.createdAt
  );

  return event;
}

function humanizeToken(value) {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getGrowthPageLabel(pageKey, language = "en") {
  const isZh = language === "zh";
  const labels = {
    home: isZh ? "首页" : "Homepage",
    matches: isZh ? "赛事页" : "Fixtures desk",
    match: isZh ? "比赛详情" : "Match detail",
    community: isZh ? "球迷房列表" : "Fan rooms",
    community_room: isZh ? "球迷房详情" : "Fan room detail",
    watch_parties: isZh ? "观赛活动" : "Watch parties",
    partners: isZh ? "赞助合作" : "Sponsor packages",
    growth: isZh ? "增长看板" : "Growth board",
    pricing: isZh ? "定价页" : "Pricing",
    about: isZh ? "项目介绍" : "About",
    campaign: isZh ? "活动详情" : "Campaign detail",
    auth: isZh ? "登录注册" : "Auth"
  };
  return labels[pageKey] || humanizeToken(pageKey || (isZh ? "未知页面" : "Unknown page"));
}

function getGrowthRouteLabel(targetGroup, language = "en") {
  const isZh = language === "zh";
  const labels = {
    studio: isZh ? "生成台" : "Studio",
    match: isZh ? "比赛详情" : "Match detail",
    matches: isZh ? "赛事页" : "Fixtures desk",
    community: isZh ? "球迷房" : "Fan rooms",
    room: isZh ? "房间详情" : "Room detail",
    watch: isZh ? "观赛活动" : "Watch parties",
    partners: isZh ? "赞助合作" : "Sponsor packages",
    growth: isZh ? "增长看板" : "Growth board",
    share: isZh ? "分享卡片" : "Share cards",
    auth: isZh ? "登录注册" : "Auth",
    campaign: isZh ? "活动工作区" : "Campaign workspace",
    external: isZh ? "外部跳转" : "External route",
    other: isZh ? "其他入口" : "Other route"
  };
  return labels[targetGroup] || humanizeToken(targetGroup || (isZh ? "其他入口" : "Other route"));
}

function buildFixtureLookup(items = []) {
  return items.reduce((result, fixture) => {
    if (fixture?.id) {
      result[fixture.id] = fixture;
    }
    return result;
  }, {});
}

function getTrafficOverview(language = "en", fixtureLookup = {}) {
  const isZh = language === "zh";
  if (!db) {
    return {
      kpis: [],
      channels: [],
      landings: [],
      routes: [],
      fixtures: [],
      recent: []
    };
  }

  const totals =
    db
      .prepare(`
        SELECT
          SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
          SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) AS cta_clicks,
          SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) AS conversions,
          SUM(CASE WHEN fixture_id IS NOT NULL AND fixture_id != '' THEN 1 ELSE 0 END) AS fixture_events,
          SUM(CASE WHEN event_type = 'cta_click' AND target_group IN ('watch', 'partners', 'campaign') THEN 1 ELSE 0 END) AS monetization_clicks
        FROM traffic_events
      `)
      .get() || {};
  const visitorRow =
    db
      .prepare(
        "SELECT COUNT(DISTINCT visitor_id) AS total_count FROM traffic_events WHERE event_type = 'page_view' AND visitor_id IS NOT NULL AND visitor_id != ''"
      )
      .get() || {};
  const trackedChannelsRow =
    db
      .prepare(
        "SELECT COUNT(DISTINCT COALESCE(NULLIF(source, ''), 'direct') || ':' || COALESCE(NULLIF(medium, ''), 'none')) AS total_count FROM traffic_events WHERE event_type = 'page_view'"
      )
      .get() || {};

  const pageViews = Number(totals.page_views || 0);
  const ctaClicks = Number(totals.cta_clicks || 0);
  const conversions = Number(totals.conversions || 0);
  const fixtureEvents = Number(totals.fixture_events || 0);
  const monetizationClicks = Number(totals.monetization_clicks || 0);
  const uniqueVisitors = Number(visitorRow.total_count || 0);
  const trackedChannels = Number(trackedChannelsRow.total_count || 0);
  const clickThroughRate = pageViews ? Math.round((ctaClicks / pageViews) * 100) : 0;
  const conversionAssistRate = ctaClicks ? Math.round((monetizationClicks / ctaClicks) * 100) : 0;

  const sourceRows = db
    .prepare(`
      SELECT
        COALESCE(NULLIF(source, ''), 'direct') AS source,
        COALESCE(NULLIF(medium, ''), 'none') AS medium,
        COUNT(*) AS total_count
      FROM traffic_events
      WHERE event_type = 'page_view'
      GROUP BY source, medium
      ORDER BY total_count DESC, source ASC
      LIMIT 6
    `)
    .all();

  const landingRows = db
    .prepare(`
      SELECT
        COALESCE(NULLIF(page_key, ''), 'unknown') AS page_key,
        COALESCE(NULLIF(path, ''), '/') AS path,
        COUNT(*) AS total_count,
        MAX(created_at) AS last_seen_at
      FROM traffic_events
      WHERE event_type = 'page_view'
      GROUP BY page_key, path
      ORDER BY total_count DESC, last_seen_at DESC
      LIMIT 8
    `)
    .all();

  const routeRows = db
    .prepare(`
      SELECT
        COALESCE(NULLIF(target_group, ''), 'other') AS target_group,
        COALESCE(NULLIF(target_path, ''), '') AS target_path,
        COALESCE(NULLIF(label, ''), '') AS label,
        COUNT(*) AS total_count
      FROM traffic_events
      WHERE event_type = 'cta_click'
      GROUP BY target_group, target_path, label
      ORDER BY total_count DESC
      LIMIT 8
    `)
    .all();

  const fixtureRows = db
    .prepare(`
      SELECT
        fixture_id,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) AS cta_clicks,
        COUNT(*) AS total_count
      FROM traffic_events
      WHERE fixture_id IS NOT NULL AND fixture_id != ''
      GROUP BY fixture_id
      ORDER BY total_count DESC, cta_clicks DESC
      LIMIT 6
    `)
    .all();

  const recentRows = db
    .prepare(`
      SELECT
        event_type,
        COALESCE(NULLIF(page_key, ''), 'unknown') AS page_key,
        COALESCE(NULLIF(path, ''), '/') AS path,
        COALESCE(NULLIF(target_group, ''), 'other') AS target_group,
        COALESCE(NULLIF(target_path, ''), '') AS target_path,
        COALESCE(NULLIF(label, ''), '') AS label,
        COALESCE(NULLIF(source, ''), 'direct') AS source,
        COALESCE(NULLIF(medium, ''), 'none') AS medium,
        fixture_id,
        created_at
      FROM traffic_events
      ORDER BY id DESC
      LIMIT 8
    `)
    .all();

  return {
    kpis: [
      {
        value: String(pageViews),
        label: isZh ? "已追踪访问" : "Tracked visits",
        note: isZh ? "已经被首页、赛事页和比赛页记录下来的真实页面访问。" : "Real page views captured from live product surfaces."
      },
      {
        value: String(uniqueVisitors),
        label: isZh ? "独立访客" : "Unique visitors",
        note: isZh ? "基于前端访客标识统计，不再只是页面点击总量。" : "Visitor-level tracking, not only raw page loads."
      },
      {
        value: String(ctaClicks),
        label: isZh ? "下一跳点击" : "Route clicks",
        note: isZh ? "用户从当前页继续点向生成台、球迷房、观赛和赞助页。" : "Users continued into studio, community, watch, and partner routes."
      },
      {
        value: `${clickThroughRate}%`,
        label: isZh ? "页面到动作转化" : "Page-to-action CTR",
        note: isZh ? "访问到关键下一步点击的转化效率。" : "How often traffic turns into the next meaningful click."
      },
      {
        value: String(fixtureEvents),
        label: isZh ? "赛事相关事件" : "Fixture-scoped events",
        note: isZh ? "带着具体比赛上下文进入或继续操作的行为。" : "Traffic and clicks that stayed attached to a specific fixture."
      },
      {
        value: String(trackedChannels),
        label: isZh ? "有效渠道组合" : "Tracked channels",
        note: isZh ? "已经被 UTM 或来源识别出来的渠道组合数量。" : "Distinct source and medium combinations already tracked."
      }
    ],
    channels: sourceRows.map((row) => {
      const total = Number(row.total_count || 0);
      const share = pageViews ? Math.round((total / pageViews) * 100) : 0;
      const sourceLabel = row.source === "direct" ? (isZh ? "直接访问" : "Direct") : row.source;
      const mediumLabel = row.medium === "none" ? (isZh ? "自然进入" : "No medium") : row.medium;
      return {
        title: `${sourceLabel} / ${mediumLabel}`,
        metric: `${total} · ${share}%`,
        note: isZh ? "当前被记录到的访问来源组合。" : "Current traffic source and medium mix.",
        href: ""
      };
    }),
    landings: landingRows.map((row) => ({
      title: getGrowthPageLabel(row.page_key, language),
      metric: String(Number(row.total_count || 0)),
      note: isZh
        ? `路由 ${row.path} 正在承接真实访问。`
        : `${row.path} is already receiving real traffic.`,
      href: row.path
    })),
    routes: routeRows.map((row) => ({
      title: row.label || getGrowthRouteLabel(row.target_group, language),
      metric: String(Number(row.total_count || 0)),
      note: isZh
        ? `最常见去向：${getGrowthRouteLabel(row.target_group, language)}`
        : `Most-used next route: ${getGrowthRouteLabel(row.target_group, language)}`,
      href: row.target_path
    })),
    fixtures: fixtureRows.map((row) => {
      const fixture = fixtureLookup[row.fixture_id] || null;
      const fixtureTitle = fixture ? `${fixture.homeTeam} vs ${fixture.awayTeam}` : row.fixture_id;
      const href = fixture ? `/match.html?id=${encodeURIComponent(fixture.id)}` : `/match.html?id=${encodeURIComponent(row.fixture_id)}`;
      return {
        title: fixtureTitle,
        metric: `${Number(row.total_count || 0)}`,
        note: isZh
          ? `${Number(row.page_views || 0)} 次进入，${Number(row.cta_clicks || 0)} 次后续动作。`
          : `${Number(row.page_views || 0)} visits and ${Number(row.cta_clicks || 0)} next actions.`,
        href: isZh ? `/zh${href}` : href
      };
    }),
    recent: recentRows.map((row) => {
      const fixture = row.fixture_id ? fixtureLookup[row.fixture_id] || null : null;
      const baseTitle =
        row.event_type === "conversion"
          ? row.label || (isZh ? "完成转化动作" : "Conversion completed")
          : row.event_type === "cta_click"
            ? row.label || getGrowthRouteLabel(row.target_group, language)
            : getGrowthPageLabel(row.page_key, language);
      const baseNote =
        row.event_type === "page_view"
          ? isZh
            ? `${row.source} / ${row.medium} 进入 ${row.path}`
            : `${row.source} / ${row.medium} landed on ${row.path}`
          : row.event_type === "cta_click"
            ? isZh
              ? `点击进入 ${row.target_path || getGrowthRouteLabel(row.target_group, language)}`
              : `Clicked through to ${row.target_path || getGrowthRouteLabel(row.target_group, language)}`
            : isZh
              ? "真实业务动作已经写入后端。"
              : "A real product action was written into the backend.";
      return {
        title: fixture ? `${baseTitle} · ${fixture.homeTeam} vs ${fixture.awayTeam}` : baseTitle,
        note: baseNote,
        href: row.target_path || row.path,
        timestamp: row.created_at
      };
    }),
    summary: {
      pageViews,
      ctaClicks,
      conversions,
      conversionAssistRate,
      uniqueVisitors
    }
  };
}

function buildGrowthDispatch(language = "en") {
  const isZh = language === "zh";
  const items = listCampaignSummaries();
  const queuedCount = items.filter((entry) => entry.status === "queued").length;
  const readyCount = items.filter((entry) => entry.status === "ready").length;

  return {
    kpis: [
      {
        value: String(items.length),
        label: isZh ? "已保存活动" : "Saved campaigns",
        note: isZh ? "从首页生成台里创建并保留下来的真实活动工作区。" : "Campaign workspaces created from the live studio."
      },
      {
        value: String(readyCount),
        label: isZh ? "待处理草稿" : "Ready drafts",
        note: isZh ? "已经生成并可继续编辑、分发的内容包。" : "Generated packages ready for editing or dispatch."
      },
      {
        value: String(queuedCount),
        label: isZh ? "分发队列" : "Queued dispatches",
        note: isZh ? "已经进入下一步发布或分发队列的活动数。" : "Packages already pushed into the next publish queue."
      }
    ],
    queue: items.slice(0, 6).map((entry) => ({
      title: `${entry.matchLabel} · ${entry.id}`,
      metric: humanizeToken(entry.status),
      note: isZh
        ? `${humanizeToken(entry.scene)} · ${humanizeToken(entry.channel)} · ${entry.language.toUpperCase()}`
        : `${humanizeToken(entry.scene)} · ${humanizeToken(entry.channel)} · ${entry.language.toUpperCase()}`,
      href: `${isZh ? "/zh/campaign.html" : "/campaign.html"}?id=${encodeURIComponent(entry.id)}`
    }))
  };
}

function buildPublicBaseUrl(req) {
  if (SITE_URL) {
    return SITE_URL;
  }

  const forwardedProto = sanitizeText(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const forwardedHost = sanitizeText(req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const host = forwardedHost || sanitizeText(req.headers.host || `${APP_HOST}:${PORT}`);
  const proto = forwardedProto === "https" ? "https" : "http";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function joinPublicUrl(baseUrl, pathname) {
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

async function buildGrowthOverview(language = "en") {
  const membership = getMembershipStats();
  const llmUsage = getLlmUsageSummary();
  const reservationCount = getWatchPartyReservationCount();
  const sponsorLeadCount = getSponsorLeadCount();
  const rooms = listCommunityRooms();
  const watchPartiesList = listWatchPartyItems();
  const sponsorPackageList = listSponsorPackageItems();

  let upcomingFixtures = [];
  let recentFixtures = [];
  try {
    [upcomingFixtures, recentFixtures] = await Promise.all([
      fetchRealFixturesFeed("upcoming"),
      fetchRealFixturesFeed("recent")
    ]);
  } catch (error) {
    upcomingFixtures = [];
    recentFixtures = [];
  }

  const isZh = language === "zh";
  const fixtureLookup = buildFixtureLookup(upcomingFixtures.concat(recentFixtures));
  const traffic = getTrafficOverview(language, fixtureLookup);
  const dispatch = buildGrowthDispatch(language);
  const upcomingCount = upcomingFixtures.length;
  const recentCount = recentFixtures.length;
  const indexableSurfaceCount =
    16 + rooms.length * 2 + watchPartiesList.length * 2 + sponsorPackageList.length * 2 + (upcomingCount + recentCount) * 2;
  const referralRate = membership.memberCount
    ? Math.round((membership.referralMembers / membership.memberCount) * 100)
    : 0;
  const redemptionRate = membership.totalPointsIssued
    ? Math.round((membership.totalPointsRedeemed / membership.totalPointsIssued) * 100)
    : 0;
  const activeSessionRate = membership.memberCount
    ? Math.round((membership.activeSessions / membership.memberCount) * 100)
    : 0;
  const commerceActionCount = reservationCount + sponsorLeadCount;
  const commerceActionRate = membership.memberCount
    ? Math.round((commerceActionCount / membership.memberCount) * 100)
    : 0;

  const sampleFixture =
    upcomingFixtures[0] || recentFixtures[0] || { id: "", homeTeam: "Argentina", awayTeam: "Brazil" };
  const matchPath = isZh ? "/zh/match.html" : "/match.html";
  const roomPath = isZh ? "/zh/community-room.html" : "/community-room.html";
  const matchesPath = isZh ? "/zh/matches.html" : "/matches.html";
  const communityPath = isZh ? "/zh/community.html" : "/community.html";
  const watchPath = isZh ? "/zh/watch-parties.html" : "/watch-parties.html";
  const partnerPath = isZh ? "/zh/partners.html" : "/partners.html";
  const growthPath = isZh ? "/zh/growth.html" : "/growth.html";

  const text = isZh
    ? {
        kpis: [
          {
            value: String(membership.memberCount),
            label: "会员总量",
            note: "可以持续承接世界杯流量的真实账户池"
          },
          {
            value: String(membership.referralMembers),
            label: "推荐带来会员",
            note: "三级推荐树已经能放大传播"
          },
          {
            value: String(commerceActionCount),
            label: "商业动作",
            note: "观赛预约和赞助线索都能写入后台"
          },
          {
            value: String(llmUsage.totalTokens),
            label: "GMI Tokens",
            note: "增长页和首页内容会消耗真实模型调用"
          },
          {
            value: String(indexableSurfaceCount),
            label: "可索引页面面",
            note: "赛程、详情、球迷房和增长页都能进入 SEO 结构"
          }
        ],
        focusMetrics: [
          {
            value: `${referralRate}%`,
            label: "邀请转化信号",
            note: "推荐注册会员占全部会员的比例"
          },
          {
            value: `${activeSessionRate}%`,
            label: "二次使用信号",
            note: "活跃会话占会员总量的比例"
          },
          {
            value: `${redemptionRate}%`,
            label: "积分兑换率",
            note: "已发积分中已经产生消费闭环的比例"
          },
          {
            value: `${commerceActionRate}%`,
            label: "商业动作率",
            note: "预约和赞助线索对会员池的转化强度"
          }
        ],
        seo: {
          title: "SEO 页面结构",
          surfaces: [
            {
              label: "赛程入口页",
              count: upcomingCount + recentCount,
              path: matchesPath,
              note: "用即将开始和刚结束的比赛，承接搜索与热点进入流量。"
            },
            {
              label: "比赛详情页",
              count: upcomingCount + recentCount,
              path: sampleFixture.id ? `${matchPath}?id=${encodeURIComponent(sampleFixture.id)}` : matchPath,
              note: "每一场比赛都可以继续导向球迷房、观赛和赞助位。"
            },
            {
              label: "球迷房落地页",
              count: rooms.length,
              path: rooms[0] ? `${roomPath}?id=${encodeURIComponent(rooms[0].id)}` : communityPath,
              note: "围绕球星和支持球队构建长期回访与互动。"
            },
            {
              label: "票务与活动页",
              count: watchPartiesList.length,
              path: watchPath,
              note: "把比赛意图直接拉到预约和抵扣动作。"
            },
            {
              label: "赞助合作页",
              count: sponsorPackageList.length,
              path: partnerPath,
              note: "承接品牌合作、广告库存和商业线索。"
            },
            {
              label: "增长与答辩页",
              count: 1,
              path: growthPath,
              note: "把渠道打法、裂变规则和 SEO 结构直接展示出来。"
            }
          ],
          checklist: [
            "英文页和中文页分别提供独立 title、description 和 hreflang。",
            "首页、增长页、赛程页和比赛页都补了结构化数据。",
            "auth / admin 已设置 noindex，避免内部页被搜索引擎收录。",
            "robots.txt 和 sitemap.xml 已接到服务端路由，部署后可以直接被抓取。",
            "重要页面都加入内链，搜索流量可以继续走到互动与变现模块。"
          ]
        }
      }
    : {
        kpis: [
          {
            value: String(membership.memberCount),
            label: "Members live",
            note: "The account layer that can keep World Cup traffic returning"
          },
          {
            value: String(membership.referralMembers),
            label: "Referral signups",
            note: "New members already coming through the three-level invite tree"
          },
          {
            value: String(commerceActionCount),
            label: "Commerce actions",
            note: "Watch-party reservations and sponsor leads written into the backend"
          },
          {
            value: String(llmUsage.totalTokens),
            label: "GMI tokens",
            note: "Homepage and growth workflows are consuming real model calls"
          },
          {
            value: String(indexableSurfaceCount),
            label: "Indexable surfaces",
            note: "Fixtures, match pages, fan rooms, and growth pages inside the SEO map"
          }
        ],
        focusMetrics: [
          {
            value: `${referralRate}%`,
            label: "Invite conversion signal",
            note: "Share of members who arrived through referrals"
          },
          {
            value: `${activeSessionRate}%`,
            label: "Repeat-use signal",
            note: "Active sessions versus total member base"
          },
          {
            value: `${redemptionRate}%`,
            label: "Reward redemption",
            note: "How much issued points are already tied to real benefits"
          },
          {
            value: `${commerceActionRate}%`,
            label: "Commerce action rate",
            note: "Reservations and sponsor leads relative to the member pool"
          }
        ],
        seo: {
          title: "SEO landing architecture",
          surfaces: [
            {
              label: "Fixtures entry pages",
              count: upcomingCount + recentCount,
              path: matchesPath,
              note: "Upcoming and recent fixtures hold discovery traffic across the full matchday cycle."
            },
            {
              label: "Match detail pages",
              count: upcomingCount + recentCount,
              path: sampleFixture.id ? `${matchPath}?id=${encodeURIComponent(sampleFixture.id)}` : matchPath,
              note: "Each fixture detail page can carry fans into rooms, commerce, and sponsor actions."
            },
            {
              label: "Fan-room landing pages",
              count: rooms.length,
              path: rooms[0] ? `${roomPath}?id=${encodeURIComponent(rooms[0].id)}` : communityPath,
              note: "Player and club rooms create repeat traffic around stars fans already follow."
            },
            {
              label: "Ticket and event pages",
              count: watchPartiesList.length,
              path: watchPath,
              note: "Search traffic can continue directly into reservations and point-based ticket credit."
            },
            {
              label: "Sponsor package pages",
              count: sponsorPackageList.length,
              path: partnerPath,
              note: "Brand pages convert football traffic into monetizable sponsor intent."
            },
            {
              label: "Growth and pitch pages",
              count: 1,
              path: growthPath,
              note: "The growth board exposes channels, referral loops, and SEO logic as part of the product."
            }
          ],
          checklist: [
            "English and Chinese pages now ship their own title, description, and hreflang signals.",
            "Structured data has been added to the homepage, growth board, fixtures layer, and match hub.",
            "Auth and admin pages are explicitly marked noindex to keep internal pages out of search.",
            "robots.txt and sitemap.xml are served by the backend and are deployment-ready.",
            "Key pages now link deeper into interaction and monetization so SEO traffic can keep moving."
          ]
        }
      };

  return {
    intel: await createPageIntel("growth", language, {
      fixtureLabel: `${sampleFixture.homeTeam} vs ${sampleFixture.awayTeam}`
    }),
    kpis: text.kpis,
    focusMetrics: text.focusMetrics,
    traffic,
    dispatch,
    rules: buildMembershipRules(language),
    seo: text.seo
  };
}

function buildRobotsTxt(baseUrl) {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin.html",
    "Disallow: /zh/admin.html",
    "Disallow: /auth.html",
    "Disallow: /zh/auth.html",
    "Disallow: /api/",
    `Sitemap: ${joinPublicUrl(baseUrl, "/sitemap.xml")}`
  ].join("\n");
}

async function buildSitemapXml(baseUrl) {
  const currentDate = new Date().toISOString();
  const entries = [
    { loc: joinPublicUrl(baseUrl, "/"), priority: "1.0" },
    { loc: joinPublicUrl(baseUrl, "/zh/index.html"), priority: "1.0" },
    { loc: joinPublicUrl(baseUrl, "/growth.html"), priority: "0.9" },
    { loc: joinPublicUrl(baseUrl, "/zh/growth.html"), priority: "0.9" },
    { loc: joinPublicUrl(baseUrl, "/matches.html"), priority: "0.9" },
    { loc: joinPublicUrl(baseUrl, "/zh/matches.html"), priority: "0.9" },
    { loc: joinPublicUrl(baseUrl, "/community.html"), priority: "0.8" },
    { loc: joinPublicUrl(baseUrl, "/zh/community.html"), priority: "0.8" },
    { loc: joinPublicUrl(baseUrl, "/watch-parties.html"), priority: "0.8" },
    { loc: joinPublicUrl(baseUrl, "/zh/watch-parties.html"), priority: "0.8" },
    { loc: joinPublicUrl(baseUrl, "/partners.html"), priority: "0.7" },
    { loc: joinPublicUrl(baseUrl, "/zh/partners.html"), priority: "0.7" },
    { loc: joinPublicUrl(baseUrl, "/about.html"), priority: "0.6" },
    { loc: joinPublicUrl(baseUrl, "/zh/about.html"), priority: "0.6" }
  ];

  let upcomingFixtures = [];
  let recentFixtures = [];
  try {
    [upcomingFixtures, recentFixtures] = await Promise.all([
      fetchRealFixturesFeed("upcoming"),
      fetchRealFixturesFeed("recent")
    ]);
  } catch (error) {
    upcomingFixtures = [];
    recentFixtures = [];
  }

  upcomingFixtures.concat(recentFixtures).forEach((fixture) => {
    entries.push({
      loc: joinPublicUrl(baseUrl, `/match.html?id=${encodeURIComponent(fixture.id)}`),
      priority: "0.8"
    });
    entries.push({
      loc: joinPublicUrl(baseUrl, `/zh/match.html?id=${encodeURIComponent(fixture.id)}`),
      priority: "0.8"
    });
  });

  listCommunityRooms().forEach((room) => {
    entries.push({
      loc: joinPublicUrl(baseUrl, `/community-room.html?id=${encodeURIComponent(room.id)}`),
      priority: "0.7"
    });
    entries.push({
      loc: joinPublicUrl(baseUrl, `/zh/community-room.html?id=${encodeURIComponent(room.id)}`),
      priority: "0.7"
    });
  });

  const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.loc, entry])).values());
  const urls = uniqueEntries
    .map(
      (entry) => `
  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

async function handleApi(req, res, url) {
  if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/api/media/player-photo/")) {
    const playerId = sanitizeText(url.pathname.split("/")[4]).toLowerCase();
    if (req.method === "HEAD") {
      const sourceUrl = PLAYER_IMAGE_URLS[playerId];
      if (!sourceUrl) {
        res.writeHead(200, {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600"
        });
        res.end();
        return true;
      }

      try {
        const response = await fetch(sourceUrl, {
          method: "HEAD",
          headers: {
            "User-Agent": "MatchBuzz/1.0 (+player-photo-proxy)"
          }
        });
        const contentType = response.headers.get("content-type") || "image/jpeg";
        if (!contentType.startsWith("image/")) {
          throw new Error("Player photo provider returned non-image content");
        }
        res.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400"
        });
        res.end();
      } catch (error) {
        res.writeHead(200, {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600"
        });
        res.end();
      }
      return true;
    }

    await sendPlayerPhoto(res, playerId);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/news/football") {
    const limit = Math.max(3, Math.min(8, Number(url.searchParams.get("limit") || 6)));
    sendJson(res, 200, await fetchFootballNews(limit));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/briefing") {
    const language = sanitizeEnum(sanitizeText(url.searchParams.get("language")), ["en", "zh"], "en");
    sendJson(res, 200, await createDailyBriefing(language));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/system/status") {
    sendJson(res, 200, getSystemStatus());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/growth/overview") {
    const language = sanitizeEnum(sanitizeText(url.searchParams.get("language")), ["en", "zh"], "en");
    sendJson(res, 200, await buildGrowthOverview(language));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/traffic/events") {
    try {
      const payload = await parseBody(req);
      const event = recordTrafficEvent(payload);
      sendJson(res, 201, {
        success: true,
        event: event
          ? {
              eventType: event.eventType,
              path: event.path,
              createdAt: event.createdAt
            }
          : null
      });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/member/overview") {
    const language = sanitizeEnum(sanitizeText(url.searchParams.get("language")), ["en", "zh"], "en");
    const member = getAuthenticatedMember(req);
    sendJson(res, 200, buildMembershipOverview(language, member));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/matches") {
    const data = (await listMatches()).map((match) => ({
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickOff: match.kickOff,
      city: match.city,
      stage: match.stage,
      storyline: match.storyline,
      supportPollId: match.supportPollId
    }));
    sendJson(res, 200, {
      matches: data,
      source: hasRemoteMatchData() ? "remote-data-or-fallback" : "local-fallback"
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/matches/")) {
    const matchId = url.pathname.split("/")[3];
    const match = await getMatch(matchId);
    if (!match) {
      sendJson(res, 404, { error: "Match not found" });
      return true;
    }
    sendJson(res, 200, { match });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/fun-facts/")) {
    const matchId = url.pathname.split("/")[3];
    const match = await getMatch(matchId);
    if (!match) {
      sendJson(res, 404, { error: "Match not found" });
      return true;
    }
    const language = sanitizeText(url.searchParams.get("language")) || "en";
    sendJson(res, 200, { facts: getLocalizedFacts(match, language) });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/trending/")) {
    const matchId = url.pathname.split("/")[3];
    const match = await getMatch(matchId);
    if (!match) {
      sendJson(res, 404, { error: "Match not found" });
      return true;
    }
    sendJson(res, 200, { tags: match.tags, hotTakes: match.hotTakes });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/real/fixtures") {
    try {
      const scope = sanitizeText(url.searchParams.get("scope")) === "recent" ? "recent" : "upcoming";
      const language = sanitizeEnum(sanitizeText(url.searchParams.get("language")), ["en", "zh"], "en");
      const fixtures = await fetchRealFixturesFeed(scope);
      sendJson(res, 200, {
        scope,
        provider: "TheSportsDB",
        leagueId: CONFIG.realFixtures.leagueId,
        season: CONFIG.realFixtures.season,
        fixtures,
        intel: await createPageIntel("fixtures", language, {
          scope,
          fixtureLabel: fixtures[0] ? `${fixtures[0].homeTeam} vs ${fixtures[0].awayTeam}` : ""
        })
      });
    } catch (error) {
      sendJson(res, 502, { error: "Failed to load real fixtures", detail: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/real/fixtures/")) {
    try {
      const matchId = url.pathname.split("/")[4];
      const language = sanitizeEnum(sanitizeText(url.searchParams.get("language")), ["en", "zh"], "en");
      const detail = await getRealFixtureDetail(matchId);
      sendJson(res, 200, {
        provider: "TheSportsDB",
        leagueId: CONFIG.realFixtures.leagueId,
        season: CONFIG.realFixtures.season,
        ...detail,
        intel: await createPageIntel("match", language, {
          fixtureLabel: `${detail.fixture.homeTeam} vs ${detail.fixture.awayTeam}`
        })
      });
    } catch (error) {
      sendJson(res, 404, { error: "Real fixture not found", detail: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/campaigns") {
    sendJson(res, 200, {
      campaigns: listCampaignSummaries()
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/community/rooms") {
    const language = sanitizeEnum(sanitizeText(url.searchParams.get("language")), ["en", "zh"], "en");
    const fixtureLabel =
      sanitizeText(url.searchParams.get("fixtureLabel")) || listCommunityRooms()[0]?.fixtureLabel || "";
    sendJson(res, 200, {
      rooms: listCommunityRooms(),
      intel: await createPageIntel("community", language, {
        fixtureLabel
      })
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/community/rooms/") && !url.pathname.endsWith("/join")) {
    const roomId = url.pathname.split("/")[4];
    const room = communityRooms.get(roomId);
    if (!room) {
      sendJson(res, 404, { error: "Community room not found" });
      return true;
    }

    const language = sanitizeEnum(sanitizeText(url.searchParams.get("language")), ["en", "zh"], "en");
    sendJson(res, 200, {
      room: serializeCommunityRoom(room),
      intel: await createPageIntel("community", language, {
        fixtureLabel: room.fixtureLabel || room.fixtureLabelZh || room.title
      })
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/watch-parties") {
    const language = sanitizeEnum(sanitizeText(url.searchParams.get("language")), ["en", "zh"], "en");
    const fixtureLabel =
      sanitizeText(url.searchParams.get("fixtureLabel")) || listWatchPartyItems()[0]?.fixtureLabel || "";
    sendJson(res, 200, {
      parties: listWatchPartyItems(),
      intel: await createPageIntel("watchParties", language, {
        fixtureLabel
      })
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/watch-parties/") && !url.pathname.endsWith("/reserve")) {
    const partyId = url.pathname.split("/")[3];
    const party = watchParties.get(partyId);
    if (!party) {
      sendJson(res, 404, { error: "Watch party not found" });
      return true;
    }

    sendJson(res, 200, { party: cloneValue(party) });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/sponsor-packages") {
    const language = sanitizeEnum(sanitizeText(url.searchParams.get("language")), ["en", "zh"], "en");
    const fixtureLabel =
      sanitizeText(url.searchParams.get("fixtureLabel")) || listSponsorPackageItems()[0]?.name || "";
    sendJson(res, 200, {
      packages: listSponsorPackageItems(),
      intel: await createPageIntel("partners", language, {
        fixtureLabel
      })
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/sponsor-packages/")) {
    const packageId = url.pathname.split("/")[3];
    const item = sponsorPackages.get(packageId);
    if (!item) {
      sendJson(res, 404, { error: "Sponsor package not found" });
      return true;
    }

    sendJson(res, 200, { package: cloneValue(item) });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/campaigns/") && url.pathname.endsWith("/activity")) {
    const campaignId = url.pathname.split("/")[3];
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return true;
    }

    sendJson(res, 200, { activity: serializeCampaign(campaign).activity });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/campaigns/")) {
    const campaignId = url.pathname.split("/")[3];
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return true;
    }

    sendJson(res, 200, { campaign: serializeCampaign(campaign) });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/polls/") && url.pathname.endsWith("/results")) {
    const parts = url.pathname.split("/");
    const pollId = parts[3];
    const poll = polls.get(pollId);
    if (!poll) {
      sendJson(res, 404, { error: "Poll not found" });
      return true;
    }

    const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
    sendJson(res, 200, {
      poll: {
        id: poll.id,
        matchId: poll.matchId,
        question: poll.question,
        options: poll.options.map((option) => ({
          id: option.id,
          label: option.label,
          votes: option.votes,
          share: totalVotes === 0 ? 0 : Math.round((option.votes / totalVotes) * 100)
        })),
        totalVotes
      }
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/generate") {
    try {
      const payload = await parseBody(req);
      const moderation = moderateText(JSON.stringify(payload));
      if (!moderation.safe) {
        sendJson(res, 400, {
          error: "Unsafe request",
          hits: moderation.hits
        });
        return true;
      }

      const result = await createGeneratedContent({
        matchId: sanitizeText(payload.matchId),
        supportTeam: sanitizeText(payload.supportTeam),
        language: sanitizeText(payload.language) || "en",
        scene: sanitizeText(payload.scene),
        includeFun: Boolean(payload.includeFun),
        targetMarket: sanitizeText(payload.targetMarket),
        channel: sanitizeText(payload.channel),
        angle: sanitizeText(payload.angle),
        match: payload.match || null
      });

      if (result.error) {
        sendJson(res, 404, result);
        return true;
      }

      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    try {
      const payload = await parseBody(req);
      const language = sanitizeEnum(sanitizeText(payload.language || payload.locale), ["en", "zh"], "en");
      const result = createMemberAccount(payload, language);
      if (result.error) {
        sendJson(res, 400, result);
        return true;
      }

      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    try {
      const payload = await parseBody(req);
      const language = sanitizeEnum(sanitizeText(payload.language || payload.locale), ["en", "zh"], "en");
      const result = loginMemberAccount(payload, language);
      if (result.error) {
        sendJson(res, 401, result);
        return true;
      }

      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = extractBearerToken(req);
    if (token) {
      revokeSessionToken(token);
    }
    sendJson(res, 200, { success: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/member/check-in") {
    const member = getAuthenticatedMember(req);
    if (!member) {
      sendJson(res, 401, { error: "Unauthorized" });
      return true;
    }

    try {
      const payload = await parseBody(req);
      const language = sanitizeEnum(sanitizeText(payload.language || payload.locale || member.locale), ["en", "zh"], "en");
      const result = claimDailyCheckIn(member.id, language);
      if (result.error) {
        sendJson(res, 400, result);
        return true;
      }

      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/member/redeem") {
    const member = getAuthenticatedMember(req);
    if (!member) {
      sendJson(res, 401, { error: "Unauthorized" });
      return true;
    }

    try {
      const payload = await parseBody(req);
      const language = sanitizeEnum(sanitizeText(payload.language || payload.locale || member.locale), ["en", "zh"], "en");
      const result = redeemMemberReward(member.id, sanitizeText(payload.rewardId), language);
      if (result.error) {
        sendJson(res, 400, result);
        return true;
      }

      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/campaigns") {
    try {
      const payload = await parseBody(req);
      const result = await createCampaign({
        matchId: sanitizeText(payload.matchId),
        supportTeam: sanitizeText(payload.supportTeam),
        language: sanitizeText(payload.language) || "en",
        scene: sanitizeText(payload.scene),
        targetMarket: sanitizeText(payload.targetMarket),
        channel: sanitizeText(payload.channel),
        angle: sanitizeText(payload.angle),
        includeFun: Boolean(payload.includeFun),
        generationSource: sanitizeText(payload.generationSource),
        generatedPollId: sanitizeText(payload.generatedPollId),
        content: payload.content || {},
        funFacts: toStringList(payload.funFacts),
        trending: toStringList(payload.trending),
        hotTakes: toStringList(payload.hotTakes),
        match: payload.match || null
      });

      if (result.error) {
        sendJson(res, 404, result);
        return true;
      }

      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/campaigns/") && url.pathname.endsWith("/save-draft")) {
    try {
      const payload = await parseBody(req);
      const campaignId = url.pathname.split("/")[3];
      const campaign = campaigns.get(campaignId);
      if (!campaign) {
        sendJson(res, 404, { error: "Campaign not found" });
        return true;
      }

      sendJson(res, 200, {
        campaign: updateCampaignDraft(campaign, {
          content: payload.content || {},
          targetMarket: sanitizeText(payload.targetMarket),
          channel: sanitizeText(payload.channel),
          angle: sanitizeText(payload.angle)
        })
      });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/campaigns/") && url.pathname.endsWith("/queue")) {
    const campaignId = url.pathname.split("/")[3];
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return true;
    }

    sendJson(res, 200, { campaign: queueCampaign(campaign) });
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/campaigns/") && url.pathname.endsWith("/export-brief")) {
    const campaignId = url.pathname.split("/")[3];
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return true;
    }

    sendJson(res, 200, exportCampaignBrief(campaign));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/generate/share-card") {
    try {
      const payload = await parseBody(req);
      const match = await resolveMatchPayload({
        matchId: sanitizeText(payload.matchId),
        match: payload.match || null
      });
      if (!match) {
        sendJson(res, 404, { error: "Match not found" });
        return true;
      }

      const card = buildShareCard(match, {
        matchId: sanitizeText(payload.matchId),
        supportTeam: sanitizeText(payload.supportTeam),
        headline: sanitizeText(payload.headline),
        caption: sanitizeText(payload.caption),
        language: sanitizeText(payload.language) || "en",
        theme: sanitizeText(payload.theme)
      });

      sendJson(res, 200, card);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/polls") {
    try {
      const payload = await parseBody(req);
      const match = await resolveMatchPayload({
        matchId: sanitizeText(payload.matchId),
        match: payload.match || null
      });
      if (!match) {
        sendJson(res, 404, { error: "Match not found" });
        return true;
      }

      const options = Array.isArray(payload.options)
        ? payload.options.map((option, index) => ({
            id: `opt-${index + 1}`,
            label: sanitizeText(option).slice(0, 80) || `Option ${index + 1}`,
            votes: 0
          }))
        : [];

      const poll = {
        id: `poll-${Date.now()}`,
        matchId: match.id,
        question: sanitizeText(payload.question).slice(0, 160) || "What is your take on this match?",
        options: options.length > 1 ? options : polls.get(match.supportPollId).options.map((option) => ({ ...option })),
        createdAt: new Date().toISOString()
      };

      polls.set(poll.id, poll);
      persistPoll(poll);
      sendJson(res, 201, { pollId: poll.id });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/community/rooms/") && url.pathname.endsWith("/join")) {
    try {
      const payload = await parseBody(req);
      const roomId = url.pathname.split("/")[4];
      const room = communityRooms.get(roomId);
      if (!room) {
        sendJson(res, 404, { error: "Community room not found" });
        return true;
      }

      const result = joinCommunityRoom(room, payload, sanitizeText(payload.locale) || "en");
      if (result.error) {
        sendJson(res, 400, result);
        return true;
      }

      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/watch-parties/") && url.pathname.endsWith("/reserve")) {
    try {
      const payload = await parseBody(req);
      const partyId = url.pathname.split("/")[3];
      const party = watchParties.get(partyId);
      if (!party) {
        sendJson(res, 404, { error: "Watch party not found" });
        return true;
      }

      const member = getAuthenticatedMember(req);
      const locale = sanitizeEnum(sanitizeText(payload.locale || member?.locale), ["en", "zh"], member?.locale || "en");
      const result = reserveWatchPartyWithPoints(party, payload, locale, member);
      if (result.error) {
        sendJson(res, 400, result);
        return true;
      }

      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/sponsor-leads") {
    try {
      const payload = await parseBody(req);
      const packageId = sanitizeText(payload.packageId);
      const item = sponsorPackages.get(packageId);
      if (!item) {
        sendJson(res, 404, { error: "Sponsor package not found" });
        return true;
      }

      const result = createSponsorLead(item, payload, sanitizeText(payload.locale) || "en");
      if (result.error) {
        sendJson(res, 400, result);
        return true;
      }

      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/polls/") && url.pathname.endsWith("/vote")) {
    try {
      const payload = await parseBody(req);
      const pollId = url.pathname.split("/")[3];
      const poll = polls.get(pollId);
      if (!poll) {
        sendJson(res, 404, { error: "Poll not found" });
        return true;
      }

      const optionId = sanitizeText(payload.optionId);
      const option = poll.options.find((entry) => entry.id === optionId);
      if (!option) {
        sendJson(res, 404, { error: "Option not found" });
        return true;
      }

      option.votes += 1;
      persistPoll(poll);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/moderate") {
    try {
      const payload = await parseBody(req);
      sendJson(res, 200, moderateText(payload.text));
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/report") {
    try {
      const payload = await parseBody(req);
      sendJson(res, 201, {
        success: true,
        message: "Report received",
        reason: sanitizeText(payload.reason).slice(0, 120)
      });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  return false;
}

initStorage();

async function requestListener(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    try {
      const handled = await handleApi(req, res, url);
      if (!handled) {
        sendJson(res, 404, { error: "API route not found" });
      }
    } catch (error) {
      sendJson(res, 500, { error: "Internal server error", detail: error.message });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/robots.txt") {
    sendText(res, buildRobotsTxt(buildPublicBaseUrl(req)), "public, max-age=1800");
    return;
  }

  if (req.method === "GET" && url.pathname === "/sitemap.xml") {
    buildSitemapXml(buildPublicBaseUrl(req))
      .then((xml) => {
        sendXml(res, xml, "public, max-age=1800");
      })
      .catch((error) => {
        sendJson(res, 500, { error: "Failed to build sitemap", detail: error.message });
      });
    return;
  }

  const target = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(PUBLIC_DIR, path.normalize(target));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  sendFile(res, filePath);
}

if (require.main === module) {
  const server = http.createServer((req, res) => {
    requestListener(req, res);
  });

  server.listen(PORT, APP_HOST, () => {
    console.log(`MatchBuzz listening on http://${APP_HOST}:${PORT}`);
  });
}

module.exports = {
  requestListener
};

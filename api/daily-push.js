// api/daily-push.js — Vercel Cron Job (毎朝9時JST = UTC 0:00)
// vercel.json の schedule: "0 0 * * *" で自動実行
const line = require("@line/bot-sdk");

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});
const LIFF_URL = process.env.LIFF_URL || "https://liff.line.me/2009384132-D77yjbS4";

// ランダムに今日のおすすめシナリオを選ぶ
const SCENARIOS = [
  { key: "restaurant", label: "🍜 レストラン" },
  { key: "hotel",      label: "🏨 ホテル" },
  { key: "selfintro",  label: "👋 じこしょうかい" },
  { key: "shopping",   label: "🛍️ かいもの" },
  { key: "doctor",     label: "🏥 びょういん" },
  { key: "interview",  label: "💼 めんせつ" },
];

module.exports = async function handler(req, res) {
  // Vercel Cron の認証ヘッダーを検証
  if (req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 今日のおすすめ
  const today = new Date();
  const pick = SCENARIOS[today.getDay() % SCENARIOS.length];

  // ユーザーリストを取得
  let users = [];
  try {
    const r = await fetch(process.env.USERS_BLOB_URL || "");
    if (r.ok) users = await r.json();
  } catch (e) {
    console.error("load users error:", e);
  }

  if (users.length === 0) {
    return res.status(200).json({ pushed: 0, msg: "no users" });
  }

  const msgs = [
    {
      type: "text",
      text: `おはようございます！☀️\n今日も にほんごの 練習 をしましょう！🌸\n\n📌 今日の おすすめ: ${pick.label}\n\n毎日 すこしずつ が 上達への ちかみち です！💪`,
    },
    {
      type: "template",
      altText: "今日の練習スタート",
      template: {
        type: "buttons",
        text: `今日は「${pick.label}」から はじめよう 🎮`,
        actions: [{ type: "uri", label: "▶ 練習スタート", uri: LIFF_URL }],
      },
    },
  ];

  let pushed = 0;
  for (const uid of users) {
    try {
      await client.pushMessage(uid, msgs);
      pushed++;
      // Rate limit 対策
      await new Promise((r) => setTimeout(r, 100));
    } catch (e) {
      console.error("push error:", uid, e.message);
    }
  }

  res.status(200).json({ pushed, total: users.length });
};

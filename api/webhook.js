// api/webhook.js — LINE Messaging API Webhook
const line = require("@line/bot-sdk");
const { put, head, list } = require("@vercel/blob");

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const LIFF_URL = process.env.LIFF_URL || "https://liff.line.me/YOUR_LIFF_ID";
const client = new line.Client(config);

// ---- User ID ストレージ (Vercel Blob, 無料1GB) ----
async function loadUsers() {
  try {
    const res = await fetch(process.env.USERS_BLOB_URL || "");
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function saveUsers(users) {
  await put("users.json", JSON.stringify(users), {
    access: "public",
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

async function addUser(uid) {
  const users = await loadUsers();
  if (!users.includes(uid)) {
    users.push(uid);
    await saveUsers(users);
    // 初回保存後 URL を環境変数に保存する必要あり（手動 or Vercel API で設定）
  }
}

// ---- Webhook Handler ----
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK");

  // Signature 検証
  const signature = req.headers["x-line-signature"];
  const body = JSON.stringify(req.body);
  if (!line.validateSignature(body, config.channelSecret, signature)) {
    return res.status(401).send("Unauthorized");
  }

  const events = req.body.events || [];
  for (const event of events) {
    try {
      if (event.type === "follow") {
        await addUser(event.source.userId);
        await client.replyMessage(event.replyToken, [
          { type: "text", text: "🌸 ようこそ！にほんごれんしゅうBot へ！\n毎朝 9時に 練習リマインダーを お送りします 🔔" },
          {
            type: "template",
            altText: "今日の練習をはじめよう！",
            template: {
              type: "buttons",
              text: "今日のシナリオを えらんで ね 🎮",
              actions: [{ type: "uri", label: "▶ 練習スタート！", uri: LIFF_URL }],
            },
          },
        ]);
      } else if (event.type === "unfollow") {
        const users = await loadUsers();
        const updated = users.filter((u) => u !== event.source.userId);
        await saveUsers(updated);
      } else if (event.type === "message") {
        await addUser(event.source.userId);
        await client.replyMessage(event.replyToken, {
          type: "template",
          altText: "練習メニューを開く",
          template: {
            type: "buttons",
            title: "🌸 にほんごれんしゅう",
            text: "シナリオを えらんで 練習しよう！",
            actions: [{ type: "uri", label: "🎮 今すぐ練習する", uri: LIFF_URL }],
          },
        });
      }
    } catch (e) {
      console.error("event error:", e);
    }
  }
  res.status(200).json({ status: "ok" });
};

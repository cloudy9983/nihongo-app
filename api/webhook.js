// api/webhook.js — 修正版：手動讀取 raw body 解決 signature 驗證問題

const crypto = require("crypto");

// Vercel: 關閉自動 body parsing，改手動讀取 raw body
export const config = {
  api: { bodyParser: false },
};

const LIFF_URL = process.env.LIFF_URL || "https://liff.line.me/2009384132-D77yjbS4";
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SECRET = process.env.LINE_CHANNEL_SECRET;

// ---- 讀取 raw body ----
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ---- 驗證 LINE signature ----
function verifySignature(body, signature) {
  if (!SECRET) return true; // 開發模式跳過
  const hash = crypto
    .createHmac("sha256", SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

// ---- 發送 LINE 回覆 ----
async function replyMessage(replyToken, messages) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  const data = await res.json();
  if (!res.ok) console.error("Reply error:", JSON.stringify(data));
  return data;
}

// ---- 主要 Handler ----
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("LINE Webhook OK");
  }

  // 讀取 raw body
  const rawBody = await getRawBody(req);
  const signature = req.headers["x-line-signature"] || "";

  // Signature 驗證
  if (!verifySignature(rawBody, signature)) {
    console.error("Invalid signature");
    return res.status(401).send("Unauthorized");
  }

  // 解析 JSON
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).send("Bad Request");
  }

  const events = body.events || [];

  for (const event of events) {
    try {
      if (event.type === "follow") {
        // 加好友時的歡迎訊息
        await replyMessage(event.replyToken, [
          {
            type: "text",
            text: "🌸 ようこそ！にほんごれんしゅうへ！\n毎朝 9時に 練習リマインダーを お送りします 🔔",
          },
          {
            type: "template",
            altText: "練習をはじめよう！",
            template: {
              type: "buttons",
              text: "今日のシナリオを えらんで ね 🎮",
              actions: [
                {
                  type: "uri",
                  label: "▶ 練習スタート！",
                  uri: LIFF_URL,
                },
              ],
            },
          },
        ]);
      } else if (event.type === "message") {
        // 一般訊息時的回覆
        await replyMessage(event.replyToken, [
          {
            type: "template",
            altText: "練習メニューを開く",
            template: {
              type: "buttons",
              title: "🌸 にほんごれんしゅう",
              text: "シナリオを えらんで 練習しよう！",
              actions: [
                {
                  type: "uri",
                  label: "🎮 今すぐ練習する",
                  uri: LIFF_URL,
                },
              ],
            },
          },
        ]);
      }
    } catch (e) {
      console.error("Event error:", event.type, e.message);
    }
  }

  return res.status(200).json({ status: "ok" });
}

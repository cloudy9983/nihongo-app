// api/webhook.js — CommonJS 版本（最相容）

const crypto = require("crypto");

// 關閉 Vercel 的自動 body parser
module.exports.config = {
  api: { bodyParser: false },
};

const LIFF_URL = process.env.LIFF_URL || "https://liff.line.me/2009384132-D77yjbS4";
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SECRET = process.env.LINE_CHANNEL_SECRET;

// Raw body 讀取
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// LINE Signature 驗証
function verify(body, sig) {
  if (!SECRET || !sig) return false;
  const hash = crypto.createHmac("sha256", SECRET).update(body).digest("base64");
  return hash === sig;
}

// LINE Reply API
async function reply(replyToken, messages) {
  const r = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + ACCESS_TOKEN,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  const d = await r.json();
  if (!r.ok) console.error("LINE reply error:", JSON.stringify(d));
  return d;
}

module.exports = async function handler(req, res) {
  // GET テスト用
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, msg: "Webhook is alive!" });
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // Raw body 取得
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (e) {
    return res.status(500).json({ error: "body read failed" });
  }

  // Signature 検証
  const sig = req.headers["x-line-signature"];
  if (!verify(rawBody, sig)) {
    console.error("Signature mismatch. sig:", sig);
    return res.status(401).json({ error: "invalid signature" });
  }

  // JSON パース
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ error: "invalid json" });
  }

  const events = body.events || [];
  console.log("Events received:", events.length);

  for (const ev of events) {
    console.log("Event type:", ev.type);
    try {
      if (ev.type === "follow") {
        await reply(ev.replyToken, [
          { type: "text", text: "🌸 ようこそ！にほんごれんしゅうへ！\n毎朝9時に練習リマインダーを送ります 🔔" },
          {
            type: "template",
            altText: "練習をはじめよう！",
            template: {
              type: "buttons",
              text: "シナリオを えらんで ね 🎮",
              actions: [{ type: "uri", label: "▶ 練習スタート！", uri: LIFF_URL }],
            },
          },
        ]);
      } else if (ev.type === "message") {
        await reply(ev.replyToken, [{
          type: "template",
          altText: "練習メニューを開く",
          template: {
            type: "buttons",
            title: "🌸 にほんごれんしゅう",
            text: "シナリオを えらんで 練習しよう！",
            actions: [{ type: "uri", label: "🎮 今すぐ練習する", uri: LIFF_URL }],
          },
        }]);
      }
    } catch (e) {
      console.error("Handler error:", ev.type, e.message);
    }
  }

  return res.status(200).json({ ok: true });
};

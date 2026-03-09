const crypto = require("crypto");
module.exports.config = { api: { bodyParser: false } };

const LIFF_URL = "https://liff.line.me/2009384132-D77yjbS4";
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SECRET = process.env.LINE_CHANNEL_SECRET;

function getRawBody(req) {
  return new Promise((res, rej) => {
    const c = []; req.on("data", d => c.push(d));
    req.on("end", () => res(Buffer.concat(c).toString()));
    req.on("error", rej);
  });
}

module.exports = async function(req, res) {
  if (req.method === "GET") return res.json({ ok:true, url: LIFF_URL, token: !!TOKEN });
  const raw = await getRawBody(req);
  const sig = req.headers["x-line-signature"];
  const hash = crypto.createHmac("sha256", SECRET||"").update(raw).digest("base64");
  if (SECRET && hash !== sig) return res.status(401).end();
  const { events = [] } = JSON.parse(raw);
  for (const ev of events) {
    if (ev.type === "follow" || ev.type === "message") {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type":"application/json", "Authorization":"Bearer "+TOKEN },
        body: JSON.stringify({ replyToken: ev.replyToken, messages: [{
          type: "text",
          text: "🌸 にほんごれんしゅう へようこそ！\n\n👉 れんしゅうを はじめる:\n" + LIFF_URL
        }]})
      });
    }
  }
  res.json({ ok: true });
};

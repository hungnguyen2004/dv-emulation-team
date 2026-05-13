const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_QUARTERLY = process.env.DB_QUARTERLY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const headers = {
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };

  const txt = (val) => val?.rich_text?.[0]?.plain_text || "";
  const setTxt = (content) => ({ rich_text: [{ text: { content: content || "" } }] });

  try {
    if (req.method === "GET") {
      const { quarter } = req.query;
      const body = {
        filter: quarter ? { property: "Quý", rich_text: { equals: quarter } } : undefined,
      };
      const r = await fetch(`https://api.notion.com/v1/databases/${DB_QUARTERLY}/query`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      const data = await r.json();
      const reports = {};
      (data.results || []).forEach(p => {
        const uid = p.properties["Username"]?.rich_text?.[0]?.plain_text || "";
        if (!uid) return;
        reports[uid] = {
          notionId: p.id,
          quarter: txt(p.properties["Quý"]),
          username: uid,
          achievements: txt(p.properties["Thành tích"]),
          kpi: txt(p.properties["KPI"]),
          issues: txt(p.properties["Khó khăn"]),
          plan: txt(p.properties["Kế hoạch"]),
        };
      });
      return res.status(200).json(reports);
    }

    if (req.method === "POST") {
      const { quarter, username, achievements, kpi, issues, plan } = req.body;
      const qr = await fetch(`https://api.notion.com/v1/databases/${DB_QUARTERLY}/query`, {
        method: "POST", headers,
        body: JSON.stringify({
          filter: { and: [
            { property: "Quý", rich_text: { equals: quarter } },
            { property: "Username", rich_text: { equals: username } },
          ]},
        }),
      });
      const qdata = await qr.json();
      const existing = qdata.results?.[0];

      const properties = {
        "Quý": setTxt(quarter),
        "Username": setTxt(username),
        "Thành tích": setTxt(achievements),
        "KPI": setTxt(kpi),
        "Khó khăn": setTxt(issues),
        "Kế hoạch": setTxt(plan),
        "Tên": { title: [{ text: { content: `${username} - ${quarter}` } }] },
      };

      if (existing) {
        await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ properties }),
        });
      } else {
        await fetch("https://api.notion.com/v1/pages", {
          method: "POST", headers,
          body: JSON.stringify({ parent: { database_id: DB_QUARTERLY }, properties }),
        });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

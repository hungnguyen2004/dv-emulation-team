const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_TASKS = process.env.DB_TASKS;

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
      const { week } = req.query;
      const r = await fetch(`https://api.notion.com/v1/databases/${DB_TASKS}/query`, {
        method: "POST", headers,
        body: JSON.stringify({
          filter: { and: [
            { property: "Tuần", rich_text: { equals: week } },
            { property: "Kết quả", rich_text: { is_not_empty: true } },
          ]},
        }),
      });
      const data = await r.json();
      const reports = {};
      (data.results || []).forEach(p => {
        const uid = txt(p.properties["Assignee"]);
        if (!uid) return;
        reports[uid] = {
          notionId: p.id,
          completion: txt(p.properties["Kết quả"]),
          reason: "",
          plan: txt(p.properties["Đề xuất"]),
          status: p.properties["Status"]?.select?.name || "Hoàn thành",
        };
      });
      return res.status(200).json(reports);
    }

    if (req.method === "POST") {
      const { week, username, completion, reason, plan, status } = req.body;
      // Check existing
      const qr = await fetch(`https://api.notion.com/v1/databases/${DB_TASKS}/query`, {
        method: "POST", headers,
        body: JSON.stringify({
          filter: { and: [
            { property: "Tuần", rich_text: { equals: week } },
            { property: "Assignee", rich_text: { equals: username } },
            { property: "Kết quả", rich_text: { is_not_empty: true } },
          ]},
        }),
      });
      const qdata = await qr.json();
      const existing = qdata.results?.[0];

      const properties = {
        "Nội dung": { title: [{ text: { content: `${username} - ${week}` } }] },
        "Tuần": setTxt(week),
        "Assignee": setTxt(username),
        "Kết quả": setTxt(completion),
        "Đề xuất": setTxt(plan),
        "Status": { select: { name: status || "Hoàn thành" } },
      };

      if (existing) {
        await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ properties }),
        });
      } else {
        await fetch("https://api.notion.com/v1/pages", {
          method: "POST", headers,
          body: JSON.stringify({ parent: { database_id: DB_TASKS }, properties }),
        });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

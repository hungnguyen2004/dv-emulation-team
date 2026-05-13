const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_WEEKLY = process.env.DB_WEEKLY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
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
      const body = {
        filter: week ? { property: "Tuần", rich_text: { equals: week } } : undefined,
      };
      const r = await fetch(`https://api.notion.com/v1/databases/${DB_WEEKLY}/query`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      const data = await r.json();
      const reports = {};
      (data.results || []).forEach(p => {
        const uid = p.properties["Username"]?.rich_text?.[0]?.plain_text || "";
        if (!uid) return;
        reports[uid] = {
          notionId: p.id,
          week: txt(p.properties["Tuần"]),
          username: uid,
          completion: txt(p.properties["Kết quả hoàn thành"]),
          reason: txt(p.properties["Lý do chậm tiến độ"]),
          plan: txt(p.properties["Kế hoạch tuần sau"]),
          status: p.properties["Trạng thái"]?.select?.name || "Chưa nộp",
        };
      });
      return res.status(200).json(reports);
    }

    if (req.method === "POST") {
      // Create or update: check if exists first
      const { week, username, completion, reason, plan, status } = req.body;
      // Check existing
      const qr = await fetch(`https://api.notion.com/v1/databases/${DB_WEEKLY}/query`, {
        method: "POST", headers,
        body: JSON.stringify({
          filter: { and: [
            { property: "Tuần", rich_text: { equals: week } },
            { property: "Username", rich_text: { equals: username } },
          ]},
        }),
      });
      const qdata = await qr.json();
      const existing = qdata.results?.[0];

      const properties = {
        "Tuần": setTxt(week),
        "Username": setTxt(username),
        "Kết quả hoàn thành": setTxt(completion),
        "Lý do chậm tiến độ": setTxt(reason),
        "Kế hoạch tuần sau": setTxt(plan),
        "Trạng thái": { select: { name: status || "Hoàn thành" } },
        "Tên": { title: [{ text: { content: `${username} - ${week}` } }] },
      };

      let pageId;
      if (existing) {
        // Update
        await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ properties }),
        });
        pageId = existing.id;
      } else {
        // Create
        const cr = await fetch("https://api.notion.com/v1/pages", {
          method: "POST", headers,
          body: JSON.stringify({ parent: { database_id: DB_WEEKLY }, properties }),
        });
        const cdata = await cr.json();
        pageId = cdata.id;
      }
      return res.status(200).json({ ok: true, notionId: pageId });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

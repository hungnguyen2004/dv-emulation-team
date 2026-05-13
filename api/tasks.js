const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_TASKS = process.env.DB_TASKS;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const headers = {
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };

  try {
    if (req.method === "GET") {
      const { week } = req.query;
      const body = {
        filter: week ? { property: "Tuần", rich_text: { equals: week } } : undefined,
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
      };
      const r = await fetch(`https://api.notion.com/v1/databases/${DB_TASKS}/query`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      const data = await r.json();
      const tasks = (data.results || []).map(p => ({
        id: p.id,
        content: p.properties["Nội dung"]?.title?.[0]?.plain_text || "",
        week: p.properties["Tuần"]?.rich_text?.[0]?.plain_text || "",
        assignee: p.properties["Assignee"]?.rich_text?.[0]?.plain_text || "",
      }));
      return res.status(200).json(tasks);
    }

    if (req.method === "POST") {
      const { content, week, assignee } = req.body;
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers,
        body: JSON.stringify({
          parent: { database_id: DB_TASKS },
          properties: {
            "Nội dung": { title: [{ text: { content } }] },
            "Tuần": { rich_text: [{ text: { content: week } }] },
            "Assignee": { rich_text: [{ text: { content: assignee || "" } }] },
          },
        }),
      });
      const data = await r.json();
      return res.status(200).json({ id: data.id, content, week, assignee });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      await fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ archived: true }),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

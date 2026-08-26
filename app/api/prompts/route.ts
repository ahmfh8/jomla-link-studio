import { getDb } from "../../../db";

const DEFAULT_PROMPT = {
  id: "default-wholesale-square",
  name: "Wholesale Square – الافتراضي",
  content:
    "Act as an automated e-commerce catalog design engine. Analyze the attached product flyer image and generate a high-end 1:1 square wholesale marketing flyer. Preserve the exact physical product and visible dimensions. Add a bold Arabic title, exactly 3 Arabic feature callouts, 2 circular demonstration insets, the selected official logo at top-right, and a clean three-capsule footer containing [ITEM_NO], [PRICE] SAR, and [PCS]. Use a pure white background with purple accents. Output only one finished square catalog image.",
};

async function ensureDefault() {
  const sql = await getDb();
  const now = Date.now();
  await sql`INSERT INTO prompt_templates (id, name, content, created_at, updated_at)
    VALUES (${DEFAULT_PROMPT.id}, ${DEFAULT_PROMPT.name}, ${DEFAULT_PROMPT.content}, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING`;
}

export async function GET() {
  await ensureDefault();
  const sql = await getDb();
  const rows = await sql`SELECT id, name, content,
    created_at AS "createdAt", updated_at AS "updatedAt"
    FROM prompt_templates ORDER BY updated_at DESC`;
  return Response.json({ prompts: rows });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; content?: string };
    const name = body.name?.trim() || "";
    const content = body.content?.trim() || "";
    if (!name || content.length < 20)
      return Response.json(
        { error: "اكتب اسم البرومبت ومحتواه" },
        { status: 400 },
      );
    const now = Date.now();
    const row = {
      id: crypto.randomUUID(),
      name,
      content,
      createdAt: now,
      updatedAt: now,
    };
    const sql = await getDb();
    await sql`INSERT INTO prompt_templates (id, name, content, created_at, updated_at)
      VALUES (${row.id}, ${row.name}, ${row.content}, ${row.createdAt}, ${row.updatedAt})`;
    return Response.json({ prompt: row });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر حفظ البرومبت" },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      content?: string;
    };
    const id = body.id?.trim() || "";
    const name = body.name?.trim() || "";
    const content = body.content?.trim() || "";
    if (!id || !name || content.length < 20)
      return Response.json({ error: "بيانات البرومبت ناقصة" }, { status: 400 });
    const sql = await getDb();
    await sql`UPDATE prompt_templates SET name=${name}, content=${content},
      updated_at=${Date.now()} WHERE id=${id}`;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر تعديل البرومبت" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id)
      return Response.json({ error: "معرف البرومبت مطلوب" }, { status: 400 });
    const sql = await getDb();
    await sql`DELETE FROM prompt_templates WHERE id=${id}`;
    await ensureDefault();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر حذف البرومبت" },
      { status: 400 },
    );
  }
}

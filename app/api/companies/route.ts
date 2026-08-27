import { getDb } from "../../../db";

type CompanyRow = {
  id: string;
  name: string;
  next_number: string | number;
};

export async function GET() {
  try {
    const sql = await getDb();
    const rows = (await sql`SELECT
      company.id,
      company.name,
      COALESCE(counter.value + 1, 1001) AS next_number
    FROM catalog_companies company
    LEFT JOIN company_item_counters counter ON counter.company_id = company.id
    WHERE company.archived_at IS NULL
    ORDER BY company.created_at ASC`) as CompanyRow[];
    return Response.json({ companies: rows.map(companyJson) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر تحميل الشركات" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      startNumber?: number | string;
    };
    const name = String(payload.name || "").trim();
    const startNumber = Number(payload.startNumber || 1001);
    if (name.length < 2)
      return Response.json({ error: "اكتب اسم الشركة" }, { status: 400 });
    if (name.length > 80)
      return Response.json({ error: "اسم الشركة طويل جدًا" }, { status: 400 });
    if (!Number.isInteger(startNumber) || startNumber < 1 || startNumber > 999999999)
      return Response.json({ error: "الرقم التالي غير صالح" }, { status: 400 });
    const sql = await getDb();
    const existing = (await sql`SELECT
      company.id,
      company.name,
      COALESCE(counter.value + 1, 1001) AS next_number
    FROM catalog_companies company
    LEFT JOIN company_item_counters counter ON counter.company_id = company.id
    WHERE LOWER(company.name) = LOWER(${name})
      AND company.archived_at IS NULL
    LIMIT 1`) as CompanyRow[];
    if (existing[0]) return Response.json({ company: companyJson(existing[0]) });
    const archived = (await sql`SELECT
      company.id,
      company.name,
      COALESCE(counter.value + 1, 1001) AS next_number
    FROM catalog_companies company
    LEFT JOIN company_item_counters counter ON counter.company_id = company.id
    WHERE LOWER(company.name) = LOWER(${name})
      AND company.archived_at IS NOT NULL
    LIMIT 1`) as CompanyRow[];
    if (archived[0]) {
      const now = Date.now();
      await sql`UPDATE catalog_companies SET archived_at=NULL, updated_at=${now}
        WHERE id=${archived[0].id}`;
      return Response.json({ company: companyJson(archived[0]) });
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    const rows = (await sql`INSERT INTO catalog_companies (id, name, created_at, updated_at)
      VALUES (${id}, ${name}, ${now}, ${now})
      RETURNING id, name, ${startNumber} AS next_number`) as CompanyRow[];
    await sql`INSERT INTO company_item_counters (company_id, value)
      VALUES (${id}, ${startNumber - 1})`;
    return Response.json({ company: companyJson(rows[0]) }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر إضافة الشركة" },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as {
      id?: string;
      name?: string;
      nextNumber?: number | string;
    };
    const id = String(payload.id || "").trim();
    const name = String(payload.name || "").trim();
    const nextNumber = Number(payload.nextNumber);
    if (!id || name.length < 2 || name.length > 80)
      return Response.json({ error: "بيانات الشركة غير صالحة" }, { status: 400 });
    if (!Number.isInteger(nextNumber) || nextNumber < 1 || nextNumber > 999999999)
      return Response.json({ error: "الرقم التالي غير صالح" }, { status: 400 });
    const sql = await getDb();
    const issued = (await sql`SELECT COALESCE(MAX(visible_number), 0) AS max_number
      FROM issued_item_numbers WHERE company_id=${id}`) as Array<{
      max_number: string | number;
    }>;
    const maxIssued = Number(issued[0]?.max_number || 0);
    if (nextNumber <= maxIssued)
      return Response.json(
        { error: `يجب أن يكون الرقم التالي أكبر من آخر رقم مستخدم (${maxIssued})` },
        { status: 400 },
      );
    const now = Date.now();
    const rows = (await sql`UPDATE catalog_companies
      SET name=${name}, updated_at=${now}
      WHERE id=${id} AND archived_at IS NULL
      RETURNING id, name, ${nextNumber} AS next_number`) as CompanyRow[];
    if (!rows[0])
      return Response.json({ error: "الشركة غير موجودة" }, { status: 404 });
    await sql`INSERT INTO company_item_counters (company_id, value)
      VALUES (${id}, ${nextNumber - 1})
      ON CONFLICT(company_id) DO UPDATE SET value=${nextNumber - 1}`;
    return Response.json({ company: companyJson(rows[0]) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر تعديل الشركة" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: string };
    const id = String(payload.id || "").trim();
    if (!id)
      return Response.json({ error: "معرف الشركة مطلوب" }, { status: 400 });
    const sql = await getDb();
    const now = Date.now();
    const rows = (await sql`UPDATE catalog_companies
      SET archived_at=${now}, updated_at=${now}
      WHERE id=${id} AND archived_at IS NULL
      RETURNING id`) as Array<{ id: string }>;
    if (!rows[0])
      return Response.json({ error: "الشركة غير موجودة" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر حذف الشركة" },
      { status: 400 },
    );
  }
}

function companyJson(row: CompanyRow) {
  return {
    id: row.id,
    name: row.name,
    nextNumber: Number(row.next_number),
  };
}

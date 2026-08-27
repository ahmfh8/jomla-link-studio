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
    const payload = (await request.json()) as { name?: string };
    const name = String(payload.name || "").trim();
    if (name.length < 2)
      return Response.json({ error: "اكتب اسم الشركة" }, { status: 400 });
    if (name.length > 80)
      return Response.json({ error: "اسم الشركة طويل جدًا" }, { status: 400 });
    const sql = await getDb();
    const existing = (await sql`SELECT
      company.id,
      company.name,
      COALESCE(counter.value + 1, 1001) AS next_number
    FROM catalog_companies company
    LEFT JOIN company_item_counters counter ON counter.company_id = company.id
    WHERE LOWER(company.name) = LOWER(${name})
    LIMIT 1`) as CompanyRow[];
    if (existing[0]) return Response.json({ company: companyJson(existing[0]) });
    const id = crypto.randomUUID();
    const now = Date.now();
    const rows = (await sql`INSERT INTO catalog_companies (id, name, created_at, updated_at)
      VALUES (${id}, ${name}, ${now}, ${now})
      RETURNING id, name, 1001 AS next_number`) as CompanyRow[];
    return Response.json({ company: companyJson(rows[0]) }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر إضافة الشركة" },
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

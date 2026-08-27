"use client";
import { ChangeEvent, useMemo, useState } from "react";

type ExtractedItem = Record<string, string>;
type Job = {
  id: string;
  file: File;
  status: "ready" | "processing" | "done" | "error";
  error?: string;
  item?: ExtractedItem;
};

export default function SmartExtractMode() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateFields, setTemplateFields] = useState<string[]>([]);
  const [templateError, setTemplateError] = useState("");
  const [running, setRunning] = useState(false);
  const [resultUrls, setResultUrls] = useState<{
    xlsx: string;
    csv: string;
  } | null>(null);
  const [priceMode, setPriceMode] = useState<"piece" | "dozen">("piece");
  const completed = useMemo(
    () => jobs.filter((job) => job.status === "done").length,
    [jobs],
  );

  function loadImageFiles(incoming: File[]) {
    const files = incoming
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 100);
    setJobs(
      files.map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        file,
        status: "ready",
      })),
    );
    setResultUrls(null);
  }
  function loadImages(e: ChangeEvent<HTMLInputElement>) {
    loadImageFiles(Array.from(e.target.files || []));
    e.target.value = "";
  }
  async function loadTemplateFile(file?: File) {
    if (!file) return;
    setTemplateError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellStyles: true,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("القالب لا يحتوي على ورقة بيانات");
      const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
      });
      const headers = (
        table.find((row) => row.some((cell) => String(cell).trim())) || []
      )
        .map((cell) => String(cell).trim())
        .filter(Boolean);
      if (!headers.length) throw new Error("قالب Excel فارغ");
      setTemplateFile(file);
      setTemplateFields(headers);
      setResultUrls(null);
    } catch (error) {
      setTemplateFile(null);
      setTemplateFields([]);
      setTemplateError(
        error instanceof Error ? error.message : "تعذر قراءة القالب",
      );
    }
  }
  async function loadTemplate(e: ChangeEvent<HTMLInputElement>) {
    await loadTemplateFile(e.target.files?.[0]);
    e.target.value = "";
  }
  async function startExtraction() {
    if (!jobs.length || running) return;
    setRunning(true);
    setResultUrls(null);
    const extracted: ExtractedItem[] = [];
    for (const job of jobs) {
      setJobs((current) =>
        current.map((item) =>
          item.id === job.id
            ? { ...item, status: "processing", error: undefined }
            : item,
        ),
      );
      try {
        const image = await optimizeImage(job.file);
        const form = new FormData();
        form.append("image", image);
        form.append("priceMode", priceMode);
        const response = await fetch("/api/gemini/extract", {
          method: "POST",
          body: form,
        });
        const data = (await response.json()) as {
          item?: ExtractedItem;
          error?: string;
        };
        if (!response.ok || !data.item)
          throw new Error(data.error || "تعذر تحليل الصورة");
        extracted.push(data.item);
        setJobs((current) =>
          current.map((item) =>
            item.id === job.id
              ? { ...item, status: "done", item: data.item }
              : item,
          ),
        );
      } catch (error) {
        setJobs((current) =>
          current.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "تعذر تحليل الصورة",
                }
              : item,
          ),
        );
      }
    }
    if (extracted.length) {
      const files = await buildExportFiles(templateFile, extracted);
      setResultUrls({
        xlsx: URL.createObjectURL(files.xlsx),
        csv: URL.createObjectURL(files.csv),
      });
    }
    setRunning(false);
  }
  return (
    <>
      <section className="stats extract-stats">
        <article>
          <small>الصور المرفوعة</small>
          <b>
            {jobs.length}
            <i>/ 100</i>
          </b>
        </article>
        <article>
          <small>قالب Excel</small>
          <b className="word">{templateFile ? "جاهز" : "اختياري"}</b>
        </article>
        <article>
          <small>الحقول المكتشفة</small>
          <b>{templateFields.length || "—"}</b>
        </article>
        <article>
          <small>المكتملة</small>
          <b>
            {completed}
            <i>/ {jobs.length}</i>
          </b>
        </article>
      </section>
      <section className="panel extract-panel">
        <Title
          n="1"
          title="إعداد ملف البيانات"
          text="ارفع الصور، ويمكنك إضافة قالب Excel للمحافظة على أعمدته"
        />
        <div className="price-mode">
          <div>
            <strong>نوع السعر الظاهر في الصور</strong>
            <small>سيُحفظ في Excel دائمًا كسعر الحبة</small>
          </div>
          <button
            type="button"
            className={priceMode === "piece" ? "selected" : ""}
            onClick={() => setPriceMode("piece")}
          >
            <b>سعر الحبة</b>
            <span>يُحفظ كما هو</span>
          </button>
          <button
            type="button"
            className={priceMode === "dozen" ? "selected" : ""}
            onClick={() => setPriceMode("dozen")}
          >
            <b>سعر الدرزن</b>
            <span>يُقسم تلقائيًا على 12</span>
          </button>
        </div>
        <div className="extract-upload-grid">
          <label
            className="drop small"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              loadImageFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={loadImages}
            />
            <b>▧</b>
            <h3>
              {jobs.length
                ? `${jobs.length} صورة جاهزة للتحليل`
                : "رفع صور المنتجات المصممة"}
            </h3>
            <p>سيتم استخراج رقم الصنف والسعر والشد وتوليد الأوصاف</p>
            <em>{jobs.length ? "تغيير الصور" : "اختيار الصور"}</em>
          </label>
          <label
            className="drop small"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void loadTemplateFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={loadTemplate}
            />
            <b>▤</b>
            <h3>{templateFile?.name || "رفع قالب Excel (اختياري)"}</h3>
            <p>بدون قالب سننشئ Excel وCSV جاهزين تلقائيًا</p>
            <em>{templateFile ? "تغيير القالب" : "اختيار الملف"}</em>
          </label>
        </div>
        {templateError && <p className="inline-error">{templateError}</p>}
      </section>
      <section className="panel">
        <Title
          n="2"
          title="خريطة الحقول الذكية"
          text="تم اكتشاف أعمدة القالب وسيتم ربطها تلقائيًا"
        />
        <div className="field-map">
          {templateFields.length ? (
            templateFields.map((field) => (
              <div key={field}>
                <strong>{field}</strong>
                <span>←</span>
                <em>{fieldSource(field)}</em>
              </div>
            ))
          ) : (
            DEFAULT_HEADERS.map((field) => (
              <div key={field}>
                <strong>{field}</strong>
                <span>←</span>
                <em>{fieldSource(field)}</em>
              </div>
            ))
          )}
        </div>
      </section>
      {jobs.length > 0 && (
        <section className="panel extraction-list">
          <Title
            n="3"
            title="حالة الصور"
            text="يتم التحليل بالتسلسل للحفاظ على الاستقرار"
          />
          <div>
            {jobs.map((job, index) => (
              <article key={job.id}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span>{job.file.name}</span>
                <em className={job.status}>
                  {job.status === "processing"
                    ? "جاري التحليل"
                    : job.status === "done"
                      ? "مكتملة"
                      : job.status === "error"
                        ? job.error || "فشلت"
                        : "جاهزة"}
                </em>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="retention">
        <b>حفظ مؤقت وآمن</b>
        <span>
          تُعالج الصور واحدة تلو الأخرى، ثم يُنشأ ملف Excel وملف CSV. وإذا
          أضفت قالبًا فسيُحفظ ترتيب أعمدته.
        </span>
        <i>لا تُحفظ الصور في المتصفح</i>
      </section>
      <div className="extract-actions">
        {resultUrls && (
          <>
            <a href={resultUrls.xlsx} download="jomla-link-products.xlsx">
              تنزيل Excel (.xlsx)
            </a>
            <a
              className="csv-download"
              href={resultUrls.csv}
              download="jomla-link-products.csv"
            >
              تنزيل CSV (.csv)
            </a>
          </>
        )}
        <button
          className="primary"
          onClick={startExtraction}
          disabled={running || !jobs.length}
        >
          {running
            ? `جاري التحليل ${completed}/${jobs.length}`
            : "✦ بدء التحليل والتعبئة"}
        </button>
      </div>
    </>
  );
}

function Title({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="title">
      <b>{n}</b>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}
function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
const headerMap: Record<string, string> = {
  itemcode: "item_code",
  itemno: "supplier_code",
  رقمالصنف: "supplier_code",
  كودالصنف: "supplier_code",
  namear: "name_ar",
  الاسمالعربي: "name_ar",
  اسمالصنفبالعربي: "name_ar",
  nameen: "name_en",
  englishname: "name_en",
  namehi: "name_hi",
  category: "category",
  القسم: "category",
  التصنيف: "category",
  price: "price",
  السعر: "price",
  cartonpacksize: "carton_pack_size",
  pcsctn: "carton_pack_size",
  شدالصنف: "carton_pack_size",
  الشد: "carton_pack_size",
  minimumquantity: "minimum_quantity",
  الحدالادنى: "minimum_quantity",
  stockstatus: "stock_status",
  حالةالمخزون: "stock_status",
  suppliername: "supplier_name",
  اسمالمورد: "supplier_name",
  suppliercode: "supplier_code",
  رقمالمورد: "supplier_code",
  descriptionar: "description_ar",
  الوصفالعربي: "description_ar",
  descriptionen: "description_en",
  descriptionhi: "description_hi",
};
const DEFAULT_HEADERS = [
  "item_code",
  "name_ar",
  "name_en",
  "name_hi",
  "category",
  "price",
  "carton_pack_size",
  "minimum_quantity",
  "stock_status",
  "supplier_name",
  "supplier_code",
  "description_ar",
  "description_en",
  "description_hi",
];
function fieldSource(field: string) {
  const key = headerMap[normalize(field)] || normalize(field);
  if (key === "item_code") return "رقم داخلي متسلسل تلقائي";
  if (["supplier_code", "price", "carton_pack_size"].includes(key))
    return "استخراج دقيق من الصورة";
  if (key === "supplier_name") return "توليد افتراضي عند عدم ظهوره";
  return "توليد وتحليل ذكي";
}
async function optimizeImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذر تجهيز الصورة");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.78),
  );
  if (!blob) throw new Error("تعذر ضغط الصورة");
  return new File([blob], "catalog.jpg", { type: "image/jpeg" });
}
async function buildExportFiles(file: File | null, items: ExtractedItem[]) {
  const XLSX = await import("xlsx");
  const workbook = file
    ? XLSX.read(await file.arrayBuffer(), { type: "array", cellStyles: true })
    : XLSX.utils.book_new();
  if (!file) {
    const sheet = XLSX.utils.aoa_to_sheet([DEFAULT_HEADERS]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet || !sheet["!ref"]) throw new Error("قالب Excel غير صالح");
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const headerIndex = table.findIndex((row) =>
    row.some((cell) => String(cell).trim()),
  );
  const headers = (table[headerIndex] || []).map((cell) => String(cell).trim());
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  for (let row = headerIndex + 1; row <= range.e.r; row++)
    for (let col = range.s.c; col <= range.e.c; col++)
      delete sheet[XLSX.utils.encode_cell({ r: row, c: col })];
  const values = items.map((item) =>
    headers.map((header) => item[headerMap[normalize(header)] || header] ?? ""),
  );
  XLSX.utils.sheet_add_aoa(sheet, values, {
    origin: { r: headerIndex + 1, c: 0 },
  });
  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: range.s.r, c: range.s.c },
    e: {
      r: headerIndex + values.length,
      c: Math.max(range.e.c, headers.length - 1),
    },
  });
  const output = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    cellStyles: true,
  });
  const csvText = XLSX.utils.sheet_to_csv(sheet);
  return {
    xlsx: new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    csv: new Blob(["\uFEFF", csvText], {
      type: "text/csv;charset=utf-8",
    }),
  };
}

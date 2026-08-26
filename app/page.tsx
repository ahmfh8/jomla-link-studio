"use client";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import SmartExtractMode from "./extract-mode";

type Row = {
  id: string;
  file: File;
  preview: string;
  output?: string;
  itemNo: string;
  price: string;
  pcs: string;
  notes: string;
  status: "ready" | "processing" | "done" | "error";
  error?: string;
};
type Logo = { id: string; name: string; src: string };
type PriceItem = { itemNo: string; price: string; pcs: string };
type PromptTemplate = { id: string; name: string; content: string };
const defaultLogo: Logo = {
  id: "wow-store",
  name: "WOW STORE الرئيسي",
  src: "/wow-store-logo.png",
};

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [excel, setExcel] = useState("");
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [excelError, setExcelError] = useState("");
  const [mode, setMode] = useState<"design" | "extract">("design");
  const [logos, setLogos] = useState<Logo[]>([defaultLogo]);
  const [logoId, setLogoId] = useState(defaultLogo.id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiState, setApiState] = useState<
    "unknown" | "saving" | "ready" | "error"
  >("unknown");
  const [apiMessage, setApiMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [promptId, setPromptId] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptName, setPromptName] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [promptEditingId, setPromptEditingId] = useState<string | null>(null);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptError, setPromptError] = useState("");
  const [zipBusy, setZipBusy] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [activeNav, setActiveNav] = useState<
    "workspace" | "prompts" | "files" | "results"
  >("workspace");
  const ready = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.itemNo &&
          r.price &&
          r.pcs &&
          (r.status === "ready" || r.status === "error"),
      ).length,
    [rows],
  );
  const completed = useMemo(
    () => rows.filter((r) => r.status === "done" && r.output).length,
    [rows],
  );
  const selectedPrompt = prompts.find((prompt) => prompt.id === promptId);
  function navigateTo(
    nav: "workspace" | "prompts" | "files" | "results",
    targetId: string,
  ) {
    setActiveNav(nav);
    if (nav !== "workspace") setMode("design");
    window.setTimeout(() => {
      const target = document.getElementById(targetId);
      if (target)
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
  }
  function appendImages(incoming: File[]) {
    const files = incoming
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 50 - rows.length);
    setRows((v) =>
      [
        ...v,
        ...files.map((f, i) => ({
          id: `${f.name}-${f.lastModified}-${i}`,
          file: f,
          preview: URL.createObjectURL(f),
          itemNo: "",
          price: "",
          pcs: "",
          notes: "",
          status: "ready" as const,
        })),
      ].slice(0, 50),
    );
  }
  function addImages(e: ChangeEvent<HTMLInputElement>) {
    appendImages(Array.from(e.target.files ?? []));
    e.target.value = "";
  }
  function update(id: string, key: keyof Row, value: string) {
    setRows((v) =>
      v.map((r) => {
        if (r.id !== id) return r;
        if (key === "itemNo") {
          const m = priceItems.find(
            (x) => x.itemNo.toLowerCase() === value.trim().toLowerCase(),
          );
          return {
            ...r,
            itemNo: value,
            price: m?.price ?? r.price,
            pcs: m?.pcs ?? r.pcs,
          };
        }
        return { ...r, [key]: value };
      }),
    );
  }
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem("jomla-link-logos") ||
        localStorage.getItem("wow-logos");
      if (stored) setLogos([defaultLogo, ...JSON.parse(stored)]);
    } catch {}
  }, []);
  useEffect(() => {
    fetch("/api/prompts")
      .then((response) => response.json())
      .then((data: { prompts?: PromptTemplate[] }) => {
        const next = data.prompts || [];
        setPrompts(next);
        setPromptId((current) => current || next[0]?.id || "");
      })
      .catch(() => setPromptError("تعذر تحميل البرومبتات"));
  }, []);
  async function loadPriceFile(file?: File) {
    if (!file) return;
    setExcelError("");
    try {
      const items = await readPriceSheet(file);
      setExcel(file.name);
      setPriceItems(items);
    } catch (error) {
      setExcel("");
      setPriceItems([]);
      setExcelError(
        error instanceof Error ? error.message : "تعذر قراءة ملف الدفعة",
      );
    }
  }
  async function loadPriceSheet(e: ChangeEvent<HTMLInputElement>) {
    await loadPriceFile(e.target.files?.[0]);
    e.target.value = "";
  }
  useEffect(() => {
    fetch("/api/settings/gemini")
      .then((r) => r.json())
      .then((data) => {
        if (data.configured) setApiState("ready");
      })
      .catch(() => {});
  }, []);
  function addLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const logo = {
        id: `logo-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, "") || "شعار جديد",
        src: String(reader.result),
      };
      setLogos((v) => {
        const next = [...v, logo];
        try {
          localStorage.setItem(
            "jomla-link-logos",
            JSON.stringify(next.filter((x) => x.id !== defaultLogo.id)),
          );
        } catch {}
        return next;
      });
      setLogoId(logo.id);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  async function saveApiKey() {
    setApiState("saving");
    setApiMessage("");
    try {
      const response = await fetch("/api/settings/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "تعذر اختبار المفتاح");
      setApiKey("");
      setApiState("ready");
      setApiMessage("تم الاتصال بـ Gemini Image Flash وحفظ المفتاح بأمان");
    } catch (error) {
      setApiState("error");
      setApiMessage(
        error instanceof Error ? error.message : "تعذر اختبار المفتاح",
      );
    }
  }
  async function savePassword() {
    setPasswordMessage("");
    setPasswordError(false);
    if (newPassword !== confirmPassword) {
      setPasswordError(true);
      setPasswordMessage("تأكيد كلمة المرور غير مطابق");
      return;
    }
    setPasswordBusy(true);
    try {
      const response = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "تعذر تغيير كلمة المرور");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("تم تغيير كلمة المرور وحفظها بأمان");
    } catch (error) {
      setPasswordError(true);
      setPasswordMessage(
        error instanceof Error ? error.message : "تعذر تغيير كلمة المرور",
      );
    } finally {
      setPasswordBusy(false);
    }
  }
  async function selectedLogoFile() {
    if (logoId === "none") return null;
    const logo = logos.find((x) => x.id === logoId);
    if (!logo) return null;
    const response = await fetch(logo.src);
    const blob = await response.blob();
    return new File([blob], `${logo.name}.png`, {
      type: blob.type || "image/png",
    });
  }
  function openNewPrompt() {
    setPromptEditingId(null);
    setPromptName("");
    setPromptContent("");
    setPromptError("");
    setPromptOpen(true);
  }
  function openEditPrompt() {
    if (!selectedPrompt) return;
    setPromptEditingId(selectedPrompt.id);
    setPromptName(selectedPrompt.name);
    setPromptContent(selectedPrompt.content);
    setPromptError("");
    setPromptOpen(true);
  }
  async function savePrompt() {
    setPromptBusy(true);
    setPromptError("");
    try {
      const response = await fetch("/api/prompts", {
        method: promptEditingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: promptEditingId,
          name: promptName,
          content: promptContent,
        }),
      });
      const data = (await response.json()) as {
        prompt?: PromptTemplate;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "تعذر حفظ البرومبت");
      if (promptEditingId) {
        setPrompts((current) =>
          current.map((prompt) =>
            prompt.id === promptEditingId
              ? {
                  ...prompt,
                  name: promptName.trim(),
                  content: promptContent.trim(),
                }
              : prompt,
          ),
        );
      } else if (data.prompt) {
        setPrompts((current) => [data.prompt!, ...current]);
        setPromptId(data.prompt.id);
      }
      setPromptOpen(false);
    } catch (error) {
      setPromptError(
        error instanceof Error ? error.message : "تعذر حفظ البرومبت",
      );
    } finally {
      setPromptBusy(false);
    }
  }
  async function deletePrompt() {
    if (!selectedPrompt || !confirm(`حذف البرومبت: ${selectedPrompt.name}؟`))
      return;
    const response = await fetch(
      `/api/prompts?id=${encodeURIComponent(selectedPrompt.id)}`,
      {
        method: "DELETE",
      },
    );
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setPromptError(data.error || "تعذر حذف البرومبت");
      return;
    }
    const next = prompts.filter((prompt) => prompt.id !== selectedPrompt.id);
    setPrompts(next);
    setPromptId(next[0]?.id || "");
  }
  async function downloadZip() {
    const finished = rows.filter((row) => row.output && row.status === "done");
    if (!finished.length) return;
    setZipBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const row of finished) {
        const blob = await fetch(row.output!).then((response) =>
          response.blob(),
        );
        zip.file(`${safeFilename(row.itemNo)}.png`, blob);
      }
      const archive = await zip.generateAsync({ type: "blob" });
      downloadBlob(
        archive,
        `jomla-link-catalog-${new Date().toISOString().slice(0, 10)}.zip`,
      );
    } finally {
      setZipBusy(false);
    }
  }
  async function generateImages() {
    if (generationBusy) return;
    const queue = rows.filter(
      (row) =>
        row.itemNo &&
        row.price &&
        row.pcs &&
        (row.status === "ready" || row.status === "error"),
    );
    if (!queue.length) return;
    setGenerationBusy(true);
    setRows((current) =>
      current.map((row) =>
        queue.some((queued) => queued.id === row.id)
          ? { ...row, status: "processing", error: undefined }
          : row,
      ),
    );
    try {
      const rawLogo = await selectedLogoFile();
      const logo = rawLogo
        ? await optimizeForUpload(rawLogo, 512, 100_000)
        : null;
      for (const row of queue) {
        try {
        const image = await optimizeForUpload(row.file, 1200, 520_000);
        const form = new FormData();
        form.append("image", image);
        if (logo) form.append("logo", logo);
        form.append("itemNo", row.itemNo);
        form.append("price", row.price);
        form.append("pcs", row.pcs);
        form.append("notes", row.notes);
        form.append("promptTemplate", selectedPrompt?.content || "");
        const response = await fetch("/api/gemini/generate", {
          method: "POST",
          body: form,
        });
        if (!response.ok) {
          let message =
            response.status === 413
              ? "حجم الصورة أكبر من حد الإرسال"
              : "فشل إنشاء الصورة";
          try {
            const data = (await response.json()) as { error?: string };
            message = data.error || message;
          } catch {}
          throw new Error(`${message} (${response.status})`);
        }
        const blob = await response.blob();
        const output = URL.createObjectURL(blob);
        setRows((v) =>
          v.map((x) =>
            x.id === row.id ? { ...x, status: "done", output } : x,
          ),
        );
        } catch (error) {
          setRows((v) =>
            v.map((x) =>
              x.id === row.id
                ? {
                    ...x,
                    status: "error",
                    error:
                      error instanceof Error
                        ? error.message
                        : "فشل إنشاء الصورة",
                  }
                : x,
            ),
          );
        }
      }
    } catch (error) {
      setRows((current) =>
        current.map((row) =>
          queue.some((queued) => queued.id === row.id) &&
          row.status === "processing"
            ? {
                ...row,
                status: "error",
                error:
                  error instanceof Error
                    ? error.message
                    : "تعذر تجهيز الصور للإنشاء",
              }
            : row,
        ),
      );
    } finally {
      setGenerationBusy(false);
    }
  }
  return (
    <main dir="rtl" className="shell">
      <aside>
        <div className="brand">
          <img
            className="brand-logo"
            src="/jomlalink-symbol.svg"
            alt="شعار جملة لينك"
          />
          <div>
            <strong><span>Jomla</span> <em>Link</em></strong>
            <small>جملة لينك</small>
          </div>
        </div>
        <nav>
          <button
            className={activeNav === "workspace" ? "on" : ""}
            onClick={() => navigateTo("workspace", "workspace-top")}
          >
            لوحة العمل <i>◫</i>
          </button>
          <button
            className={activeNav === "prompts" ? "on" : ""}
            onClick={() => navigateTo("prompts", "prompts-section")}
          >
            البرومبتات <i>✦</i>
          </button>
          <button
            className={activeNav === "files" ? "on" : ""}
            onClick={() => navigateTo("files", "product-files-section")}
          >
            ملفات المنتجات <i>▤</i>
          </button>
          <button
            className={activeNav === "results" ? "on" : ""}
            onClick={() => navigateTo("results", "results-section")}
          >
            النتائج <i>⌁</i>
          </button>
        </nav>
        <div className="api">
          <small>Gemini Image Flash</small>
          <b className={apiState === "ready" ? "connected" : ""}>
            {apiState === "ready"
              ? "متصل"
              : apiState === "error"
                ? "خطأ في الاتصال"
                : "جاري التحقق"}
          </b>
          <span>
            {apiState === "ready"
              ? "المفتاح محفوظ ومشفر على الخادم"
              : "افتح الإعدادات للتحقق من المفتاح"}
          </span>
        </div>
      </aside>
      <section className="work" id="workspace-top">
        <header>
          <div>
            <small>JOMLA LINK</small>
            <h1>استوديو الكتالوج الذكي</h1>
          </div>
          <div>
            <span>مستخدم واحد</span>
            <button onClick={() => setSettingsOpen(true)}>الإعدادات</button>
          </div>
        </header>
        <section className="mode-switch">
          <button
            className={mode === "design" ? "active" : ""}
            onClick={() => setMode("design")}
          >
            <b>✦</b>
            <div>
              <strong>إنشاء صور الكتالوج</strong>
              <small>صور المنتجات + Excel ← تصاميم جاهزة</small>
            </div>
          </button>
          <button
            className={mode === "extract" ? "active" : ""}
            onClick={() => setMode("extract")}
          >
            <b>▤</b>
            <div>
              <strong>الصور إلى Excel</strong>
              <small>صور جاهزة + قالب Excel ← بيانات مكتملة</small>
            </div>
          </button>
        </section>
        {mode === "design" ? (
          <>
            <section className="stats">
              <article>
                <small>الصور المرفوعة</small>
                <b>
                  {rows.length}
                  <i>/ 50</i>
                </b>
              </article>
              <article>
                <small>جاهزة للإنشاء</small>
                <b>{ready}</b>
              </article>
              <article>
                <small>المكتملة</small>
                <b>{completed}</b>
              </article>
              <article>
                <small>تقدم الدفعة</small>
                <b>
                  {rows.length
                    ? Math.round((completed / rows.length) * 100)
                    : 0}
                  %
                </b>
                <div>
                  <i
                    style={{
                      width: `${rows.length ? (completed / rows.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </article>
            </section>
            <section className="panel">
              <Title
                n="1"
                title="إعداد الدفعة"
                text="ارفع جدول المنتجات ثم اختر القالب والشعار"
              />
              <div className="setup">
                <label
                  className="upload"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void loadPriceFile(event.dataTransfer.files?.[0]);
                  }}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={loadPriceSheet}
                  />
                  <b>⇧</b>
                  <div>
                    <strong>{excel || "رفع ملف أسعار الدفعة"}</strong>
                    <small>ITEM NO · PRICE · PCS/CTN</small>
                  </div>
                  <em>{excel ? `${priceItems.length} صنف` : "اختر ملف"}</em>
                </label>
                <div className="prompt-picker" id="prompts-section">
                  <label className="field">
                    <span>البرومبت المستخدم</span>
                    <select
                      value={promptId}
                      onChange={(e) => setPromptId(e.target.value)}
                    >
                      {prompts.map((prompt) => (
                        <option key={prompt.id} value={prompt.id}>
                          {prompt.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="prompt-actions">
                    <button type="button" onClick={openNewPrompt}>
                      ＋ إضافة
                    </button>
                    <button
                      type="button"
                      onClick={openEditPrompt}
                      disabled={!selectedPrompt}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={deletePrompt}
                      disabled={!selectedPrompt}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
              {excelError && <p className="inline-error">{excelError}</p>}
              {promptError && !promptOpen && (
                <p className="inline-error">{promptError}</p>
              )}
              <div className="logo-library">
                <div className="logo-title">
                  <div>
                    <strong>مكتبة الشعارات</strong>
                    <small>
                      الشعار المحدد سيُرسل تلقائيًا مع كل صورة في الدفعة
                    </small>
                  </div>
                  <label className="logo-add">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={addLogo}
                    />
                    ＋ رفع شعار
                  </label>
                </div>
                <div className="logo-grid">
                  {logos.map((logo) => (
                    <button
                      type="button"
                      key={logo.id}
                      className={
                        logoId === logo.id ? "logo-card selected" : "logo-card"
                      }
                      onClick={() => setLogoId(logo.id)}
                    >
                      <span>
                        <img src={logo.src} alt={logo.name} />
                      </span>
                      <div>
                        <strong>{logo.name}</strong>
                        <small>
                          {logo.id === defaultLogo.id
                            ? "الشعار الافتراضي"
                            : "شعار محفوظ"}
                        </small>
                      </div>
                      <i>{logoId === logo.id ? "✓" : ""}</i>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={
                      logoId === "none" ? "logo-card selected" : "logo-card"
                    }
                    onClick={() => setLogoId("none")}
                  >
                    <span className="no-logo">∅</span>
                    <div>
                      <strong>بدون شعار</strong>
                      <small>لهذه الدفعة فقط</small>
                    </div>
                    <i>{logoId === "none" ? "✓" : ""}</i>
                  </button>
                </div>
              </div>
            </section>
            <section className="panel jobs" id="results-section">
              <div className="heading" id="product-files-section">
                <Title
                  n="2"
                  title="صور المنتجات"
                  text="أدخل رقم الصنف وسيتم جلب السعر والشد تلقائيًا"
                />
                <label className="add">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={addImages}
                  />
                  ＋ إضافة صور
                </label>
              </div>
              {!rows.length ? (
                <label
                  className="drop"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    appendImages(Array.from(event.dataTransfer.files));
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={addImages}
                  />
                  <b>▧</b>
                  <h3>ارفع صور المنتجات هنا</h3>
                  <p>حتى 50 صورة في الدفعة الواحدة · JPG أو PNG</p>
                  <em>اختيار الصور</em>
                </label>
              ) : (
                <div className="list">
                  {rows.map((r, i) => (
                    <article className={`row job-${r.status}`} key={r.id}>
                      <span className="seq">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <img
                        src={r.output || r.preview}
                        alt={`المنتج ${i + 1}`}
                      />
                      <div className="fields">
                        <Field label="ITEM NO">
                          <input
                            list="items"
                            value={r.itemNo}
                            onChange={(e) =>
                              update(r.id, "itemNo", e.target.value)
                            }
                            placeholder="اختر أو اكتب الرقم"
                          />
                        </Field>
                        <Field label="PRICE (SAR)">
                          <input
                            value={r.price}
                            onChange={(e) =>
                              update(r.id, "price", e.target.value)
                            }
                            placeholder="0.00"
                          />
                        </Field>
                        <Field label="PCS/CTN">
                          <input
                            value={r.pcs}
                            onChange={(e) =>
                              update(r.id, "pcs", e.target.value)
                            }
                            placeholder="0"
                          />
                        </Field>
                        <Field label="تفاصيل إضافية" wide>
                          <input
                            value={r.notes}
                            onChange={(e) =>
                              update(r.id, "notes", e.target.value)
                            }
                            placeholder="مثال: تصدر أصواتًا وتتحرك..."
                          />
                        </Field>
                      </div>
                      {r.output ? (
                        <a
                          className="download-one"
                          href={r.output}
                          download={`${r.itemNo}.png`}
                        >
                          تنزيل الصورة
                        </a>
                      ) : (
                        <span className={`status ${r.status}`} title={r.error}>
                          <i />
                          <span>
                            {r.status === "processing"
                              ? "جاري الإنشاء"
                              : r.status === "error"
                                ? r.error || "فشلت — أعد المحاولة"
                                : "جاهزة للتعبئة"}
                          </span>
                        </span>
                      )}
                      <button
                        className="x"
                        onClick={() =>
                          setRows((v) => v.filter((x) => x.id !== r.id))
                        }
                      >
                        ×
                      </button>
                    </article>
                  ))}
                </div>
              )}
              <datalist id="items">
                {priceItems.map((x) => (
                  <option key={x.itemNo} value={x.itemNo} />
                ))}
              </datalist>
            </section>
          </>
        ) : (
          <SmartExtractMode />
        )}
        {mode === "design" && (
          <footer>
            <div>
              <b>
                {mode === "design"
                  ? `${rows.length} صورة`
                  : "دفعة استخراج جديدة"}
              </b>
              <span>
                {mode === "design"
                  ? "سيتم حفظ الصور بأسماء أرقام الأصناف"
                  : "الملفات مؤقتة وتحذف تلقائيًا بعد 24 ساعة"}
              </span>
            </div>
            <div>
              <button onClick={downloadZip} disabled={!completed || zipBusy}>
                {zipBusy
                  ? "جاري تجهيز ZIP..."
                  : `تنزيل ZIP${completed ? ` (${completed})` : ""}`}
              </button>
              <button
                type="button"
                className="primary"
                onClick={mode === "design" ? generateImages : undefined}
                disabled={mode === "design" ? !ready || generationBusy : true}
              >
                {mode === "design"
                  ? generationBusy
                    ? "جاري إنشاء الصور..."
                    : `✦ بدء إنشاء ${ready || ""} صورة`
                  : "✦ بدء التحليل والتعبئة"}
              </button>
            </div>
          </footer>
        )}
      </section>
      {settingsOpen && (
        <div
          className="settings-backdrop"
          onMouseDown={() => setSettingsOpen(false)}
        >
          <section
            className="settings-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="settings-close"
              onClick={() => setSettingsOpen(false)}
            >
              ×
            </button>
            <div className="settings-icon">✦</div>
            <h2>إعدادات المنصة</h2>
            <h3>ربط Gemini API</h3>
            <p>
              أدخل المفتاح هنا مرة واحدة. سيختبره الخادم ثم يحفظه مشفرًا، ولن
              يظهر مجددًا في الواجهة.
            </p>
            <label>
              <span>GEMINI API KEY</span>
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="ألصق المفتاح هنا"
              />
            </label>
            <div className={`connection-state ${apiState}`}>
              {apiState === "ready"
                ? "● Gemini Image Flash متصل"
                : apiState === "saving"
                  ? "جاري اختبار الاتصال..."
                  : apiState === "error"
                    ? `تعذر الاتصال: ${apiMessage}`
                    : "لم يتم ربط المفتاح بعد"}
            </div>
            {apiState === "ready" && apiMessage && (
              <small className="success-note">{apiMessage}</small>
            )}
            <button
              className="save-key"
              disabled={apiState === "saving" || apiKey.length < 20}
              onClick={saveApiKey}
            >
              {apiState === "saving" ? "جاري التحقق..." : "اختبار وحفظ المفتاح"}
            </button>
            <small className="security-note">
              المفتاح لا يُحفظ في المتصفح ولا يُرسل إلا إلى خادم النظام الخاص
              بك.
            </small>
            <div className="settings-divider" />
            <h3>الحساب وكلمة المرور</h3>
            <p className="account-email">ahmfh8@gmail.com</p>
            <label>
              <span>كلمة المرور الحالية</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label>
              <span>كلمة المرور الجديدة</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="10 أحرف على الأقل"
              />
            </label>
            <label>
              <span>تأكيد كلمة المرور الجديدة</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            {passwordMessage && (
              <small className={passwordError ? "password-error" : "password-success"}>
                {passwordMessage}
              </small>
            )}
            <button
              className="save-password"
              disabled={
                passwordBusy ||
                !currentPassword ||
                newPassword.length < 10 ||
                !confirmPassword
              }
              onClick={savePassword}
            >
              {passwordBusy ? "جاري الحفظ..." : "تغيير كلمة المرور"}
            </button>
          </section>
        </div>
      )}
      {promptOpen && (
        <div
          className="settings-backdrop"
          onMouseDown={() => setPromptOpen(false)}
        >
          <section
            className="settings-modal prompt-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="settings-close"
              onClick={() => setPromptOpen(false)}
            >
              ×
            </button>
            <div className="settings-icon">✦</div>
            <h2>{promptEditingId ? "تعديل البرومبت" : "إضافة برومبت جديد"}</h2>
            <p>
              يمكنك استخدام المتغيرات [ITEM_NO] و[PRICE] و[PCS] داخل البرومبت.
            </p>
            <label>
              <span>اسم البرومبت</span>
              <input
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="مثال: تصميم الشركة الثانية"
              />
            </label>
            <label>
              <span>محتوى البرومبت</span>
              <textarea
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                placeholder="ألصق البرومبت الكامل هنا"
              />
            </label>
            {promptError && (
              <small className="prompt-error">{promptError}</small>
            )}
            <button
              className="save-key"
              disabled={
                promptBusy ||
                !promptName.trim() ||
                promptContent.trim().length < 20
              }
              onClick={savePrompt}
            >
              {promptBusy ? "جاري الحفظ..." : "حفظ البرومبت"}
            </button>
          </section>
        </div>
      )}
    </main>
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
function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
function findColumn(headers: unknown[], aliases: string[]) {
  const normalized = headers.map(normalizeHeader);
  return normalized.findIndex((header) =>
    aliases.map(normalizeHeader).includes(header),
  );
}
async function readPriceSheet(file: File): Promise<PriceItem[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("ملف الدفعة لا يحتوي على ورقة بيانات");
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const itemAliases = [
    "ITEM NO",
    "ITEM NUMBER",
    "ITEM CODE",
    "ITEM",
    "SKU",
    "رقم الصنف",
    "كود الصنف",
    "الصنف",
  ];
  const priceAliases = [
    "PRICE",
    "PRICE SAR",
    "SALE PRICE",
    "UNIT PRICE",
    "السعر",
    "سعر الصنف",
  ];
  const pcsAliases = [
    "PCS/CTN",
    "PCS CTN",
    "PCS",
    "CTN",
    "CARTON PACK SIZE",
    "PACK SIZE",
    "شد الصنف",
    "الشد",
    "شد الكرتون",
  ];
  let headerIndex = -1;
  let bestScore = -1;
  for (let index = 0; index < Math.min(table.length, 25); index++) {
    const row = table[index];
    const score =
      Number(findColumn(row, itemAliases) >= 0) +
      Number(findColumn(row, priceAliases) >= 0) +
      Number(findColumn(row, pcsAliases) >= 0);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  }
  if (headerIndex < 0) throw new Error("ملف الدفعة فارغ");
  const headers = table[headerIndex];
  let itemIndex = findColumn(headers, itemAliases);
  let priceIndex = findColumn(headers, priceAliases);
  let pcsIndex = findColumn(headers, pcsAliases);
  const populatedColumns = headers
    .map((cell, index) => (String(cell).trim() ? index : -1))
    .filter((index) => index >= 0);
  if (populatedColumns.length >= 3) {
    if (itemIndex < 0) itemIndex = populatedColumns[0];
    if (priceIndex < 0) priceIndex = populatedColumns[1];
    if (pcsIndex < 0) pcsIndex = populatedColumns[2];
  }
  if (itemIndex < 0 || priceIndex < 0 || pcsIndex < 0)
    throw new Error(
      "يجب أن يحتوي الملف على ثلاثة أعمدة: رقم الصنف، السعر، شد الصنف",
    );
  const unique = new Map<string, PriceItem>();
  for (const row of table.slice(headerIndex + 1)) {
    const itemNo = String(row[itemIndex] ?? "").trim();
    if (!itemNo) continue;
    unique.set(itemNo.toLowerCase(), {
      itemNo,
      price: String(row[priceIndex] ?? "").trim(),
      pcs: String(row[pcsIndex] ?? "").trim(),
    });
  }
  const items = [...unique.values()];
  if (!items.length) throw new Error("لم أجد أصنافًا داخل ملف الدفعة");
  return items;
}
function safeFilename(value: string) {
  return (
    value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "product"
  );
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
async function optimizeForUpload(
  file: File,
  maxDimension: number,
  maxBytes: number,
) {
  const image = await loadImageSource(file);
  let scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  let best: Blob | null = null;
  for (let pass = 0; pass < 4; pass++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذر تجهيز الصورة للإرسال");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob) {
        best = blob;
        if (blob.size <= maxBytes) {
          image.close();
          return new File([blob], `${file.name.replace(/\.[^.]+$/g, "")}.jpg`, {
            type: "image/jpeg",
          });
        }
      }
    }
    scale *= 0.82;
  }
  image.close();
  if (!best) throw new Error("تعذر ضغط الصورة للإرسال");
  return new File([best], `${file.name.replace(/\.[^.]+$/g, "")}.jpg`, {
    type: "image/jpeg",
  });
}
async function loadImageSource(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Safari can reject some valid camera images; fall back to an img URL.
    }
  }
  const url = URL.createObjectURL(file);
  const element = new Image();
  element.decoding = "async";
  element.src = url;
  try {
    await element.decode();
  } catch {
    await new Promise<void>((resolve, reject) => {
      element.onload = () => resolve();
      element.onerror = () => reject(new Error("صيغة الصورة غير مدعومة"));
    });
  }
  return {
    source: element,
    width: element.naturalWidth,
    height: element.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}
function ExtractMode() {
  const [template, setTemplate] = useState("");
  const [templateFields, setTemplateFields] = useState<string[]>([]);
  const [templateError, setTemplateError] = useState("");
  const [count, setCount] = useState(0);
  async function loadTemplate(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
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
      setTemplate(file.name);
      setTemplateFields(headers);
    } catch (error) {
      setTemplate("");
      setTemplateFields([]);
      setTemplateError(
        error instanceof Error ? error.message : "تعذر قراءة القالب",
      );
    }
    e.target.value = "";
  }
  return (
    <>
      <section className="stats extract-stats">
        <article>
          <small>الصور المرفوعة</small>
          <b>
            {count}
            <i>/ 100</i>
          </b>
        </article>
        <article>
          <small>قالب Excel</small>
          <b className="word">{template ? "جاهز" : "مطلوب"}</b>
        </article>
        <article>
          <small>الحقول المكتشفة</small>
          <b>{templateFields.length || "—"}</b>
        </article>
        <article>
          <small>مدة الحفظ</small>
          <b className="word">24 ساعة</b>
        </article>
      </section>
      <section className="panel extract-panel">
        <Title
          n="1"
          title="إعداد ملف البيانات"
          text="ارفع الصور المصممة وقالب Excel الذي تريد تعبئته"
        />
        <div className="extract-upload-grid">
          <label className="drop small">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) =>
                setCount(Math.min(e.target.files?.length ?? 0, 100))
              }
            />
            <b>▧</b>
            <h3>
              {count
                ? `${count} صورة جاهزة للتحليل`
                : "رفع صور المنتجات المصممة"}
            </h3>
            <p>سيتم استخراج ITEM NO والسعر والشد والمقاسات</p>
            <em>{count ? "تغيير الصور" : "اختيار الصور"}</em>
          </label>
          <label className="drop small">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={loadTemplate}
            />
            <b>▤</b>
            <h3>{template || "رفع قالب Excel"}</h3>
            <p>نحافظ على ترتيب الأعمدة والتنسيق الأصلي</p>
            <em>{template ? "تغيير القالب" : "اختيار الملف"}</em>
          </label>
        </div>
        {templateError && <p className="inline-error">{templateError}</p>}
      </section>
      <section className="panel">
        <Title
          n="2"
          title="خريطة الحقول الذكية"
          text="سيتم التعرف على أعمدة القالب وربطها تلقائيًا"
        />
        <div className="field-map">
          {[
            ["رقم الصنف", "استخراج من الصورة"],
            ["السعر والشد", "استخراج من الصورة"],
            ["الوصف العربي", "توليد ذكي"],
            ["English Description", "AI generation"],
            ["हिंदी विवरण", "AI generation"],
            ["القسم", "تصنيف تلقائي"],
            ["الرقم الداخلي", "تسلسل بدون تكرار"],
          ].map(([a, b]) => (
            <div key={a}>
              <strong>{a}</strong>
              <span>←</span>
              <em>{b}</em>
            </div>
          ))}
        </div>
      </section>
      <section className="retention">
        <b>حفظ مؤقت وآمن</b>
        <span>
          تُحذف الصور والملفات تلقائيًا بعد تنزيل النتيجة أو بعد 24 ساعة، أيهما
          أولًا.
        </span>
        <i>تخزين سحابي مؤقت</i>
      </section>
    </>
  );
}

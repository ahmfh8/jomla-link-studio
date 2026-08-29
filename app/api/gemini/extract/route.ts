import { extractCatalogData, fileToBase64 } from "../../../../lib/gemini";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const priceMode =
      String(form.get("priceMode") || "piece") === "dozen" ? "dozen" : "piece";
    const companyId = String(form.get("companyId") || "").trim();
    if (!companyId)
      return Response.json({ error: "اختر الشركة أولًا" }, { status: 400 });
    if (!(image instanceof File) || !image.type.startsWith("image/"))
      return Response.json({ error: "صورة المنتج مطلوبة" }, { status: 400 });
    if (image.size > 900_000)
      return Response.json(
        { error: "حجم الصورة أكبر من حد الإرسال" },
        { status: 413 },
      );
    const item = await extractCatalogData({
      imageData: fileToBase64(await image.arrayBuffer()),
      imageMime: image.type,
      priceMode,
      companyId,
    });
    return Response.json({ item });
  } catch (error) {
    console.error("Gemini extraction failed", error);
    const message =
      error instanceof Error ? error.message : "تعذر تحليل الصورة";
    const transient =
      /fetch failed|failed to fetch|404|408|425|429|500|502|503|504|overload|temporar|unavailable|rate|quota/i.test(
        message,
      );
    return Response.json(
      { error: message },
      {
        status: transient ? 503 : 400,
        headers: transient ? { "Retry-After": "2" } : undefined,
      },
    );
  }
}

export const maxDuration = 120;

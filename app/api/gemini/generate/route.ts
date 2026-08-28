import {
  buildCatalogPrompt,
  fileToBase64,
  generateCatalogImage,
} from "../../../../lib/gemini";

const MAX_FILE_SIZE = 12 * 1024 * 1024;
function cleanName(value: string) {
  return (
    value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "product"
  );
}
function requiredText(form: FormData, key: string) {
  const value = String(form.get(key) || "").trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}
function imageFile(form: FormData, key: string, required = true) {
  const value = form.get(key);
  if (!(value instanceof File)) {
    if (required) throw new Error(`${key} is required`);
    return null;
  }
  if (!value.type.startsWith("image/"))
    throw new Error(`${key} must be an image`);
  if (value.size > MAX_FILE_SIZE)
    throw new Error(`${key} is larger than 12 MB`);
  return value;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const source = imageFile(form, "image")!;
    const logo = imageFile(form, "logo", false);
    const itemNo = requiredText(form, "itemNo");
    const price = requiredText(form, "price");
    const pcs = requiredText(form, "pcs");
    const notes = String(form.get("notes") || "").trim();
    const template = String(form.get("promptTemplate") || "").trim();
    const generationModel =
      String(form.get("generationModel") || "economy") === "quality"
        ? "quality"
        : "economy";
    const result = await generateCatalogImage({
      imageData: fileToBase64(await source.arrayBuffer()),
      imageMime: source.type,
      logoData: logo ? fileToBase64(await logo.arrayBuffer()) : undefined,
      logoMime: logo?.type,
      prompt: buildCatalogPrompt({ itemNo, price, pcs, notes, template }),
      model: generationModel,
    });
    const filename = `${cleanName(itemNo)}.png`;
    return new Response(Uint8Array.from(result.data).buffer, {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Generated-Filename": filename,
      },
    });
  } catch (error) {
    console.error("Gemini generation failed", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Image generation failed",
      },
      { status: 400 },
    );
  }
}

export const maxDuration = 300;
export const runtime = "nodejs";

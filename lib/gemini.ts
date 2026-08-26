import { GoogleGenAI, Modality } from "@google/genai";
import { getDb } from "../db";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
function bytesToBase64(bytes: Uint8Array) {
  let out = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk)
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(out);
}
async function encryptionKey() {
  const master = String(process.env.GEMINI_MASTER_KEY || "");
  if (!master) throw new Error("Server encryption is not configured");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(master));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
}
export async function getGeminiApiKey() {
  const environmentKey = process.env.GEMINI_API_KEY?.trim();
  if (environmentKey) return environmentKey;
  const sql = await getDb();
  const rows = await sql`SELECT ciphertext, iv FROM secrets WHERE id='gemini_api_key' LIMIT 1` as Array<{ ciphertext: string; iv: string }>;
  const row = rows[0];
  if (!row) throw new Error("Gemini API key is not configured");
  const key = await encryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(row.iv) },
    key,
    base64ToBytes(row.ciphertext),
  );
  return decoder.decode(decrypted);
}
export function fileToBase64(file: ArrayBuffer) {
  return bytesToBase64(new Uint8Array(file));
}

export function buildCatalogPrompt(data: {
  itemNo: string;
  price: string;
  pcs: string;
  notes: string;
  template?: string;
}) {
  const defaultTemplate = `Act as an automated e-commerce catalog design engine. Analyze the attached product flyer image and generate a high-end 1:1 square wholesale marketing flyer.

AUTOMATIC INTELLIGENCE: Detect the toy type, authentic visible specs, model numbers and dimensions. Preserve and display any source dimensions precisely. Create a bold playful Arabic headline matching the product with a smaller Arabic sub-badge. Add exactly 3 Arabic feature callouts with outline icons and purple arrows on the left. Add 2 circular demonstration insets extracted from the source with curved purple arrows and short Arabic labels on the right.

STRICT PRODUCT FIDELITY: Isolate and preserve the EXACT physical product, display box, colors, accessories and proportions. Do not redesign or invent a different toy. Arrange visible accessories neatly across the lower composition. Use a solid pure white background (#FFFFFF), thin rounded outer border and clean purple accents.

LOGO: Place the attached official company logo clearly at the top-right. Do not redraw, rename or alter the logo.

FOOTER: Create exactly 3 clean gradient capsules with deep-purple circular icon heads. Use English field labels. All descriptive marketing copy above the footer should be Arabic. Output only one finished square catalog image.`;
  const template = (data.template?.trim() || defaultTemplate)
    .replaceAll("[ITEM_NO]", data.itemNo)
    .replaceAll("[PRICE]", data.price)
    .replaceAll("[PCS]", data.pcs);
  return `${template}

MANDATORY EXACT DATA — do not change, translate, omit, or invent any character:
- ITEM NO: ${data.itemNo}
- PRICE: ${data.price} SAR
- PCS/CTN: ${data.pcs}
- OPERATOR NOTES: ${data.notes || "None"}

The first attached image is the source product. If a second image is attached, it is the official logo.`;
}

export async function generateCatalogImage(input: {
  imageData: string;
  imageMime: string;
  logoData?: string;
  logoMime?: string;
  prompt: string;
}) {
  const apiKey = await getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [
    { text: input.prompt },
    { inlineData: { mimeType: input.imageMime, data: input.imageData } },
  ];
  if (input.logoData)
    parts.push({
      inlineData: {
        mimeType: input.logoMime || "image/png",
        data: input.logoData,
      },
    });
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-image",
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
    },
  });
  const outputParts = response.candidates?.[0]?.content?.parts || [];
  const image = outputParts.find((part) =>
    Boolean(part.inlineData?.data),
  )?.inlineData;
  if (!image?.data)
    throw new Error(response.text || "Gemini did not return an image");
  return {
    data: base64ToBytes(image.data),
    mimeType: image.mimeType || "image/png",
  };
}

export type ExtractedCatalogItem = {
  item_code: string;
  name_ar: string;
  name_en: string;
  name_hi: string;
  category: string;
  price: string;
  carton_pack_size: string;
  minimum_quantity: string;
  stock_status: string;
  supplier_name: string;
  supplier_code: string;
  description_ar: string;
  description_en: string;
  description_hi: string;
};

export async function extractCatalogData(input: {
  imageData: string;
  imageMime: string;
  priceMode: "piece" | "dozen";
}) {
  const apiKey = await getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  let parsed: Partial<ExtractedCatalogItem> | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze this finished wholesale product catalog image. Extract exactly three commercial facts from the image and intelligently generate every other catalog field.

Return one JSON object with exactly these keys:
item_code, name_ar, name_en, name_hi, category, price, carton_pack_size, minimum_quantity, stock_status, supplier_name, supplier_code, description_ar, description_en, description_hi.

Rules:
- Extract supplier_code as the exact real ITEM NO visible in the image footer.
- Extract price as the exact PRICE visible in the image footer, numbers only.
- Extract carton_pack_size as the exact PCS/CTN visible in the image footer, numbers only.
- Leave item_code empty; the server creates a unique internal sequential code.
- Generate accurate, concise, non-empty name_ar, name_en, and name_hi based on the product.
- Generate accurate, useful, non-empty description_ar, description_en, and description_hi.
- Generate a practical non-empty Arabic category.
- Leave minimum_quantity empty; the server calculates it from the final unit price. Set stock_status to in_stock.
- Set supplier_name to المورد غير محدد when the supplier name is not visible.
- Do not leave any field empty except item_code and minimum_quantity, which the server fills.
- Return JSON only.`,
            },
            {
              inlineData: { mimeType: input.imageMime, data: input.imageData },
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });
    const raw = response.text?.trim() || "";
    if (!raw) continue;
    parsed = JSON.parse(
      raw.replace(/^```json\s*|\s*```$/g, ""),
    ) as Partial<ExtractedCatalogItem>;
    const generatedFields: Array<keyof ExtractedCatalogItem> = [
      "name_ar",
      "name_en",
      "name_hi",
      "category",
      "description_ar",
      "description_en",
      "description_hi",
    ];
    if (generatedFields.every((key) => String(parsed?.[key] ?? "").trim()))
      break;
  }
  if (!parsed) throw new Error("Gemini did not return product data");
  const keys: Array<keyof ExtractedCatalogItem> = [
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
  const item = Object.fromEntries(
    keys.map((key) => [key, String(parsed[key] ?? "").trim()]),
  ) as ExtractedCatalogItem;
  item.item_code = await nextInternalItemCode();
  const visiblePrice = parseNumericPrice(item.price);
  if (visiblePrice !== null) {
    const unitPrice =
      input.priceMode === "dozen" ? visiblePrice / 12 : visiblePrice;
    item.price = unitPrice.toFixed(2);
    item.minimum_quantity = unitPrice < 100 ? "3" : "1";
  } else {
    item.minimum_quantity = "3";
  }
  item.stock_status = item.stock_status || "in_stock";
  item.supplier_name = item.supplier_name || "المورد غير محدد";
  item.name_en = item.name_en || item.name_ar;
  item.name_hi = item.name_hi || item.name_ar;
  item.description_ar = item.description_ar || item.name_ar;
  item.description_en = item.description_en || item.name_en;
  item.description_hi = item.description_hi || item.name_hi;
  item.category = item.category || "ألعاب متنوعة";
  return item;
}

async function nextInternalItemCode() {
  const sql = await getDb();
  const rows = await sql`INSERT INTO counters (id, value) VALUES ('visible_item_code', 1001)
    ON CONFLICT(id) DO UPDATE SET value = counters.value + 1 RETURNING value` as Array<{ value: number }>;
  const row = rows[0];
  if (!row?.value) throw new Error("Could not create internal item code");
  return `RS-${row.value}`;
}

function parseNumericPrice(value: string) {
  const western = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬,]/g, "");
  const match = western.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

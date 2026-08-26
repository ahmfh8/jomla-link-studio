import { getDb } from "../../../../db";

const SECRET_ID="gemini_api_key";
const encoder=new TextEncoder();

function bytesToBase64(bytes:Uint8Array){let value="";for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value)}
async function encryptionKey(){const raw=String(process.env.GEMINI_MASTER_KEY||"");if(!raw)throw new Error("GEMINI_MASTER_KEY is not configured on Vercel");const digest=await crypto.subtle.digest("SHA-256",encoder.encode(raw));return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"])}
async function encrypt(value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const key=await encryptionKey();const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,encoder.encode(value));return{ciphertext:bytesToBase64(new Uint8Array(encrypted)),iv:bytesToBase64(iv)}}

async function verifyGeminiKey(apiKey:string){const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image",{headers:{"x-goog-api-key":apiKey}});if(response.ok)return;const detail=await response.json().catch(()=>null) as {error?:{message?:string}}|null;throw new Error(detail?.error?.message||`Gemini rejected the key (${response.status})`)}

export async function GET(){try{if(process.env.GEMINI_API_KEY)return Response.json({configured:true,model:"gemini-3.1-flash-image",source:"environment"});const sql=await getDb();const rows=await sql`SELECT updated_at FROM secrets WHERE id=${SECRET_ID} LIMIT 1` as Array<{updated_at:number}>;return Response.json({configured:Boolean(rows[0]),model:"gemini-3.1-flash-image",updatedAt:rows[0]?.updated_at??null})}catch(error){return Response.json({configured:false,error:error instanceof Error?error.message:"تعذر قراءة الإعدادات"},{status:503})}}

export async function POST(request:Request){try{const payload=await request.json() as {apiKey?:string};const apiKey=payload.apiKey?.trim()||"";if(apiKey.length<20)return Response.json({error:"مفتاح Gemini غير صالح"},{status:400});await verifyGeminiKey(apiKey);const encrypted=await encrypt(apiKey);const sql=await getDb();const now=Date.now();await sql`INSERT INTO secrets (id,ciphertext,iv,updated_at) VALUES (${SECRET_ID},${encrypted.ciphertext},${encrypted.iv},${now}) ON CONFLICT (id) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,iv=EXCLUDED.iv,updated_at=EXCLUDED.updated_at`;return Response.json({ok:true,model:"gemini-3.1-flash-image"})}catch(error){return Response.json({error:error instanceof Error?error.message:"تعذر حفظ المفتاح"},{status:400})}}

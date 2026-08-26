import { changeStudioPassword } from "../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    await changeStudioPassword(
      String(body.currentPassword || ""),
      String(body.newPassword || ""),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر تغيير كلمة المرور" },
      { status: 400 },
    );
  }
}

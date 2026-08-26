type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : "/";
  const error = params.error;

  return (
    <main className="login-page" dir="rtl">
      <section className="login-card">
        <div className="login-mark">JL</div>
        <p className="login-kicker">JOMLA LINK</p>
        <h1>استوديو الكتالوج الذكي</h1>
        <p className="login-intro">سجّل الدخول للوصول إلى مساحة العمل الخاصة بك.</p>

        {error === "credentials" && (
          <p className="login-error">اسم المستخدم أو كلمة المرور غير صحيحة.</p>
        )}
        {error === "config" && (
          <p className="login-error">بيانات الدخول غير مضبوطة على الخادم.</p>
        )}

        <form action="/api/auth/login" method="post" className="login-form">
          <input type="hidden" name="next" value={next} />
          <label>
            اسم المستخدم
            <input name="username" type="text" autoComplete="username" required autoFocus />
          </label>
          <label>
            كلمة المرور
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">دخول المنصة</button>
        </form>
        <p className="login-note">حساب خاص لمستخدم واحد</p>
      </section>
    </main>
  );
}

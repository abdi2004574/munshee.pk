import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { t } from "@/i18n";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { signupSchema, validateForm } from "@/lib/validation";
import { identifyUser } from "@/lib/analytics";

function translateAuthError(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes("already registered")) {
    return t("auth.errors.duplicate_email");
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return t("auth.errors.rate_limit");
  }
  return error;
}

export function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    const parsed = validateForm(signupSchema, {
      full_name: fullName,
      email,
      password,
    });
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.full_name },
        emailRedirectTo: window.location.origin + "/auth/callback",
      },
    });

    setLoading(false);

    if (error) {
      setError(translateAuthError(error.message));
      return;
    }

    if (data.user?.id) {
      identifyUser(data.user.id, { email: data.user.email });
    }

    if (data.session) {
      navigate("/dashboard");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
        <Card className="w-full max-w-md space-y-4 p-8">
          <h1 className="text-2xl font-semibold text-ink">
            {t("auth.signup.check_email_title")}
          </h1>
          <p className="text-sm text-ink-muted">
            {t("auth.signup.check_email_message").replace("{email}", email)}
          </p>
          <Link
            to="/login"
            className="inline-block text-sm text-brand-600 hover:text-brand-700"
          >
            {t("auth.signup.back_to_signin")}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink">{t("auth.signup.title")}</h1>
          <p className="text-sm text-ink-muted">{t("auth.signup.subtitle")}</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Input
            label={t("auth.signup.full_name")}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.full_name}
          />
          <Input
            label={t("auth.signup.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Input
            label={t("auth.signup.password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("auth.signup.creating") : t("auth.signup.submit")}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-muted">
          {t("auth.signup.already_have_account")}{" "}
          <Link to="/login" className="text-brand-600 hover:text-brand-700">
            {t("auth.signup.sign_in_link")}
          </Link>
        </p>
      </Card>
    </div>
  );
}

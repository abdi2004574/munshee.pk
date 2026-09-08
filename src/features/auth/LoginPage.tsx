import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { t } from "@/i18n";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { loginSchema, validateForm } from "@/lib/validation";
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

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    const parsed = validateForm(loginSchema, { email, password });
    if (!parsed.success) {
      setFieldErrors(parsed.errors);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    setLoading(false);

    if (error) {
      setError(translateAuthError(error.message));
      return;
    }

    if (rememberMe) {
      localStorage.setItem("munshee-remember-me", "true");
    }

    if (data.user?.id) {
      identifyUser(data.user.id, { email: data.user.email });
    }

    navigate("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink">{t("auth.login.title")}</h1>
          <p className="text-sm text-ink-muted">{t("auth.login.subtitle")}</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Input
            label={t("auth.login.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Input
            label={t("auth.login.password")}
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

          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            {t("auth.login.remember_me")}
          </label>

          <Button type="submit" className="w-full" disabled={loading}>
            {t("auth.login.submit")}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-muted">
          {t("auth.login.no_account")}{" "}
          <Link to="/signup" className="text-brand-600 hover:text-brand-700">
            {t("auth.login.create_one")}
          </Link>
        </p>
      </Card>
    </div>
  );
}

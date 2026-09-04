import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { signupSchema, validateForm } from "@/lib/validation";

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
      setError(error.message);
      return;
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
          <h1 className="text-2xl font-semibold text-ink">Check your email</h1>
          <p className="text-sm text-ink-muted">
            We sent a confirmation link to <strong>{email}</strong>. Follow it to
            activate your account.
          </p>
          <Link
            to="/login"
            className="inline-block text-sm text-brand-600 hover:text-brand-700"
          >
            Back to sign in
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink">Create account</h1>
          <p className="text-sm text-ink-muted">Get started with Munshee.pk</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Input
            label="Full name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.full_name}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Input
            label="Password"
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
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}


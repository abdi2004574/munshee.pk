import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";

export function CallbackPage() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    supabase.auth
      .exchangeCodeForSession(window.location.search)
      .then(({ error }) => {
        if (error) {
          navigate(`/login?error=${encodeURIComponent(error.message)}`, {
            replace: true,
          });
          return;
        }
        navigate("/dashboard", { replace: true });
      })
      .catch((err: Error) => {
        navigate(`/login?error=${encodeURIComponent(err.message)}`, {
          replace: true,
        });
      });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted">
      <p className="text-ink-muted">Completing sign in…</p>
    </div>
  );
}

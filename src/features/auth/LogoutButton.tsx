import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/Button";

export function LogoutButton() {
  const navigate = useNavigate();

  async function onLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <Button variant="secondary" onClick={onLogout}>
      Sign out
    </Button>
  );
}

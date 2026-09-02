import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useCreateCustomer } from "../hooks";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import type { CustomerInsert } from "@/lib/types";

export function CustomerNewPage() {
  const navigate = useNavigate();
  const create = useCreateCustomer();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const tenantId = sessionData.session?.user.id;
      if (!tenantId) throw new Error("Not authenticated");

      const payload: CustomerInsert = {
        tenant_id: tenantId,
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        metadata: null,
      };

      await create.mutateAsync(payload);
      navigate("/apps/customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">New customer</h1>
        <p className="text-sm text-ink-muted">Add a new customer to your records.</p>
      </div>
      <Card className="p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="md:col-span-2"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Tags (comma separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger md:col-span-2">{error}</p>}

          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate("/apps/customers")}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Create customer"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

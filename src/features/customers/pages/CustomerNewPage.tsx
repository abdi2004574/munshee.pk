import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useCreateCustomer } from "../hooks";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import type { CustomerInsert } from "@/lib/types";
import { customerSchema, validateForm } from "@/lib/validation";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const parsed = validateForm(customerSchema, {
        full_name: fullName,
        email: email || "",
        phone: phone || "",
        city: city || "",
        address: address || "",
        notes: notes || "",
        tags,
      });
      if (!parsed.success) {
        setFieldErrors(parsed.errors);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const tenantId = sessionData.session?.user.id;
      if (!tenantId) throw new Error("Not authenticated");

      const payload: CustomerInsert = {
        tenant_id: tenantId,
        full_name: parsed.data.full_name.trim(),
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        city: parsed.data.city || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
        tags: parsed.data.tags,
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
            error={fieldErrors.full_name}
            required
            className="md:col-span-2"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={fieldErrors.phone}
          />
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            error={fieldErrors.city}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              error={fieldErrors.address}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              error={fieldErrors.notes}
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


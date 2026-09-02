import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useCustomer, useSoftDeleteCustomer, useUpdateCustomer } from "../hooks";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import type { CustomerUpdate } from "@/lib/types";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const update = useUpdateCustomer();
  const softDelete = useSoftDeleteCustomer();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-ink-muted">Loading customer…</p>;
  }
  if (!customer) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">Customer not found.</p>
        <Link to="/apps/customers">
          <Button variant="secondary">Back to customers</Button>
        </Link>
      </div>
    );
  }

  function startEdit() { if (!customer) return;
    setFullName(customer.full_name);
    setEmail(customer.email ?? "");
    setPhone(customer.phone ?? "");
    setCity(customer.city ?? "");
    setAddress(customer.address ?? "");
    setNotes(customer.notes ?? "");
    setTagsInput(customer.tags.join(", "));
    setEditing(true);
    setError(null);
  }

  async function handleUpdate(e: React.FormEvent) { if (!customer) return;
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: CustomerUpdate = {
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
      };
      await update.mutateAsync({ id: customer.id, data: payload });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/apps/customers" className="text-sm text-ink-muted hover:text-ink">
            ← Customers
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{customer.full_name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => (editing ? setEditing(false) : startEdit())}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <Card className="p-6">
        {editing ? (
          <form onSubmit={handleUpdate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">Email</dt>
              <dd className="text-sm">{customer.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Phone</dt>
              <dd className="text-sm">{customer.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">City</dt>
              <dd className="text-sm">{customer.city ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Address</dt>
              <dd className="text-sm whitespace-pre-wrap">{customer.address ?? "—"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs text-ink-muted">Notes</dt>
              <dd className="text-sm whitespace-pre-wrap">{customer.notes ?? "—"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs text-ink-muted">Tags</dt>
              <dd className="text-sm">{customer.tags.length ? customer.tags.join(", ") : "—"}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Order History</h2>
        <p className="mt-2 text-sm text-ink-muted">Order history coming soon.</p>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete customer?"
        description={`"${customer.full_name}" will be removed.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await softDelete.mutateAsync(customer.id);
          navigate("/apps/customers");
        }}
      />
    </div>
  );
}

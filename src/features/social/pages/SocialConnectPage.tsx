import { useState } from "react";
import { useSearchParams } from "react-router";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import {
  useSocialConnections,
  useInitiateSocialConnect,
  useRevokeSocialConnection,
} from "../hooks";
import type { SocialConnection } from "@/lib/types";

const CREDENTIALS_ERROR = "Facebook OAuth credentials not configured";

interface ProviderConfig {
  provider: "facebook" | "instagram";
  label: string;
}

const PROVIDERS: ProviderConfig[] = [
  { provider: "facebook", label: "Facebook" },
  { provider: "instagram", label: "Instagram" },
];

function providerBadgeVariant(provider: string) {
  return provider === "facebook" ? "info" : "default";
}

function providerLabel(provider: string) {
  return provider === "facebook" ? "Facebook" : "Instagram";
}

export function SocialConnectPage() {
  const [searchParams] = useSearchParams();
  const connectedParam = searchParams.get("connected");
  const factsParam = searchParams.get("facts");
  const returnError = searchParams.get("error");

  const {
    data: connections,
    isLoading: connectionsLoading,
    refetch: refetchConnections,
  } = useSocialConnections();
  const initiate = useInitiateSocialConnect();
  const revoke = useRevokeSocialConnection();

  const [credentialsPending, setCredentialsPending] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const facebook = (connections ?? []).filter((c) => c.provider === "facebook");
  const instagram = (connections ?? []).filter(
    (c) => c.provider === "instagram",
  );
  const factsCount = factsParam ? Number(factsParam) : 0;

  async function handleConnect(provider: "facebook" | "instagram") {
    setConnectError(null);
    setCredentialsPending(false);
    try {
      const authUrl = await initiate.mutateAsync({ provider });
      window.location.href = authUrl;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to connect account";
      if (msg.includes(CREDENTIALS_ERROR)) {
        setCredentialsPending(true);
      } else {
        setConnectError(msg);
      }
    }
  }

  async function handleRevoke(connection: SocialConnection) {
    setRevokingId(connection.id);
    try {
      await revoke.mutateAsync(connection.id);
      refetchConnections();
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : "Failed to revoke connection",
      );
    } finally {
      setRevokingId(null);
    }
  }

  function renderConnectionRow(connection: SocialConnection) {
    const lastSync = connection.last_sync_at
      ? new Date(connection.last_sync_at).toLocaleString()
      : "Never";
    return (
      <div
        key={connection.id}
        className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <Badge variant={providerBadgeVariant(connection.provider)}>
            {providerLabel(connection.provider)}
          </Badge>
          <div>
            <p className="text-sm font-medium text-ink">
              {connection.page_name ?? `Page ${connection.page_id}`}
            </p>
            <p className="text-xs text-ink-muted">Last sync: {lastSync}</p>
          </div>
        </div>
        <Button
          variant="secondary"
          disabled={revokingId === connection.id}
          onClick={() => handleRevoke(connection)}
        >
          {revokingId === connection.id ? "Revoking…" : "Revoke"}
        </Button>
      </div>
    );
  }

  function renderConnectSlot(config: ProviderConfig) {
    const list = config.provider === "facebook" ? facebook : instagram;
    const isConnected = list.length > 0;

    if (isConnected) {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="success">{config.label} connected</Badge>
            <span className="text-sm text-ink-muted">
              {list.length} account{list.length > 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="primary"
            disabled={initiate.isPending}
            onClick={() => handleConnect(config.provider)}
          >
            Reconnect
          </Button>
        </div>
      );
    }

    return (
      <Button
        variant="primary"
        disabled={initiate.isPending}
        onClick={() => handleConnect(config.provider)}
      >
        {initiate.isPending ? "Connecting…" : `Connect ${config.label}`}
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Social Connect</h1>
        <p className="text-sm text-ink-muted">
          Connect your Facebook Page or Instagram Business account to let Munshee
          extract products, prices, and business facts from your social content.
        </p>
      </div>

      {credentialsPending && (
        <Card className="border-warning/20 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <Badge variant="warning">Coming soon</Badge>
            <div>
              <p className="text-sm font-medium text-warning">
                Facebook and Instagram integration is on its way.
              </p>
              <p className="text-xs text-ink-muted">
                You will soon be able to connect your Facebook Page or Instagram
                Business account to let Munshee extract products, prices, and
                business facts directly from your social content.
              </p>
            </div>
          </div>
        </Card>
      )}

      {connectedParam && (
        <Card className="border-success/20 bg-success/5 p-4">
          <div className="flex items-start gap-3">
            <Badge variant="success">Connected</Badge>
            <div>
              <p className="text-sm font-medium text-success">
                Successfully connected your {providerLabel(connectedParam)} account.
              </p>
              <p className="text-xs text-ink-muted">
                {factsCount > 0
                  ? `Extracted ${factsCount} fact${factsCount === 1 ? "" : "s"} — awaiting your review.`
                  : "No product facts were extracted from this account."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {returnError && !credentialsPending && (
        <Card className="border-danger/20 bg-danger/5 p-4">
          <Badge variant="danger">Error</Badge>
          <p className="mt-1 text-sm text-danger">
            {returnError === "sync_failed"
              ? "Something went wrong while syncing your account. Please try again."
              : returnError}
          </p>
        </Card>
      )}

      {connectError && !credentialsPending && (
        <Card className="border-danger/20 bg-danger/5 p-4">
          <Badge variant="danger">Error</Badge>
          <p className="mt-1 text-sm text-danger">{connectError}</p>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Connected accounts</h2>
        {connectionsLoading ? (
          <p className="mt-4 text-sm text-ink-muted">Loading connections…</p>
        ) : (connections ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            You haven't connected any accounts yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {[...facebook, ...instagram].map(renderConnectionRow)}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink">Connect an account</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {PROVIDERS.map(renderConnectSlot)}
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          This opens Meta's OAuth dialog. You will authorise Munshee.pk to read
          your page content. No tokens are stored without your consent.
        </p>
      </Card>
    </div>
  );
}

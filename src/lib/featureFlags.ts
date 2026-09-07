export type PlanFeatures = Record<string, boolean>;

export function hasFeature(
  features: PlanFeatures | null,
  feature: string,
): boolean {
  return Boolean(features?.[feature] === true);
}

export function requiresWatermark(planFeatures: PlanFeatures | null): boolean {
  return hasFeature(planFeatures, "watermark");
}

export function requiresClientSwitcher(
  planFeatures: PlanFeatures | null,
): boolean {
  return hasFeature(planFeatures, "client_switcher");
}

export function hasAskMunshee(planFeatures: PlanFeatures | null): boolean {
  return hasFeature(planFeatures, "ask_munshee");
}

export function hasVoiceDigest(planFeatures: PlanFeatures | null): boolean {
  return hasFeature(planFeatures, "voice_digest");
}

export function hasWaExportAnalysis(
  planFeatures: PlanFeatures | null,
): boolean {
  return hasFeature(planFeatures, "wa_export_analysis");
}

export function hasReportingExport(
  planFeatures: PlanFeatures | null,
): boolean {
  return hasFeature(planFeatures, "reporting_export");
}

export function hasDirectoryEligible(
  planFeatures: PlanFeatures | null,
): boolean {
  return hasFeature(planFeatures, "directory_eligible");
}

export function isExpertGated(planFeatures: PlanFeatures | null): boolean {
  return !requiresClientSwitcher(planFeatures);
}

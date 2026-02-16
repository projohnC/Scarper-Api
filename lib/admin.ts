export type AdminIdentity = {
  id?: string | null;
  email?: string | null;
};

const DEFAULT_USER_QUOTA_FALLBACK = 500;
const UNLIMITED_QUOTA = -1;

function parseCsvEnv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseQuotaEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;

  if (parsed === UNLIMITED_QUOTA) return UNLIMITED_QUOTA;
  if (parsed <= 0) return fallback;

  return parsed;
}

export function getDefaultUserQuota(): number {
  return parseQuotaEnv(process.env.DEFAULT_USER_QUOTA, DEFAULT_USER_QUOTA_FALLBACK);
}

export function getAdminQuota(): number {
  return parseQuotaEnv(process.env.ADMIN_REQUEST_QUOTA, UNLIMITED_QUOTA);
}

export function isUnlimitedQuota(quota: number): boolean {
  return quota < 0;
}

export function isAdminUser(identity: AdminIdentity): boolean {
  const adminEmails = parseCsvEnv(process.env.ADMIN_EMAILS);
  const adminUserIds = parseCsvEnv(process.env.ADMIN_USER_IDS);

  const email = identity.email?.trim().toLowerCase() || "";
  const userId = identity.id?.trim().toLowerCase() || "";

  return (email && adminEmails.includes(email)) || (userId && adminUserIds.includes(userId));
}

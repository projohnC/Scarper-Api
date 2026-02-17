export type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
};

function parseCsvEnv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(identity: AdminIdentity): boolean {
  const adminEmails = parseCsvEnv(process.env.ADMIN_EMAILS);
  const adminUserIds = parseCsvEnv(process.env.ADMIN_USER_IDS);
  const adminUsernames = parseCsvEnv(process.env.ADMIN_USERNAMES);

  const email = identity.email?.trim().toLowerCase() || "";
  const userId = identity.id?.trim().toLowerCase() || "";
  const username = identity.name?.trim().toLowerCase() || "";

  return !!(
    (email && adminEmails.includes(email)) ||
    (userId && adminUserIds.includes(userId)) ||
    (username && adminUsernames.includes(username))
  );
}

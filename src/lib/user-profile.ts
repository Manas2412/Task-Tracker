import { prisma } from '@/lib/db';

/**
 * View-only profile card shown when a person is opened from global search.
 * Deliberately small: the directory-level facts a colleague needs — who they
 * are, how to reach them, who they report to, and what they work on.
 *
 * The type is import-type-safe for the client popup (no prisma leaks into the
 * bundle); the fetch below is server-only.
 */
export type UserProfileCard = {
  id: string;
  name: string;
  username: string;
  designation: string;
  divisionName: string;
  divisionColour: string;
  phone: string | null;
  email: string | null;
  reportsToName: string | null;
  reportsToDesignation: string | null;
  workActivities: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
};

export async function getUserProfileCard(id: string): Promise<UserProfileCard | null> {
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      designation: true,
      phone: true,
      email: true,
      workActivities: true,
      isActive: true,
      isSuperAdmin: true,
      division: { select: { name: true, avatarColour: true } },
      supervisor: { select: { name: true, designation: true } },
    },
  });
  if (!u) return null;

  return {
    id: u.id,
    name: u.name,
    username: u.username,
    designation: u.designation,
    divisionName: u.division.name,
    divisionColour: u.division.avatarColour,
    phone: u.phone,
    email: u.email,
    reportsToName: u.supervisor?.name ?? null,
    reportsToDesignation: u.supervisor?.designation ?? null,
    workActivities: u.workActivities,
    isActive: u.isActive,
    isSuperAdmin: u.isSuperAdmin,
  };
}

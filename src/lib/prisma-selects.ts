import type { Prisma } from '@prisma/client';

export const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  designation: true,
  division: { select: { id: true, name: true, avatarColour: true } },
} satisfies Prisma.UserSelect;

export const ACTOR_SUMMARY_SELECT = {
  id: true,
  name: true,
} satisfies Prisma.UserSelect;

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing tasks, timeline files, and related data…');

  await prisma.timelineFileActivity.deleteMany();
  await prisma.timelineFileTaskLink.deleteMany();
  await prisma.timelineFileMarkedTo.deleteMany();
  await prisma.taskActivity.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.taskCollaborator.deleteMany();
  await prisma.taskTag.deleteMany();
  await prisma.reassignmentRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.timelineFile.deleteMany();

  console.log('Done. Divisions and users are untouched.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

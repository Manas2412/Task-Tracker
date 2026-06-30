/**
 * Re-register S3 attachments that lost their DB records after a re-seed.
 *
 * What it does:
 *   1. Lists every object in the S3 bucket
 *   2. Checks if a matching attachment record already exists (by fileUrl = key)
 *   3. Parses the S3 key to extract scope (task / tf_source / tf_action) + parent ID
 *   4. Checks if the parent task or timeline file still exists in the DB
 *   5. For matched parents, creates the attachment record
 *   6. For orphaned keys (parent no longer in DB), logs them
 *
 * The `uploadedBy` field is set to the first Super Admin / OSD user found,
 * since the original uploader ID may no longer exist.
 *
 * Usage:
 *   npx tsx scripts/relink-s3-attachments.ts           # dry run (default)
 *   npx tsx scripts/relink-s3-attachments.ts --commit   # actually write to DB
 */

import { PrismaClient } from '@prisma/client';
import { ListObjectsV2Command, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--commit');

function buildS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error('S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY must be set in .env');
  }
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'ap-south-1',
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });
}

type ParsedKey = {
  ownerType: 'task' | 'timeline_file_source' | 'timeline_file_action';
  parentId: string;
  fileName: string;
};

function parseS3Key(key: string): ParsedKey | null {
  // tasks/{taskId}/{uuid}-{filename}
  const taskMatch = key.match(/^tasks\/([0-9a-f-]{36})\/[0-9a-f-]{36}-(.+)$/i);
  if (taskMatch) {
    return { ownerType: 'task', parentId: taskMatch[1], fileName: taskMatch[2] };
  }

  // timeline-files/{tfId}/source/{uuid}-{filename}
  const tfSrcMatch = key.match(/^timeline-files\/([0-9a-f-]{36})\/source\/[0-9a-f-]{36}-(.+)$/i);
  if (tfSrcMatch) {
    return { ownerType: 'timeline_file_source', parentId: tfSrcMatch[1], fileName: tfSrcMatch[2] };
  }

  // timeline-files/{tfId}/action/{uuid}-{filename}
  const tfActMatch = key.match(/^timeline-files\/([0-9a-f-]{36})\/action\/[0-9a-f-]{36}-(.+)$/i);
  if (tfActMatch) {
    return { ownerType: 'timeline_file_action', parentId: tfActMatch[1], fileName: tfActMatch[2] };
  }

  return null;
}

function guessMimeType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    zip: 'application/zip',
    mp4: 'video/mp4',
  };
  return ext ? map[ext] ?? null : null;
}

async function main() {
  console.log(DRY_RUN ? '\n=== DRY RUN (pass --commit to write) ===\n' : '\n=== COMMIT MODE ===\n');

  const s3 = buildS3Client();
  const bucket = process.env.S3_BUCKET ?? 'myas-attachments';

  // Find a fallback uploader (OSD or first Super Admin)
  const fallbackUploader = await prisma.user.findFirst({
    where: {
      OR: [{ hierarchySlot: 'osd' }, { isSuperAdmin: true }],
      isActive: true,
    },
    select: { id: true, name: true },
    orderBy: { isSuperAdmin: 'desc' },
  });
  if (!fallbackUploader) {
    console.error('No OSD or Super Admin user found — cannot attribute uploads.');
    process.exit(1);
  }
  console.log(`Uploads will be attributed to: ${fallbackUploader.name} (${fallbackUploader.id})\n`);

  // List all S3 objects
  const allKeys: { key: string; size: number }[] = [];
  let continuationToken: string | undefined;

  do {
    const resp = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of resp.Contents ?? []) {
      if (obj.Key) allKeys.push({ key: obj.Key, size: obj.Size ?? 0 });
    }
    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);

  console.log(`Found ${allKeys.length} object(s) in S3 bucket "${bucket}"\n`);
  if (allKeys.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Check which keys already have attachment records
  const existingUrls = new Set(
    (await prisma.attachment.findMany({ select: { fileUrl: true } })).map((a) => a.fileUrl),
  );

  let created = 0;
  let skippedExisting = 0;
  let orphaned = 0;
  let unparseable = 0;

  for (const { key, size } of allKeys) {
    // Already registered?
    if (existingUrls.has(key)) {
      console.log(`  SKIP (exists)  ${key}`);
      skippedExisting++;
      continue;
    }

    const parsed = parseS3Key(key);
    if (!parsed) {
      console.log(`  SKIP (unknown format)  ${key}`);
      unparseable++;
      continue;
    }

    // Check parent exists
    let parentExists = false;
    if (parsed.ownerType === 'task') {
      parentExists = !!(await prisma.task.findUnique({ where: { id: parsed.parentId }, select: { id: true } }));
    } else {
      parentExists = !!(await prisma.timelineFile.findUnique({ where: { id: parsed.parentId }, select: { id: true } }));
    }

    if (!parentExists) {
      console.log(`  ORPHAN  ${key}  (${parsed.ownerType} ${parsed.parentId} not in DB)`);
      orphaned++;
      continue;
    }

    // Create attachment record
    const mimeType = guessMimeType(parsed.fileName);
    console.log(`  ${DRY_RUN ? 'WOULD CREATE' : 'CREATE'}  ${parsed.fileName}  →  ${parsed.ownerType}:${parsed.parentId}`);

    if (!DRY_RUN) {
      await prisma.attachment.create({
        data: {
          ownerType: parsed.ownerType,
          ownerId: parsed.parentId,
          fileName: parsed.fileName,
          fileUrl: key,
          mimeType,
          sizeBytes: size > 0 ? BigInt(size) : null,
          source: 'uploaded',
          uploadedById: fallbackUploader.id,
        },
      });
    }
    created++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Already registered : ${skippedExisting}`);
  console.log(`  ${DRY_RUN ? 'Would create' : 'Created'}       : ${created}`);
  console.log(`  Orphaned (no parent): ${orphaned}`);
  console.log(`  Unparseable keys   : ${unparseable}`);

  if (orphaned > 0) {
    console.log(`\nOrphaned files have S3 keys referencing task/TF IDs that no longer exist.`);
    console.log(`Options:`);
    console.log(`  1. Manually attach them via the app after identifying the correct task/TF`);
    console.log(`  2. Download them from S3 and re-upload through the UI`);
    console.log(`  3. If you have the old export.json, match old task names to new IDs`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

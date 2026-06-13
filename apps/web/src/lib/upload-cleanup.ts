import { prisma } from "@/lib/db";
import {
  deleteUploadByFilename,
  filenameFromUploadUrl,
  listUploadFilenames,
  uploadPublicUrl,
} from "@/lib/uploads";

async function countUploadReferences(filename: string): Promise<number> {
  const url = uploadPublicUrl(filename);
  const [eventCount, settingsCount] = await Promise.all([
    prisma.event.count({ where: { imageUrl: url } }),
    prisma.settings.count({ where: { orgLogoUrl: url } }),
  ]);
  return eventCount + settingsCount;
}

/** Delete an upload file when no Event or Settings row references its URL. */
export async function deleteUploadIfUnreferenced(
  url: string | null | undefined,
): Promise<void> {
  const filename = filenameFromUploadUrl(url);
  if (!filename) return;

  const refs = await countUploadReferences(filename);
  if (refs === 0) {
    await deleteUploadByFilename(filename);
  }
}

/** Remove upload files on disk that are not referenced by the database. */
export async function pruneUnreferencedUploads(): Promise<number> {
  const filenames = await listUploadFilenames();
  let deleted = 0;

  for (const filename of filenames) {
    const refs = await countUploadReferences(filename);
    if (refs === 0) {
      await deleteUploadByFilename(filename);
      deleted++;
    }
  }

  return deleted;
}

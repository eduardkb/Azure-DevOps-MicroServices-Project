
import { BlobServiceClient } from "@azure/storage-blob";

function csvEscape(value) {
  const s = String(value ?? "");
  const escaped = s.replace(/"/g, '""'); // escape double quotes
  return `"${escaped}"`;                 // wrap in quotes
}

export default async function writeLog(
  context,
  storageAccountUrl,
  credential,
  type,
  op,
  opid,
  message
) {
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().split("T")[0];

  // Normalize message safely (strip newlines for single-line CSV)
  const normalizedMessage = String(message ?? "").replace(/\r?\n|\r/g, " ");

  // Build CSV line with proper quoting
  const logLine =
    [
      csvEscape(timestamp.toISOString()),
      csvEscape(type),
      csvEscape(op),
      csvEscape(opid),
      csvEscape(normalizedMessage)
    ].join(",") + "\n";

  // Always log to console
  context.log(`${type}-${op}-${opid}: ${normalizedMessage}`);

  // Guard: if URL or credential missing, skip blob logging
  if (!storageAccountUrl || !credential) {
    context.log("Info: Log skipped. No storage account URL or no credential");
    return;
  }

  try {
    // Initialize blob service
    const blobServiceClient = new BlobServiceClient(storageAccountUrl, credential);
    const containerClient = blobServiceClient.getContainerClient("function-log");
    await containerClient.createIfNotExists();

    const appendBlobClient = containerClient.getAppendBlobClient(`${dateStr}_log.csv`);

    // Define the CSV header
    const header = "TimeStamp,Type,TriggerCode,OperationCode,LogMessage\n";

    // Check if the blob exists
    const exists = await appendBlobClient.exists();

    if (!exists) {
      // Create the append blob; set content type for better tooling
      await appendBlobClient.create({
        blobHTTPHeaders: { blobContentType: "text/csv; charset=utf-8" }
      });
      await appendBlobClient.appendBlock(header, Buffer.byteLength(header));
    }

    // Append the actual log line
    await appendBlobClient.appendBlock(logLine, Buffer.byteLength(logLine));
  } catch (err) {
    context.log.error(`Blob logging failed: ${err && err.message ? err.message : err}`);
  }
}

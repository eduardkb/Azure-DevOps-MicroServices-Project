
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import { ServiceBusClient } from "@azure/service-bus";
import writeLog from "../helpers/logFunction.js";
import validateJwt from "../helpers/validateJwt.js";

/**
 * Sanitizes a segment (base file name, or extension) to contain ONLY [A-Za-z0-9_].
 * - Replaces spaces and ALL special characters with "_"
 * - Removes diacritics (e.g., "ç" -> "c", "á" -> "a")
 * - Collapses multiple underscores and trims leading/trailing underscores
 * - Ensures non-empty result, falling back to "unnamed"
 *
 * NOTE: Do NOT use this for patientId anymore. PatientId must remain unmodified.
 */
function sanitizeSegment(input) {
  if (typeof input !== "string") return "unnamed";
  const noDiacritics = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let sanitized = noDiacritics.replace(/[^A-Za-z0-9]+/g, "_"); // everything not alnum -> "_"
  sanitized = sanitized.replace(/_+/g, "_"); // collapse "___" -> "_"
  sanitized = sanitized.replace(/^_+|_+$/g, ""); // trim underscores
  return sanitized || "unnamed";
}

/**
 * Returns seconds elapsed since 2020-01-01 00:00:00 UTC.
 * This keeps the sequence smaller than a full Unix epoch timestamp.
 */
function secondsSince2020UTC() {
  const baseMs = Date.UTC(2020, 0, 1, 0, 0, 0); // 2020-01-01T00:00:00Z
  const nowMs = Date.now();
  return Math.floor((nowMs - baseMs) / 1000);
}

/**
 * Sanitizes file name while preserving a single dot before the extension.
 * - Splits on the last '.' to detect extension (if present)
 * - Sanitizes base name and extension separately
 * - Returns "<timestamp>_<sanitizedBase>.<sanitizedExt>" or "<timestamp>_<sanitizedBase>" if no extension
 */
function buildFinalFileNamePreserveExt(originalFileName, tsSeconds) {
  const input = typeof originalFileName === "string" ? originalFileName.trim() : "";
  const noDiacritics = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lastDot = noDiacritics.lastIndexOf(".");

  const basePart = lastDot > 0 ? noDiacritics.slice(0, lastDot) : noDiacritics;
  const extPart = lastDot > 0 ? noDiacritics.slice(lastDot + 1) : "";

  const sanitizedBase = sanitizeSegment(basePart);
  const sanitizedExt = sanitizeSegment(extPart);

  if (sanitizedExt) {
    return `${tsSeconds}_${sanitizedBase}.${sanitizedExt}`;
  }
  return `${tsSeconds}_${sanitizedBase}`;
}

export default async function (context, req) {
  if (!process.env.AZURE_STORAGE_ACCOUNT_URL || !process.env.AZURE_SERVICE_BUS_CONN_STRING) {
    const errorContent = "Missing required environment variables.";
    context.log(errorContent);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: errorContent },
    };
    return;
  }

  const credential = new DefaultAzureCredential();
  const storageAccountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
  const serviceBusConnectionString = process.env.AZURE_SERVICE_BUS_CONN_STRING;
  const hex = Math.floor(Math.random() * 0x100000).toString(16).padStart(5, "0");
  const op = "trig-doc-upl";

  await writeLog(context, storageAccountUrl, credential, "info", op, hex, `http-queue-uploaddocs trigger fired!`);
  await writeLog(context, storageAccountUrl, credential, "info", op, hex, `Env. Vars: |${storageAccountUrl}|${serviceBusConnectionString}|`);

  // AUTHENTICATION AND AUTHORIZATION
  const accessLevel = "write";
  const accToken = req.headers["authorization"]?.split(" ")[1];
  const valRes = await validateJwt(accToken, accessLevel);
  if (!valRes.success) {
    context.res = {
      status: 403,
      headers: { "Content-Type": "application/json" },
      body: {
        success: false,
        message: valRes.message,
      },
    };
    return;
  } else {
    await writeLog(context, storageAccountUrl, credential, "info", op, hex, `Success validating token: ${JSON.stringify(valRes)}`);
  }

  try {
    // === Read mandatory parameters ===
    const patientId = req.body?.patientId ?? req.query?.patientId; // fixed bug
    const fileName = req.body?.fileName ?? req.query?.fileName;
    const fileSizeParam = req.body?.fileSize ?? req.query?.fileSize;
    const fileType = req.body?.fileType ?? req.query?.fileType;

    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "info",
      op,
      hex,
      `Received parameters: |patientID:${patientId}|fileName:${fileName}|fileSize:${fileSizeParam}|fileType:${fileType}|`
    );

    // Validate presence of mandatory parameters
    const missing = [];
    if (!patientId) missing.push("patientId");
    if (!fileName) missing.push("fileName");
    if (!fileSizeParam) missing.push("fileSize");
    if (!fileType) missing.push("fileType");
    if (missing.length > 0) {
      const msg = `Missing mandatory parameter(s): ${missing.join(", ")} (expected in body or query).`;
      await writeLog(context, storageAccountUrl, credential, "error", op, hex, msg);
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }

    // === Retrieve file content from request ===
    // Supports: raw binary (req.rawBody), Buffer req.body, base64 in body.fileBase64 or body.fileContent
    let fileBuffer;

    if (req.body?.fileBase64 && typeof req.body.fileBase64 === "string") {
      fileBuffer = Buffer.from(req.body.fileBase64, "base64");
    } else if (req.body?.fileContent) {
      if (typeof req.body.fileContent === "string") {
        fileBuffer = Buffer.from(req.body.fileContent, "base64");
      } else if (req.body.fileContent?.type === "Buffer" && Array.isArray(req.body.fileContent.data)) {
        fileBuffer = Buffer.from(req.body.fileContent.data);
      }
    } else if (Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    } else if (typeof req.rawBody === "string" && req.headers["content-type"]?.startsWith("application/octet-stream")) {
      // Raw binary: wrap rawBody into Buffer.
      fileBuffer = Buffer.from(req.rawBody);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      const msg =
        "Missing file content in request. Provide raw binary with 'Content-Type: application/octet-stream' or 'fileBase64'/'fileContent' in body.";
      await writeLog(context, storageAccountUrl, credential, "error", op, hex, msg);
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }

    // Validate fileSize
    const declaredSize = Number(fileSizeParam);
    if (!Number.isFinite(declaredSize) || declaredSize <= 0) {
      const msg = "Invalid 'fileSize' (must be a positive number).";
      await writeLog(context, storageAccountUrl, credential, "error", op, hex, msg);
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }
    if (fileBuffer.length !== declaredSize) {
      const msg = `Provided 'fileSize' (${declaredSize}) does not match actual content length (${fileBuffer.length}).`;
      await writeLog(context, storageAccountUrl, credential, "error", op, hex, msg);
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }

    // === Use patientId EXACTLY as provided; do NOT sanitize ===
    const originalPatientId = patientId; // <-- CHANGED: preserve as-is
    const ts = secondsSince2020UTC();
    const finalFileName = buildFinalFileNamePreserveExt(fileName, ts); // e.g., "185702345_report.pdf"

    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "info",
      op,
      hex,
      `Identifiers: |patientID:${originalPatientId}|finalFileName:${finalFileName}|` // <-- CHANGED: log original
    );

    // === Upload to Storage: container 'patient-files' under path '{patientId}/{finalFileName}' ===
    await writeLog(context, storageAccountUrl, credential, "info", op, hex, `Preparing upload for patientId=${originalPatientId}, fileName=${finalFileName}`);

    const blobServiceClient = new BlobServiceClient(storageAccountUrl, credential);
    const containerClient = blobServiceClient.getContainerClient("patient-files");
    await containerClient.createIfNotExists();

    // <-- CHANGED: use original patientId directly in path (no sanitization)
    const blobPath = `${originalPatientId}/${finalFileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: fileType }, // rely on content-type for consumers
    });

    const blobUrl = blockBlobClient.url; // Full HTTPS URL to the uploaded blob
    await writeLog(context, storageAccountUrl, credential, "info", op, hex, `Uploaded blob to: ${blobUrl}`);

    // === Send message to Service Bus queue 'uploaddoc' ===
    const sbClient = new ServiceBusClient(serviceBusConnectionString);
    const sender = sbClient.createSender("uploaddoc");

    const sbMessageBody = {
      // <-- CHANGED: patientId remains original
      patientId: originalPatientId,
      fileName: finalFileName,
      fileSize: declaredSize,
      fileType,
      blobUrl,
      original: {
        patientId, // same value
        fileName,
      },
    };

    await sender.sendMessages({
      body: sbMessageBody,
      contentType: "application/json",
      subject: "patient-file-upload",
      applicationProperties: {
        eventType: "UploadDoc",
        // <-- CHANGED: application properties also use original patientId
        patientId: originalPatientId,
      },
    });

    await sender.close();
    await sbClient.close();

    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "info",
      op,
      hex,
      `Queued message to 'uploaddoc' with payload: ${JSON.stringify(sbMessageBody)}`
    );
    await writeLog(context, storageAccountUrl, credential, "info", op, hex, `FUNCTION SUCCESSFUL EXECUTION TO THE END`);

    // === Response ===
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        success: true,
        message: "File uploaded and message queued successfully.",
        data: sbMessageBody,
      },
    };
  } catch (err) {
    const errorMsg = err?.message || JSON.stringify(err);
    const resMsg = `Error while uploading documents: ${errorMsg}`;
    await writeLog(context, process.env.AZURE_STORAGE_ACCOUNT_URL, new DefaultAzureCredential(), "error", op, hex, resMsg);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: resMsg },
    };
  }
}

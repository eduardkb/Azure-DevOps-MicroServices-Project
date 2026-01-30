
import { DefaultAzureCredential } from "@azure/identity";
import {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential
} from "@azure/storage-blob";
import { MongoClient } from "mongodb";
import writeLog from "../helpers/logFunction.js";
import getKvSecret from '../helpers/getKvSecret.js';
import validateJwt from '../helpers/validateJwt.js';

// Cache client across invocations
let cachedMongoClient = null;

/**
 * Appends a read-only Blob SAS (1 hour) to the given blobUrl using StorageSharedKeyCredential.
 * Expects URLs like: https://<account>.blob.core.windows.net/patient-files/<path/to/blob>
 */
function appendReadSasWithAccountKey({
  accountName,
  accountKey,
  blobUrl,
  startsOn,
  expiresOn
}) {
  const url = new URL(blobUrl);

  // Parse container and blob name
  const pathParts = url.pathname.replace(/^\/+/, "").split("/");
  const containerName = pathParts[0];
  const blobName = pathParts.slice(1).join("/");

  // Validate container
  if (containerName !== "patient-files") {
    // You can harden this if needed:
    // throw new Error(`Unexpected container '${containerName}'. Expected 'patient-files'.`);
  }

  // Build credential from account key
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

  // Read permission only
  const permissions = BlobSASPermissions.parse("r");

  // Build SAS
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions,
      startsOn,
      expiresOn,
    },
    sharedKeyCredential
  ).toString();

  // Append SAS; preserve existing query string if any
  const separator = url.search && url.search.length > 0 ? "&" : "?";
  return `${blobUrl}${separator}${sas}`;
}

export default async function (context, req) {
  if (!process.env.AZURE_STORAGE_ACCOUNT_URL) {
    const errorContent = "Missing required environment variables.";
    context.log(errorContent);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: errorContent },
    };
    return;
  }

  const dbName = "healthcare-database";
  const collectionName = "report";
  const credential = new DefaultAzureCredential();
  const storageAccountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;

  const hex = Math.floor(Math.random() * 0x100000).toString(16).padStart(5, '0');
  const op = "http-rep-get";

  await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `http-report-get trigger fired!`);

  // AUTHENTICATION AND AUTHORIZATION
  const accessLevel = "read";
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
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Success validating token: ${JSON.stringify(valRes)}`);
  }

  // Accept identifiers from query string or request body
  const q = req.query || {};
  const b = req.body || {};
  const patientIdRaw = q.patientId ?? b.patientId;

  // Validate input
  const patientId = typeof patientIdRaw === 'string' ? patientIdRaw.trim() : patientIdRaw;
  if (!patientId) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: {
        error: "Missing patient identifier. Provide 'patientId'.",
        examples: [
          "GET /api/report?patientId=P-12345",
          "POST /api/report { \"patientId\": \"P-12345\" }",
        ],
      },
    };
    return;
  }

  try {
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Env. Vars: |${storageAccountUrl}|`);

    // Get MongoDB connection string
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Getting MongoDB connection string`);
    const resKv = await getKvSecret("CosmosDb-ConStr", credential);

    if (resKv.status !== 200) {
      const resMsg = `Error while getting KV secret 'CosmosDb-ConStr'. Message: ${resKv.body}`;
      await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: resMsg }
      };
      return;
    }

    const mongoDbConnStr = resKv.body;
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Success retrieving MongoDB connection string`);

    // Reuse or create cached client
    if (!cachedMongoClient) {
      cachedMongoClient = new MongoClient(mongoDbConnStr, {
        serverSelectionTimeoutMS: 15000,
      });
      await cachedMongoClient.connect();
    }
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Connection to MongoDB succeeded`);

    const db = cachedMongoClient.db(dbName);
    const reports = db.collection(collectionName);

    // Get all reports by patientId
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Querying reports for patientId='${patientId}'`);
    const filter = { patientId };
    const resultReports = await reports.find(filter).toArray();

    if (!resultReports || resultReports.length === 0) {
      const msg = `No reports found for patientId '${patientId}'.`;
      await writeLog(context, storageAccountUrl, credential, "Info", op, hex, msg);
      context.res = {
        status: 404,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }

    // --- Retrieve the storage account key from Key Vault ---
    const accountName = new URL(storageAccountUrl).hostname.split(".")[0];

    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Getting storage account key (secret: 'storage-key') from Key Vault`);
    const resKey = await getKvSecret("storage-key", credential); 
    if (resKey.status !== 200) {
      const resMsg = `Error while getting KV secret 'storage-key'. Message: ${resKey.body}`;
      await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: resMsg }
      };
      return;
    }
    const accountKey = resKey.body;

    // SAS validity window (1 hour), with 5 minutes back for clock skew
    const now = new Date();
    const startsOn = new Date(now.getTime() - 5 * 60 * 1000);
    const expiresOn = new Date(now.getTime() + 60 * 60 * 1000);

    const reportsWithSas = await Promise.all(
      resultReports.map(async (r) => {
        if (!r.blobUrl) {
          await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Report _id=${r._id} has no blobUrl; leaving unchanged`);
          return r;
        }

        try {
          const url = new URL(r.blobUrl);
          const urlAccountName = url.hostname.split(".")[0];
          if (urlAccountName !== accountName) {
            await writeLog(
              context,
              storageAccountUrl,
              credential,
              "Warning",
              op,
              hex,
              `Report _id=${r._id} blobUrl points to a different account (${url.hostname}); leaving unchanged`
            );
            return r;
          }

          const signedUrl = appendReadSasWithAccountKey({
            accountName,
            accountKey,
            blobUrl: r.blobUrl,
            startsOn,
            expiresOn,
          });

          return { ...r, blobUrl: signedUrl };
        } catch (e) {
          await writeLog(
            context,
            storageAccountUrl,
            credential,
            "Error",
            op,
            hex,
            `Failed to append SAS for report _id=${r._id}: ${e?.message || JSON.stringify(e)}`
          );
          return r; // fallback: return original
        }
      })
    );

    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Retrieved ${reportsWithSas.length} report(s) for patientId='${patientId}'`);
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `FUNCTION SUCCESSFUL EXECUTION TO THE END`);

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: reportsWithSas,
    };
  } catch (err) {
    const errorMsg = err?.message || JSON.stringify(err);
    const resMsg = `Error while getting reports: ${errorMsg}`;
    await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: resMsg },
    };
  }
}

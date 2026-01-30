
import { DefaultAzureCredential } from "@azure/identity";
import { MongoClient } from "mongodb";
import getKvSecret from '../helpers/getKvSecret.js'
import writeLog from "../helpers/logFunction.js";

// === Configuration ===
const dbName = "healthcare-database";
const collectionName = "report";

// Utility: async sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function (context, myQueueItem) {
  const storageAccountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
  
  // Validate required env vars
  if (!storageAccountUrl) {
    const errorContent =
      "Missing required environment variables: AZURE_STORAGE_ACCOUNT_URL.";
    context.log.error(errorContent);
    // Throw so the runtime does NOT complete (dequeue) the message
    throw new Error(errorContent);
  }

  const processStartAt = new Date().toISOString();
  const credential = new DefaultAzureCredential();
  const hex = Math.floor(Math.random() * 0x100000).toString(16).padStart(5, '0');
  const op = "trig-doc-pro"
  await writeLog(
    context,
    storageAccountUrl,
    credential,
    "info", op, hex,
    "servicebus-queue-processingdocs trigger fired!"
  );
  await writeLog(
    context,
    storageAccountUrl,
    credential,
    "info", op, hex,
    `Env. Vars: |${storageAccountUrl}|`
  );

  // Parse message body (string or object)
  let sbMessageBody;
  try {
    sbMessageBody =
      typeof myQueueItem === "string" ? JSON.parse(myQueueItem) : myQueueItem;
  } catch (e) {
    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "info", op, hex,
      `Invalid message body. Could not parse JSON: ${e.message}`
    );
    throw e;
  }

  // Validate expected fields
  const requiredFields = [
    "patientId",
    "fileName",
    "fileSize",
    "fileType",
    "blobUrl",
  ];
  const missing = requiredFields.filter(
    (k) => sbMessageBody[k] === undefined || sbMessageBody[k] === null
  );
  if (missing.length > 0) {
    const msg = `Message missing required fields: ${missing.join(", ")}`;
    await writeLog(context, storageAccountUrl, credential, "error", op, hex,msg);
    throw new Error(msg);
  }

  // GET MONGOOEB CONNECTION STRING
  await writeLog(context, storageAccountUrl, credential, "info", op, hex,`Getting MongoDB connection string`);
  const resKv = await getKvSecret("CosmosDb-ConStr",credential);
  if(resKv.status !== 200){
      const resMsg = `Error while getting KV secret 'CosmosDb-ConStr'. Message: ${resKv.body}}`
      await writeLog(context, storageAccountUrl, credential, "error", op, hex,resMsg);
      context.res = {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: { error: resMsg }
      };
      return;
  }
  const mongoDbConnStr = resKv.body;        
  await writeLog(context, storageAccountUrl, credential, "info", op, hex,`Success Retrieving mongoDB connection String: ${mongoDbConnStr}`);


  // Random delay: 0..(8*60) seconds (inclusive)
  const randomSeconds = Math.floor(Math.random() * (8 * 60 + 1));
  await writeLog(
    context,
    storageAccountUrl,
    credential,
    "info", op, hex,
    `Random processing delay selected: ${randomSeconds}s | patient=${sbMessageBody.patientId} | file=${sbMessageBody.fileName}`
  );

  // Log every 10s during the wait
  const fullSteps = Math.floor(randomSeconds / 10);
  const remainder = randomSeconds % 10;

  for (let step = 1; step <= fullSteps; step++) {
    await sleep(10 * 1000);
    const elapsed = step * 10;
    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "info", op, hex,
      `Document is being processed (elapsed ${elapsed}s of ${randomSeconds}s) | patient=${sbMessageBody.patientId} | file=${sbMessageBody.fileName}`
    );
  }
  if (remainder > 0) {
    await sleep(remainder * 1000);
  }

  // Persist entire message body to Cosmos DB (Mongo API)
  const client = new MongoClient(mongoDbConnStr);
  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);

    const docToInsert = {
      ...sbMessageBody,
      processed: true,
      processStartAt: processStartAt,
      processFinisheddAt: new Date().toISOString(),
      processingDelaySeconds: randomSeconds,
    };

    const insertResult = await collection.insertOne(docToInsert);

    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "info", op, hex,
      `Queued message on 'uploaddoc' processed successfully. Saved to '${dbName}.${collectionName}' with _id=${insertResult.insertedId}`
    );
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `FUNCTION SUCCESSFUL EXECUTION TO THE END`);
    context.log(
      `Processed and stored report: _id=${insertResult.insertedId}, patient=${sbMessageBody.patientId}`
    );
  } catch (err) {
    const errorMsg = err?.message || JSON.stringify(err);
    const resMsg = `Error while processing documents: ${errorMsg}`;
    await writeLog(context, storageAccountUrl, credential, "error", op, hex,resMsg);

    // Throw so the message is NOT completed and will be retried/dead-lettered per settings
    throw err;
  } finally {
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
  }
}

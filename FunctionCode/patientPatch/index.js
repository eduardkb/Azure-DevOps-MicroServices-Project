
import { DefaultAzureCredential } from "@azure/identity";
import { MongoClient, ObjectId } from "mongodb";
import writeLog from "../helpers/logFunction.js";
import getKvSecret from "../helpers/getKvSecret.js";
import validateJwt from "../helpers/validateJwt.js";

// Cache client across invocations
let cachedMongoClient = null;

export default async function (context, req) {
  // ---- Basic env validation ----
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
  const collectionName = "patient";
  const credential = new DefaultAzureCredential();
  const storageAccountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
  const hex = Math.floor(Math.random() * 0x100000).toString(16).padStart(5, '0');
  const op = "http-pat-pat"
  await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `http-patient-patch trigger fired!`);

  // ---- AUTHENTICATION & AUTHORIZATION ----
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
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Success validating token: ${JSON.stringify(valRes)}`);
  }

  try {
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Env. Vars: |${storageAccountUrl}|`);

    // ---- Key Vault: Mongo connection string ----
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Getting MongoDB connection string`);
    const resKv = await getKvSecret("CosmosDb-ConStr", credential);
    if (resKv.status !== 200) {
      const resMsg = `Error while getting KV secret 'CosmosDb-ConStr'. Message: ${resKv.body}}`;
      await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);
      context.res = {
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: { error: resMsg },
      };
      return;
    }
    const mongoDbConnStr = resKv.body;
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Success Retrieving mongoDB connection String.`);

    // ---- INPUT VALIDATION ----
    // Only accept patientId from body or query. Do NOT accept from route or bindingData.
    const patientId = req.body?.patientId ?? req.query?.patientId;
    if (!patientId) {
      const msg = "Missing 'patientId' (expected in body or query).";
      await writeLog(context, storageAccountUrl, credential, "Error", op, hex, msg);
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }

    const payload = req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      const msg = "Invalid body. Expecting a JSON object with fields to patch.";
      await writeLog(context, storageAccountUrl, credential, "Error", op, hex, msg);
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }

    // Remove keys that must NEVER be updated (primary keys or aliases)
    const {
      _id: _ignoredObjectIdFromBody,
      id: _ignoredIdAliasFromBody,
      patientId: _ignoredPatientIdFromBody,
      patientID: _ignoredPatientIDFromBody,
      ...fieldsToSet
    } = payload;

    if (Object.keys(fieldsToSet).length === 0) {
      const msg = "No updatable fields provided in request body (all provided keys are immutable or missing).";
      await writeLog(context, storageAccountUrl, credential, "Error", op, hex, msg);
      context.res = {
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }

    // ---- MongoDB connection (reuse cached client) ----
    if (!cachedMongoClient) {
      cachedMongoClient = new MongoClient(mongoDbConnStr);
      await cachedMongoClient.connect();
      await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `MongoDB client initialized and connected.`);
    } else {
      await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Using cached MongoDB client.`);
    }

    const db = cachedMongoClient.db(dbName);
    const collection = db.collection(collectionName);

    // ---- Find the existing patient (MUST exist; never upsert) ----
    // Accept patientId that may represent:
    //   - a Mongo ObjectId for _id
    //   - a string primary key in patientID
    //   - (in some schemas) a string _id
    const filterForLookup = ObjectId.isValid(patientId)
      ? { _id: new ObjectId(patientId) }
      : { $or: [{ _id: patientId }, { patientId: patientId }] };

    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "Info", op, hex,
      `Looking up patient with filter=${JSON.stringify(filterForLookup)}`
    );

    const existingPatient = await collection.findOne(filterForLookup);

    if (!existingPatient) {
      const msg = "Patient not found.";
      await writeLog(context, storageAccountUrl, credential, "Error", op, hex, msg);
      context.res = {
        status: 404,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }

    // ---- Patch only provided fields; DO NOT change _id or patientID ----
    const updateDoc = { $set: fieldsToSet };

    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "Info", op, hex,
      `Patching patient _id=${existingPatient._id?.toString?.() ?? existingPatient._id}; fieldsToSet=${JSON.stringify(fieldsToSet)}`
    );

    // Strictly no upsert
    const updateResult = await collection.updateOne({ _id: existingPatient._id }, updateDoc, { upsert: false });

    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "Info", op, hex,
      `Patch result: matchedCount=${updateResult.matchedCount}, modifiedCount=${updateResult.modifiedCount}`
    );

    if (updateResult.matchedCount === 0) {
      // Extremely unlikely because we found the doc, but handle race conditions
      const msg = "Patient not found during update (possible concurrent deletion).";
      await writeLog(context, storageAccountUrl, credential, "Error", op, hex, msg);
      context.res = {
        status: 404,
        headers: { "Content-Type": "application/json" },
        body: { success: false, message: msg },
      };
      return;
    }

    // Fetch updated document
    const updatedPatient = await collection.findOne({ _id: existingPatient._id });

    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "Info", op, hex,
      `Updated patient=${JSON.stringify(updatedPatient)}`
    );

    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `FUNCTION SUCCESSFUL EXECUTION TO THE END`);

    // Always 200 (never create)
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        success: true,
        message: "Patient updated.",
        id: updatedPatient?._id,
        patientID: updatedPatient?.patientID,
        data: updatedPatient,
      },
    };
  } catch (err) {
    const errorMsg = err?.message || JSON.stringify(err);
    const resMsg = `Error while patching patient: ${errorMsg}`;
    // storageAccountUrl is defined above; safe to log
    await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);    
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: resMsg },
    };
  }
}

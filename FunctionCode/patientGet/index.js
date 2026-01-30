
import { DefaultAzureCredential } from "@azure/identity";
import { MongoClient, ObjectId } from "mongodb";
import writeLog from "../helpers/logFunction.js";
import getKvSecret from '../helpers/getKvSecret.js'
import validateJwt from '../helpers/validateJwt.js'

// Cache client across invocations
let cachedMongoClient = null;

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
  const collectionName = "patient";
  const credential = new DefaultAzureCredential();
  const storageAccountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;  
  const hex = Math.floor(Math.random() * 0x100000).toString(16).padStart(5, '0');
  const op = "http-pat-get"
  await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `http-patient-get-one trigger fired!`);  

  // AUTHENTICATION AND AUTHORIZATION
  const accessLevel = "read"
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
  }
  else{
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Success validating token: ${JSON.stringify(valRes)}`);
  }

  // Accept identifiers from query string or request body
  const q = req.query || {};
  const b = req.body || {};

  // Accept either `_id` (Mongo ObjectId string) or a business key like `patientId`
  const idStr = q._id ?? b._id ?? q.id ?? b.id;           // supports ?_id= or ?id=, or body
  const patientId = q.patientId ?? b.patientId;            // optional business identifier

  // Validate input
  if (!idStr && !patientId) {
    context.res = {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: {
        error:
          "Missing patient identifier. Provide 'id' or 'patientId'.",
        examples: [
          "GET /api/patient?id=665f2d9872c8c2ea4b33a1f1",
          "GET /api/patient?patientId=ABC-1234",
        ],
      },
    };
    return;
  }

  try {    
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Env. Vars: |${storageAccountUrl}|`);

    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Getting MongoDB connection string`);
    const resKv = await getKvSecret("CosmosDb-ConStr",credential);
    if(resKv.status !== 200){
        const resMsg = `Error while getting KV secret 'CosmosDb-ConStr'. Message: ${resKv.body}}`
        await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: resMsg }
        };
        return;
    }
    const mongoDbConnStr = resKv.body;        
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Success Retrieving mongoDB connection String: ${mongoDbConnStr}`);

    if (!cachedMongoClient) {
      cachedMongoClient = new MongoClient(mongoDbConnStr, {
        serverSelectionTimeoutMS: 15000,
      });
      await cachedMongoClient.connect();
    }
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Connection to MongoDB succeeded`);

    const db = cachedMongoClient.db(dbName);
    const patients = db.collection(collectionName);

    // Build filter safely
    let filter = {};
    let lookupType = "";

    if (idStr) {
      // Try parse as ObjectId; if invalid, return 400
      if (ObjectId.isValid(idStr)) {
        filter = { _id: new ObjectId(idStr) };
        lookupType = "_id";
      } else {
        context.res = {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: { error: "Invalid '_id' value." },
        };
        return;
      }
    } else {
      // Fallback to patientId (business key)
      filter = { patientId };
      lookupType = "patientId";
    }

    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "Info", op, hex,
      `Looking up patient by ${lookupType} value ${JSON.stringify(filter)}`
    );

    // Projection: adjust to exclude sensitive fields from response.
    const projection = {
      // Example: include typical demographic fields if needed; hide internal audit fields:
      // name: 1, dateOfBirth: 1, gender: 1, addresses: 1, contacts: 1, status: 1,
      createdAt: 0,
      updatedAt: 0,
      _internalAudit: 0,
    };

    const patient = await patients.findOne(filter, { projection });

    if (!patient) {
      await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Patient not found for ${lookupType} filter: ${JSON.stringify(filter)}`);
      context.res = {
        status: 404,
        headers: { "Content-Type": "application/json" },
        body: { error: "Patient not found." },
      };
      return;
    }

    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Patient found for ${lookupType}`);
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `FUNCTION SUCCESSFUL EXECUTION TO THE END`);
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: patient,
    };
  } catch (err) {
    const errorMsg = err?.message || JSON.stringify(err);
    const resMsg = `Error while getting patient: ${errorMsg}`;
    await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: resMsg },
    };
  }
}

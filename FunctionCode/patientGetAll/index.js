
import { DefaultAzureCredential } from "@azure/identity";
import writeLog from "../helpers/logFunction.js";
import { MongoClient } from "mongodb";
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
  const op = "http-pat-gal"
  await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `http-patient-getAll trigger fired!`);  

  // AUTHENTICATION AND AUTHORIZATION
  const AZURE_JWT_TENANT_ID = process.env.AZURE_JWT_TENANT_ID;
  const AZURE_JWT_EXPECTED_AUD = process.env.AZURE_JWT_EXPECTED_AUD;

  if(!AZURE_JWT_TENANT_ID || !AZURE_JWT_EXPECTED_AUD){
    await writeLog(context, storageAccountUrl, credential, "ERROR", op, hex, `Mandatory authentication env. variables not present (|AZURE_JWT_TENANT_ID|AZURE_JWT_EXPECTED_AUD|): |${AZURE_JWT_TENANT_ID}|${AZURE_JWT_EXPECTED_AUD}|`);
  }

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

  // Query options: simple pagination
  const pageSizeParam = req.query?.pageSize || req.body?.pageSize;
  const pageParam = req.query?.page || req.body?.page;
  const pageSize = Math.max(1, Math.min(parseInt(pageSizeParam || "100", 10), 500)); // cap at 500
  const page = Math.max(1, parseInt(pageParam || "1", 10));
  const skip = (page - 1) * pageSize;

  // NEW: Parse filterDeleted from query/body with tolerant semantics
  const rawFilterDeleted = req.query?.filterDeleted ?? req.body?.filterDeleted;
  const normalizeBool = (val) => {
    if (val === undefined || val === null) return false;
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val === 1;
    if (typeof val === "string") {
      const s = val.trim().toLowerCase();
      return ["true", "1", "yes", "y"].includes(s);
    }
    return false;
  };
  const filterDeleted = normalizeBool(rawFilterDeleted);

  // Build Mongo filter
  const mongoFilter = {};
  if (filterDeleted) {
    // only documents where `deleted` field exists and is exactly false
    // Using $exists + equality ensures we exclude docs where deleted is missing or true
    mongoFilter.deleted = { $exists: true, $eq: false };
  }

  try {    
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Env. Vars: |${storageAccountUrl}|`);
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Getting MongoDB connection string`);

    const resKv = await getKvSecret("CosmosDb-ConStr", credential);
    if(resKv.status !== 200){
        const resMsg = `Error while getting KV secret 'CosmosDb-ConStr'. Message: ${resKv.body}}`;
        await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: resMsg }
        };
        return;
    }
    const mongoDbConnStr = resKv.body;        
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Success Retrieving mongoDB connection String`);

    if (!cachedMongoClient) {
      cachedMongoClient = new MongoClient(mongoDbConnStr, {
        serverSelectionTimeoutMS: 15000,
      });
      await cachedMongoClient.connect();
    }
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Connection to MongoDB succeeded`);

    const db = cachedMongoClient.db(dbName);
    const patients = db.collection(collectionName);

    // Projection: adjust to exclude sensitive fields from response.
    const projection = {
      // Example: include typical demographic fields if needed; hide internal audit fields:
      // name: 1, dateOfBirth: 1, gender: 1, addresses: 1, contacts: 1, status: 1,
      // createdAt: 0,
      // updatedAt: 0,
      // _internalAudit: 0,
    };

    // Count total docs (for pagination metadata)
    const totalCount = await patients.countDocuments(mongoFilter);
    await writeLog(
      context,
      storageAccountUrl,
      credential,
      "Info", op, hex,
      `Fetching patients page=${page}, pageSize=${pageSize}, totalItems=${totalCount}, filterDeleted=${filterDeleted}`
    );

    // Fetch patients with pagination
    const cursor = patients
      .find(mongoFilter, { projection })
      .skip(skip)
      .limit(pageSize)
      .sort({ _id: 1 }); // stable sort by id

    const items = await cursor.toArray();
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Fetched ${items.length} patient(s)`);
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `FUNCTION SUCCESSFUL EXECUTION TO THE END`);
    // Response payload
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        message: "Successful DB Consult",
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),    
        filterDeleted,
        items,
      },
    };
  } catch (err) {
    const errorMsg = err?.message || JSON.stringify(err);
    const resMsg = `Error while getting patients: ${errorMsg}`;
    await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: resMsg },
    };
  }
}
import {DefaultAzureCredential} from "@azure/identity";
import { MongoClient } from "mongodb"
import writeLog from '../helpers/logFunction.js';
import getKvSecret from '../helpers/getKvSecret.js'
import validateJwt from '../helpers/validateJwt.js'

// Cache client across invocations
let cachedMongoClient = null;

export default async function (context, req) {    
    if (!process.env.AZURE_STORAGE_ACCOUNT_URL) {
        const errorContent = "Missing required environment variables." 
        context.log(errorContent)
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: errorContent }
        };
        return;
    }

    const dbName = "healthcare-database";
    const collectionName = "patient";
    const credential = new DefaultAzureCredential();
    const storageAccountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;  
    const hex = Math.floor(Math.random() * 0x100000).toString(16).padStart(5, '0');
    const op = "http-pat-pos"
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex,`http-patient-post trigger fired!`);   

    // AUTHENTICATION AND AUTHORIZATION
    const accessLevel = "write"
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

    // Start function logic
    try {                
        await writeLog(context, storageAccountUrl, credential, "Info", op, hex,`Env. Vars: |${storageAccountUrl}|`);

        await writeLog(context, storageAccountUrl, credential, "Info", op, hex,`Getting MongoDB connection string`);
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
        await writeLog(context, storageAccountUrl, credential, "Info", op, hex,`Success Retrieving mongoDB connection String: ${mongoDbConnStr}`);

        // Validate JSON body
        const patientBody = req.body;
        if (!patientBody || typeof patientBody !== "object") {
        context.res = {
            status: 400,
            headers: { "Content-Type": "application/json" },
            body: { error: "Invalid or missing patient information." },
        };
        return;
        }

        // Minimal normalization without logging PHI
        const patientDoc = { ...patientBody };
        patientDoc.deleted = false

        // Timestamps
        const now = new Date();
        patientDoc.createdAt = patientDoc.createdAt || now;
        patientDoc.updatedAt = now;
        
        if (!cachedMongoClient) {
            cachedMongoClient = new MongoClient(mongoDbConnStr, {
            serverSelectionTimeoutMS: 15000,
            });
            await cachedMongoClient.connect();
        }
        await writeLog(context, storageAccountUrl, credential, "Info", op, hex,`Connection to MongoDB succeeded`);

        const db = cachedMongoClient.db(dbName);
        const patients = db.collection(collectionName);

        await writeLog(context, storageAccountUrl, credential, "Info", op, hex,`Starting to write patient: ${JSON.stringify(patientDoc)}`);
        const insertResult = await patients.insertOne(patientDoc);

        await writeLog(context, storageAccountUrl, credential, "Info", op, hex,`Inserted patient =${JSON.stringify(insertResult)}`);
        await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `FUNCTION SUCCESSFUL EXECUTION TO THE END`);
        context.res = {
        status: 201,
        headers: { "Content-Type": "application/json" },
        body: { id: insertResult.insertedId, message: `Patient created.` },
        };
    } catch (err) {
        const errorMsg = err?.message || JSON.stringify(err);
        const resMsg = `Error while writing patient: ${errorMsg}`
        await writeLog(context, storageAccountUrl, credential, "error", op, hex,resMsg);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: resMsg }
        };
    }
};

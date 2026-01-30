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
    const op = "http-pat-del"
    await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `http-patient-delete trigger fired!`);   

    // AUTHENTICATION AND AUTHORIZATION
    const accessLevel = "admin"
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

        // Chaneing "deleted" field to true
        const patientId =
            req.params?.patientId ||
            req.query?.patientId ||
            req.body?.patientId        
                
        // Validate input
        if (!patientId) {
            throw new Error("Missing required parameter: patientId");
        }

        // Create/reuse MongoDB client
        if (!cachedMongoClient) {
            cachedMongoClient = new MongoClient(mongoDbConnStr);
            await cachedMongoClient.connect();
        }

        const db = cachedMongoClient.db(dbName);
        const collection = db.collection(collectionName);

        // Soft-delete: set `deleted` to true (creates field if it does not exist)
        const deleteResult = await collection.updateOne(
            { patientId: patientId },        // filter by patientId
            { $set: { deleted: true, deletedAt: new Date() }}    // create/overwrite deleted field
        )

        // If no matching patient, surface an error
        if (deleteResult.matchedCount === 0) {
            throw new Error(`No patient found with patientId '${patientId}'.`);
        }

        await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `Modified patient =${JSON.stringify(deleteResult)}`);
        await writeLog(context, storageAccountUrl, credential, "Info", op, hex, `FUNCTION SUCCESSFUL EXECUTION TO THE END`);
        context.res = {
            status: 201,
            headers: { "Content-Type": "application/json" },
            body: {
                success: true,
                patientId,
                matched: deleteResult.matchedCount,
                modified: deleteResult.modifiedCount,
                message: "Patient deleted."
            },
        };
    } catch (err) {
        const errorMsg = err?.message || JSON.stringify(err);
        const resMsg = `Error deleting patient: ${errorMsg}`
        await writeLog(context, storageAccountUrl, credential, "Error", op, hex, resMsg);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: resMsg }
        };
    }
};

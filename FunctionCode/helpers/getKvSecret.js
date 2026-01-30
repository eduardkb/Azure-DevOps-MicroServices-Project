import { SecretClient } from "@azure/keyvault-secrets";

export default async function getKvSecret (secretName, credential) {        
    try{
        const endpoint = process.env.AZURE_KEYVAULT_ENDPOINT;
        if(!endpoint){
            return { status: 500, body: "No Key Vault endpoint configured." };
        }
        
        const client = new SecretClient(endpoint, credential);
        const secret = await client.getSecret(secretName);

        // verify: disabled secret
        if (secret?.properties?.enabled === false) {
        return { status: 403, body: `Secret '${secretName}' is disabled.` };
        }
        // verify: null/empty value
        if (!secret?.value || `${secret.value}`.length === 0) {
            return { status: 404, body: `Secret '${secretName}' has no value.` };
        }

        const setting = secret.value;
        return {
            status: 200,
            body: setting,
            details: {
                name: secretName,
                version: secret?.properties?.version,
                enabled: secret?.properties?.enabled === true
            }
        }
    }
    catch (err) {
        const msg = err?.message || JSON.stringify(err);
        return { status: 500, body: `Error while getting kv secret: ${msg}` };
    }
}


// validateJwt.js
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const AZURE_JWT_TENANT_ID = process.env.AZURE_JWT_TENANT_ID;
const AZURE_JWT_EXPECTED_AUD = process.env.AZURE_JWT_EXPECTED_AUD; 
const AZURE_JWT_CLOCK_SKEW_SEC = Number(process.env.AZURE_JWT_JWT_CLOCK_SKEW_SEC ?? 120);

// Simple, cached OIDC discovery + JWKS client
let discoveredIssuer = "";
let stsIssuer = "";
let jwksUri = "";
let jwks = null;
let discoveryDone = false;

async function discover() {
  if (discoveryDone) return;

  if (!AZURE_JWT_TENANT_ID) throw new Error(`Configuration error: AZURE_JWT_TENANT_ID is not set. Value recived: ${AZURE_JWT_TENANT_ID}`);
  if (!AZURE_JWT_EXPECTED_AUD) throw new Error(`Configuration error: JWT_VALIDATE_AUD is not set. Value recived: ${AZURE_JWT_EXPECTED_AUD}`);

  const wellKnown = `https://login.microsoftonline.com/${AZURE_JWT_TENANT_ID}/v2.0/.well-known/openid-configuration`;
  stsIssuer = `https://sts.windows.net/${AZURE_JWT_TENANT_ID}/`;
  const res = await fetch(wellKnown);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: HTTP ${res.status}`);
  }
  const meta = await res.json();

  // issuer ends with /v2.0 for v2 tokens; jwks_uri points to current signing keys
  discoveredIssuer = meta.issuer;
  jwksUri = meta.jwks_uri;

  jwks = jwksClient({
    jwksUri,
    cache: true,
    cacheMaxEntries: 10,
    cacheMaxAge: 6 * 60 * 60 * 1000, // 6 hours
    timeout: 10000
  });

  discoveryDone = true;
}

function getSigningKey(header, callback) {
  if (!header || !header.kid) {
    return callback(new Error("Invalid token header: missing 'kid'."));
  }
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    try {
      const signingKey = key.getPublicKey();
      return callback(null, signingKey);
    } catch (e) {
      return callback(e);
    }
  });
}

export default async function validateJwt(token, accessLevel) {
  if (!token) {
    return { success: false, message: "Access denied: Token not present" };
  }
  if (!accessLevel || typeof accessLevel !== "string") {
    return { success: false, message: "Access denied: Required access level not specified" };
  }

  try {
    await discover(); // ensure issuer & JWKS are loaded

    // Verify signature & core claims
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getSigningKey,
        {
          algorithms: ["RS256"],            // Enforce RS256
          issuer: [discoveredIssuer, stsIssuer],      // Must match `iss` in token (ends with /v2.0 for v2)
          audience: `api://${AZURE_JWT_EXPECTED_AUD}`,           // Must match `aud` (v2 = API clientId; v1 = App ID URI)
          clockTolerance: AZURE_JWT_CLOCK_SKEW_SEC    // Allow small clock skew for exp/nbf
          // Note: jsonwebtoken checks `exp` and `nbf` by default
        },
        (err, payload) => (err ? reject(err) : resolve(payload))
      );
    });

    // Additional Microsoft‑recommended checks
    const ver = decoded?.ver;            // "2.0" or "1.0"
    const tid = decoded?.tid;            // tenant id
    if (!ver || (ver !== "2.0" && ver !== "1.0")) {
      return { success: false, message: "Access denied: Unsupported token version" };
    }
    if (!tid || tid !== AZURE_JWT_TENANT_ID) {
      return { success: false, message: "Access denied: Tenant mismatch" };
    }

    // Normalize permissions:
    // - Delegated (user) flow => scp (space-delimited string)
    // - App-only (client credentials) => roles (array of strings)
    const scopes = typeof decoded?.scp === "string" ? decoded.scp.split(" ") : [];
    const roles =
      Array.isArray(decoded?.roles) ? decoded.roles :
      typeof decoded?.roles === "string" ? [decoded.roles] :
      [];
    
    const resValidate = validateAccess(scopes, roles, accessLevel)
    if (resValidate.success) {
      // Success
      return { success: true, decoded };
    }
    else{
      return { success: false, message: resValidate.message };
    }
  } catch (err) {
    return { success: false, message: `Access denied: ${err.message}` };
  }
}

function validateAccess(scopes, roles, accessLevel) {
  try{
    // verify if "roles" have access level.
    const tokenPermissions = roles.map(r => r.split('.')[1] ?? r)  
    switch (true) {
      case tokenPermissions.includes("admin"):
        return {success: true, message: `'Admin' role. Full access allowed.  User role: '${tokenPermissions}'. API requested role: '${accessLevel}'`}
      case tokenPermissions.includes("write"):
        if(accessLevel == 'write' || accessLevel == 'read'){
          return {success: true, message: `Access allowed. User role: '${tokenPermissions}'. API requested role: '${accessLevel}'`}
        }
        else{
          return {success: false, message: `You do not have access to the '${accessLevel}' role. User role: '${tokenPermissions}'. API requested role: '${accessLevel}'`}
        }
      case tokenPermissions.includes("read"):
        if(accessLevel == 'read'){
          return {success: true, message: `Access allowed. User role: '${tokenPermissions}'. API requested role: '${accessLevel}'`}
        }
        else{
          return {success: false, message: `You do not have access to the '${accessLevel}' role. User role: '${tokenPermissions}'. API requested role: '${accessLevel}'`}
        }
      default:
        return {success: false, message: "Problems evaluating access roles. Access Denied."}
    }
  }
  catch(err){
    return { success: false, message: `Problems evaluating access roles. Access denied: ${err.message}` };
  }
}


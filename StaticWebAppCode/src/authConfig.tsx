// authConfig.ts
import type { Configuration } from "@azure/msal-browser";

const API_URL = import.meta.env.VITE_BACKEND_API_URL ?? "";
const WEB_KEY = import.meta.env.VITE_WEB_KEY ?? "";

type AppSettings = {
  TENANT_ID: string;
  EXPECTED_AUD: string;
  WEB_CLIENTID: string;
};

let settings: AppSettings | null = null;

/**
 * Loads app settings from backend (or uses defaults if envs are missing / call fails).
 */
export async function initAuthConfig(): Promise<void> {

  if (!API_URL || !WEB_KEY) {
    // Fallback defaults
    settings = {
      TENANT_ID: "AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB",
      EXPECTED_AUD: "AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB",
      WEB_CLIENTID: "AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB",
    };
    return;
  }

  try {
    const res = await fetch(      
      `${API_URL}/api/getsettings?key=${encodeURIComponent(WEB_KEY)}`,
      {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      }
    );

    if (!res.ok) {
      console.error(`Error: ${res.status} while getting application settings.`);
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    const s = json?.settings as AppSettings | undefined;

    if (!s) {
      throw new Error("Missing 'settings' in response.");
    }

    settings = s;
  } catch (err) {
    console.error(`Error: Exception while getting application settings.`, err);
    // Keep safe defaults
    settings ??= {
      TENANT_ID: "AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB",
      EXPECTED_AUD: "AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB",
      WEB_CLIENTID: "AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB",
    };
  }
}

export function getMsalConfig(): Configuration {
  if (!settings) throw new Error("initAuthConfig() must be called before getMsalConfig()");
  return {
    auth: {
      clientId: settings.WEB_CLIENTID,
      authority: `https://login.microsoftonline.com/${settings.TENANT_ID}`,
    },
  };
}

export const appRoles = {
  Read: "app.read",
  Write: "app.write",
  Admin: "app.admin",
};

export function getProtectedResources() {
  if (!settings) throw new Error("initAuthConfig() must be called before getProtectedResources()");
  const API_CLI_ID = settings.EXPECTED_AUD;

  return {
    api: {
      getPatient: `${API_URL}/api/PatientGet`,
      getAllPatient: `${API_URL}/api/PatientGetAll`,
      insertPatient: `${API_URL}/api/PatientPost`,
      deletePatient: `${API_URL}/api/PatientDelete`,
      modifyPatient: `${API_URL}/api/PatientPatch`,
      uploadReport: `${API_URL}/api/queueUploadDocs`,
      getReport: `${API_URL}/api/reportGet`,
      scopes: [`api://${API_CLI_ID}/.default`],
    },
  };
}

export function getLoginRequest() {
   const pr = getProtectedResources();
  return { scopes: [...pr.api.scopes] };
}

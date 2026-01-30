
import React, { useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { IPublicClientApplication, AuthenticationResult } from "@azure/msal-browser";
import { getLoginRequest, getProtectedResources, appRoles } from "../authConfig";
import { MessageContextType } from "../components/MessageContext";
import { useMessage } from "../components/useMessage";

// ===== Types =====
type Insurance = {
  provider?: string;
  memberNumber?: string;
};

type BackendPatient = {
  _id?: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dob: string; // normalized to YYYY-MM-DD on submit
  gender?: "M" | "F" | "O" | string;
  email?: string;
  phone?: string;
  insurance?: Insurance;
  deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
};

type NewPatientForm = {
  patientId: string; // Now: numbers only, 4–10 digits
  firstName: string;
  lastName: string;
  dobInput: string; // dd/mm/yyyy (user input)
  gender: "" | "M" | "F" | "O";
  email: string;
  phone: string;
  insuranceProvider: string;
  insuranceMemberNumber: string;
};

type ModifyPatientForm = {
  originalPatientId: string; // loaded when screen opens
  patientId: string; // editable; may change, and if changed+blur => load target record
  firstName: string;
  lastName: string;
  dobInput: string; // dd/mm/yyyy (user input)
  gender: "" | "M" | "F" | "O";
  email: string;
  phone: string;
  insuranceProvider: string;
  insuranceMemberNumber: string;
  deleted: boolean;
};

type UploadReportForm = {
  patientId: string;
  fileType: "" | "Text" | "PDF" | "Image";
  file: File | null;
};

type PagedResponse<T> = {
  message?: string;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
  items?: T[];
};

// Generic report shape: render all fields defensively
type BackendReport = Record<string, unknown> & {
  id?: string;
  reportId?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  uploadedAt?: string;
  // common link fields
  fileUrl?: string;
  sasUrl?: string;
  url?: string;
  storageUrl?: string;
  sasToken?: string;
};

type ApiEndpoints = {
  getPatient: string;
  getAllPatient: string;
  insertPatient: string;
  deletePatient: string;
  modifyPatient: string;
  uploadReport: string; // NEW: endpoint to upload patient report
  getReport: string;
  scopes: string[];
};

// ===== Utility type guards & helpers =====
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const getRolesFromAuthResult = (res: AuthenticationResult | undefined): string[] => {
  if (!res) return [];
  const claims = res.idTokenClaims as unknown;
  if (isRecord(claims) && "roles" in claims) {
    const rolesVal = (claims as { roles?: unknown }).roles;
    if (Array.isArray(rolesVal) && rolesVal.every((r) => typeof r === "string")) {
      return rolesVal;
    }
  }
  return [];
};

/** Validate patientId: numbers only, length 4–10 */
const isValidPatientId = (value: string): boolean => /^\d{4,10}$/.test((value ?? "").trim());

/** Validate name field: required, 3–30 chars */
const isValidName = (value: string): boolean => {
  const v = (value ?? "").trim();
  return v.length >= 3 && v.length <= 30;
};

/** Parse dd/mm/yyyy -> YYYY-MM-DD, ensuring a real calendar date */
const normalizeDobInput = (
  input: string
): { ok: boolean; iso?: string; error?: string } => {
  const raw = (input ?? "").trim();
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return { ok: false, error: "Date of birth must be in the format dd/mm/yyyy." };

  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);

  if (mm < 1 || mm > 12) return { ok: false, error: "Month must be between 01 and 12." };
  if (dd < 1 || dd > 31) return { ok: false, error: "Day must be between 01 and 31." };
  if (yyyy < 1900 || yyyy > 2100) return { ok: false, error: "Year must be between 1900 and 2100." };

  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
    return { ok: false, error: "Invalid date. Please check day/month/year." };
  }

  const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return { ok: true, iso };
};

/** Display date as dd/mm/yyyy from 'YYYY-MM-DD' or other inputs; returns safe fallback */
const displayDob = (value?: string): string => {
  if (!value) return "";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return value; // fallback (e.g., invalid "1988-07-70")
};

/** Normalize backend list response to an array */
const normalizeList = (payload: unknown): BackendPatient[] => {
  if (Array.isArray(payload)) {
    const arr = payload as unknown[];
    return arr.filter(isRecord).map((p) => p as BackendPatient);
  }
  if (isRecord(payload) && "items" in payload) {
    const itemsVal = (payload as PagedResponse<unknown>).items;
    if (Array.isArray(itemsVal)) {
      return itemsVal.filter(isRecord).map((p) => p as BackendPatient);
    }
  }
  if (isRecord(payload)) {
    const maybePatients = (payload as Record<string, unknown>).patients;
    if (Array.isArray(maybePatients)) {
      return maybePatients.filter(isRecord).map((p) => p as BackendPatient);
    }
    const maybeData = (payload as Record<string, unknown>).data;
    if (Array.isArray(maybeData)) {
      return maybeData.filter(isRecord).map((p) => p as BackendPatient);
    }
  }
  return [];
};

/** Normalize backend report list response to an array */
const normalizeReportList = (payload: unknown): BackendReport[] => {
  if (Array.isArray(payload)) {
    const arr = payload as unknown[];
    return arr.filter(isRecord).map((r) => r as BackendReport);
  }
  if (isRecord(payload) && "items" in payload) {
    const itemsVal = (payload as PagedResponse<unknown>).items;
    if (Array.isArray(itemsVal)) {
      return itemsVal.filter(isRecord).map((r) => r as BackendReport);
    }
  }
  if (isRecord(payload)) {
    const maybeReports = (payload as Record<string, unknown>).reports;
    if (Array.isArray(maybeReports)) {
      return maybeReports.filter(isRecord).map((r) => r as BackendReport);
    }
    const maybeData = (payload as Record<string, unknown>).data;
    if (Array.isArray(maybeData)) {
      return maybeData.filter(isRecord).map((r) => r as BackendReport);
    }
  }
  return [];
};

// ===== Auth: access token + roles =====
const acquireAuth = async (
  instance: IPublicClientApplication,
  addMessage: MessageContextType["addMessage"]
): Promise<{ accessToken: string; roles: string[]; result?: AuthenticationResult }> => {
  try {
    await instance.initialize();
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }
    const res = await instance.acquireTokenSilent(getLoginRequest());
    const accessToken = res.accessToken ?? "";
    const roles = getRolesFromAuthResult(res);

    if (!accessToken) {
      addMessage("error", "Error: could not retrieve access token.");
    }

    return { accessToken, roles, result: res };
  } catch (err) {
    addMessage("error", `Error acquiring token. Full Error: ${String(err)}`);
    return { accessToken: "", roles: [] };
  }
};

// Helper role checks against an arbitrary roles list
const canReadFromRoles = (r: string[]): boolean =>
  r.includes(appRoles.Read) || r.includes(appRoles.Write) || r.includes(appRoles.Admin);

// ===== Main Component =====
const PatientPage: React.FC = () => {
  const { instance } = useMsal();
  const { addMessage } = useMessage();

  const [accessToken, setAccessToken] = useState<string>("");
  const [roles, setRoles] = useState<string[]>([]);
  const [patients, setPatients] = useState<BackendPatient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [page] = useState<number>(1);
  const [pageSize] = useState<number>(100);

  // Views: 'list' | 'add' | 'details' | 'modify' | 'upload'
  const [view, setView] = useState<"list" | "add" | "details" | "modify" | "upload">("list");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [selectedPatient, setSelectedPatient] = useState<BackendPatient | null>(null);

  const [form, setForm] = useState<NewPatientForm>({
    patientId: "",
    firstName: "",
    lastName: "",
    dobInput: "",
    gender: "",
    email: "",
    phone: "",
    insuranceProvider: "",
    insuranceMemberNumber: "",
  });

  const [modifyForm, setModifyForm] = useState<ModifyPatientForm>({
    originalPatientId: "",
    patientId: "",
    firstName: "",
    lastName: "",
    dobInput: "",
    gender: "",
    email: "",
    phone: "",
    insuranceProvider: "",
    insuranceMemberNumber: "",
    deleted: false,
  });

  const [uploadForm, setUploadForm] = useState<UploadReportForm>({
    patientId: "",
    fileType: "",
    file: null,
  });
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Reports state
  const [reports, setReports] = useState<BackendReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState<boolean>(false);

  const endpoints: ApiEndpoints = useMemo(() => {
    try {
      const pr = getProtectedResources();
      return pr.api;
    } catch {
      return {
        getPatient: "",
        getAllPatient: "",
        insertPatient: "",
        deletePatient: "",
        modifyPatient: "",
        uploadReport: "",
        getReport: "",
        scopes: [],
      };
    }
  }, []);

  // Role checks (based on state)
  const hasRole = (r: string): boolean => roles.includes(r);
  const canRead = hasRole(appRoles.Read) || hasRole(appRoles.Write) || hasRole(appRoles.Admin);
  const canCreate = hasRole(appRoles.Write) || hasRole(appRoles.Admin);
  const canModify = hasRole(appRoles.Write) || hasRole(appRoles.Admin);
  const canDelete = hasRole(appRoles.Admin);

  // ===== API Functions =====

  // Fetch patients (paged)
  const fetchPatients = async (token: string): Promise<void> => {
    if (!endpoints.getAllPatient) {
      addMessage("error", "API endpoint 'getAllPatient' is not configured.");
      return;
    }
    setLoading(true);
    try {
      const url = new URL(endpoints.getAllPatient);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("filterDeleted", String("true"));

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: unknown = await res.json();
      const list = normalizeList(json);
      setPatients(list);
    } catch (err) {
      addMessage("error", `Error fetching patients. Full Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch patient by id
  const fetchPatientById = async (token: string, patientId: string): Promise<BackendPatient | null> => {
    if (!endpoints.getPatient) {
      addMessage("error", "API endpoint 'getPatient' is not configured.");
      return null;
    }
    try {
      const url = new URL(endpoints.getPatient);
      url.searchParams.set("patientId", patientId);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (res.status === 404) {
        addMessage("warning", `Patient '${patientId}' not found.`);
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: unknown = await res.json();
      if (isRecord(json)) {
        return json as BackendPatient;
      }
      const arr = normalizeList(json);
      return arr[0] ?? null;
    } catch (err) {
      addMessage("error", `Error fetching patient '${patientId}'. Full Error: ${String(err)}`);
      return null;
    }
  };

  // Insert patient
  const insertPatient = async (token: string, payload: BackendPatient): Promise<boolean> => {
    if (!endpoints.insertPatient) {
      addMessage("error", "API endpoint 'insertPatient' is not configured.");
      return false;
    }
    try {
      const res = await fetch(endpoints.insertPatient, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const errJson: unknown = await res.json();
          if (isRecord(errJson) && typeof errJson.message === "string") {
            msg = errJson.message;
          }
        } catch {
          // ignore JSON parsing error
        }
        throw new Error(msg);
      }

      addMessage("success", "Patient added successfully.");
      return true;
    } catch (err) {
      addMessage("error", `Error adding patient. Full Error: ${String(err)}`);
      return false;
    }
  };

  // Modify patient (PATCH with changed fields; original patientId in query)
  const patchPatient = async (
    token: string,
    originalPatientId: string,
    changes: Partial<BackendPatient>
  ): Promise<boolean> => {
    if (!endpoints.modifyPatient) {
      addMessage("error", "API endpoint 'modifyPatient' is not configured.");
      return false;
    }
    try {
      const url = new URL(endpoints.modifyPatient);
      url.searchParams.set("patientId", originalPatientId);

      const res = await fetch(url.toString(), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(changes),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const errJson: unknown = await res.json();
          if (isRecord(errJson) && typeof errJson.message === "string") {
            msg = errJson.message;
          }
        } catch {
          // ignore JSON parsing error
        }
        throw new Error(msg);
      }

      addMessage("success", `Patient '${originalPatientId}' updated successfully.`);
      return true;
    } catch (err) {
      addMessage("error", `Error modifying patient '${originalPatientId}'. Full Error: ${String(err)}`);
      return false;
    }
  };

  // Delete patient (DELETE with patientId query)
  const deletePatient = async (token: string, patientId: string): Promise<boolean> => {
    if (!endpoints.deletePatient) {
      addMessage("error", "API endpoint 'deletePatient' is not configured.");
      return false;
    }
    try {
      const url = new URL(endpoints.deletePatient);
      url.searchParams.set("patientId", patientId);

      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const errJson: unknown = await res.json();
          if (isRecord(errJson) && typeof errJson.message === "string") {
            msg = errJson.message;
          }
        } catch {
          // ignore JSON parsing error
        }
        throw new Error(msg);
      }

      addMessage("success", `Patient '${patientId}' deleted successfully.`);
      return true;
    } catch (err) {
      addMessage("error", `Error deleting patient '${patientId}'. Full Error: ${String(err)}`);
      return false;
    }
  };

  // ===== Upload Patient Report =====

  // Utility: map file type to accept attr
  const getAcceptForType = (t: UploadReportForm["fileType"]): string => {
    switch (t) {
      case "Text":
        return ".txt,text/plain";
      case "PDF":
        return ".pdf,application/pdf";
      case "Image":
        return "image/*";
      default:
        return "*/*";
    }
  };

  // Convert File to base64 string (without data URL prefix)
  const fileToBase64 = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  };

  // Upload via XMLHttpRequest to show progress bar
  const uploadReportXHR = async (
    token: string,
    endpoint: string,
    payload: Record<string, unknown>,
    onProgress: (pct: number) => void
  ): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (evt: ProgressEvent) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          try {
            const ok = xhr.status >= 200 && xhr.status < 300;
            if (!ok) {
              let msg = `HTTP ${xhr.status}`;
              try {
                const resp = JSON.parse(xhr.responseText);
                if (isRecord(resp) && typeof resp.message === "string") {
                  msg = resp.message;
                }
              } catch {
                // ignore
              }
              addMessage("error", `Error uploading report. ${msg}`);
              resolve(false);
              return;
            }
            addMessage("success", "Report uploaded successfully.");
            resolve(true);
          } catch (e) {
            addMessage("error", `Upload failed. ${String(e)}`);
            resolve(false);
          }
        }
      };

      xhr.onerror = () => {
        addMessage("error", "Network error during upload.");
        resolve(false);
      };

      const body = JSON.stringify(payload);
      xhr.send(body);
    });
  };

  // ===== Reports API =====
  const fetchReports = async (token: string, patientId: string): Promise<void> => {
    if (!endpoints.getReport) {
      addMessage("error", "API endpoint 'getReport' is not configured.");
      setReports([]);
      return;
    }
    setReportsLoading(true);
    try {
      const url = new URL(endpoints.getReport);
      url.searchParams.set("patientId", patientId);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (res.status === 404) {
        // No reports for this patient
        setReports([]);
        setReportsLoading(false);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: unknown = await res.json();
      const list = normalizeReportList(json);
      setReports(list);
    } catch (err) {
      addMessage("error", `Error fetching reports for '${patientId}'. Full Error: ${String(err)}`);
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  };

  // ===== Initialization (auto-load table on open) =====
  useEffect(() => {
    let isMounted = true;
    const init = async (): Promise<void> => {
      const { accessToken: token, roles: r } = await acquireAuth(instance, addMessage);
      if (!isMounted) return;
      setAccessToken(token);
      setRoles(r);

      if (token && canReadFromRoles(r)) {
        await fetchPatients(token);
      }
    };
    void init();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance]);

  // ===== Handlers: Add =====
  const onAddChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = (f: NewPatientForm): string[] => {
    const errors: string[] = [];

    // patientId mandatory, numbers only 4–10 digits
    if (!f.patientId.trim()) errors.push("Patient ID is required.");
    else if (!isValidPatientId(f.patientId)) {
      errors.push("Patient ID must be 4–10 digits (numbers only).");
    }

    // names
    if (!isValidName(f.firstName))
      errors.push("First name is required (3–30 characters).");
    if (!isValidName(f.lastName))
      errors.push("Last name is required (3–30 characters).");

    // dob dd/mm/yyyy
    if (!f.dobInput.trim()) {
      errors.push("Date of birth is required.");
    } else {
      const dobNormalized = normalizeDobInput(f.dobInput);
      if (!dobNormalized.ok) errors.push(dobNormalized.error ?? "Invalid date of birth.");
    }

    // Optional email
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))
      errors.push("Please provide a valid e-mail address.");

    // Optional phone
    if (f.phone && f.phone.length < 6)
      errors.push("Please provide a valid phone number.");

    return errors;
  };

  const openAddScreen = (): void => {
    if (!canCreate) {
      addMessage("error", "Access denied: you do not have permission to add patients.");
      return;
    }
    setView("add");
    setForm({
      patientId: "",
      firstName: "",
      lastName: "",
      dobInput: "",
      gender: "",
      email: "",
      phone: "",
      insuranceProvider: "",
      insuranceMemberNumber: "",
    });
  };

  const cancelAddScreen = (): void => {
    setView("list");
    setForm({
      patientId: "",
      firstName: "",
      lastName: "",
      dobInput: "",
      gender: "",
      email: "",
      phone: "",
      insuranceProvider: "",
      insuranceMemberNumber: "",
    });
  };

  const onAddSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const errors = validateForm(form);
    if (errors.length) {
      errors.forEach((msg) => addMessage("warning", msg));
      return;
    }
    if (!accessToken) {
      addMessage("error", "Missing access token. Please sign in again.");
      return;
    }
    if (!canCreate) {
      addMessage("error", "Access denied: you do not have permission to add patients.");
      return;
    }

    const normalizedDob = normalizeDobInput(form.dobInput);
    if (!normalizedDob.ok || !normalizedDob.iso) {
      addMessage("error", normalizedDob.error ?? "Invalid date.");
      return;
    }

    const payload: BackendPatient = {
      patientId: form.patientId.trim(), // numeric only
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      dob: normalizedDob.iso,
      gender: form.gender || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      insurance:
        form.insuranceProvider || form.insuranceMemberNumber
          ? {
              provider: form.insuranceProvider.trim() || undefined,
              memberNumber: form.insuranceMemberNumber.trim() || undefined,
            }
          : undefined,
    };

    setIsSubmitting(true);
    const ok = await insertPatient(accessToken, payload);
    setIsSubmitting(false);

    if (ok) {
      setView("list");
      await fetchPatients(accessToken);
      setForm({
        patientId: "",
        firstName: "",
        lastName: "",
        dobInput: "",
        gender: "",
        email: "",
        phone: "",
        insuranceProvider: "",
        insuranceMemberNumber: "",
      });
    }
  };

  // ===== Handlers: Modify =====
  const openModifyScreen = async (p: BackendPatient): Promise<void> => {
    if (!canModify) {
      addMessage("error", "Access denied: you do not have permission to modify patients.");
      return;
    }
    // Pre-fill modify form from selected record
    const mf: ModifyPatientForm = {
      originalPatientId: p.patientId,
      patientId: p.patientId,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      dobInput: displayDob(p.dob), // convert to dd/mm/yyyy for editing
      gender: (p.gender as ModifyPatientForm["gender"]) ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      insuranceProvider: p.insurance?.provider ?? "",
      insuranceMemberNumber: p.insurance?.memberNumber ?? "",
      deleted: Boolean(p.deleted),
    };
    setModifyForm(mf);
    setSelectedPatient(p);
    setView("modify");
  };

  const onModifyChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const target = e.currentTarget; // prefer currentTarget for React events

    if (target instanceof HTMLInputElement) {
      const { name, value, type, checked } = target;
      setModifyForm((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? !!checked : value,
      }));
      return;
    }

    if (target instanceof HTMLSelectElement) {
      const { name, value } = target;
      setModifyForm((prev) => ({
        ...prev,
        [name]: value,
      }));
      return;
    }
  };

  // If patientId changes and field loses focus, load that record from DB
  const onModifyPatientIdBlur = async (): Promise<void> => {
    const newId = modifyForm.patientId.trim();
    if (!newId || !isValidPatientId(newId)) {
      addMessage("warning", "Patient ID must be 4–10 digits (numbers only).");
      return;
    }
    if (!accessToken) {
      addMessage("error", "Missing access token. Please sign in again.");
      return;
    }

    // If changing to a different record, load it and populate the form
    if (newId !== selectedPatient?.patientId) {
      const found = await fetchPatientById(accessToken, newId);
      if (!found) {
        addMessage("info", `No record found for '${newId}'. You can continue editing to update the current record or change the ID again.`);
        return;
      }
      // Populate form from the newly found record, and set selectedPatient
      setSelectedPatient(found);
      setModifyForm({
        originalPatientId: found.patientId, // now the target record becomes the "original"
        patientId: found.patientId,
        firstName: found.firstName ?? "",
        lastName: found.lastName ?? "",
        dobInput: displayDob(found.dob),
        gender: (found.gender as ModifyPatientForm["gender"]) ?? "",
        email: found.email ?? "",
        phone: found.phone ?? "",
        insuranceProvider: found.insurance?.provider ?? "",
        insuranceMemberNumber: found.insurance?.memberNumber ?? "",
        deleted: Boolean(found.deleted),
      });
      addMessage("success", `Loaded record '${newId}' into modify screen.`);
    }
  };

  // Build changed fields relative to selectedPatient
  const computeModifyChanges = (): { originalPatientId: string; changes: Partial<BackendPatient>; errors: string[] } => {
    const errors: string[] = [];
    const original = selectedPatient;
    if (!original) {
      errors.push("No patient selected to modify.");
      return { originalPatientId: "", changes: {}, errors };
    }

    // Validate minimal fields
    if (!modifyForm.patientId.trim() || !isValidPatientId(modifyForm.patientId)) {
      errors.push("Patient ID must be 4–10 digits (numbers only).");
    }
    if (!isValidName(modifyForm.firstName)) errors.push("First name is required (3–30 characters).");
    if (!isValidName(modifyForm.lastName)) errors.push("Last name is required (3–30 characters).");
    // dob optional to change, but if present ensure valid format
    if (modifyForm.dobInput.trim()) {
      const n = normalizeDobInput(modifyForm.dobInput);
      if (!n.ok) errors.push(n.error ?? "Invalid date of birth.");
    }
    // email optional
    if (modifyForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(modifyForm.email)) {
      errors.push("Please provide a valid e-mail address.");
    }
    // phone optional
    if (modifyForm.phone && modifyForm.phone.length < 6) {
      errors.push("Please provide a valid phone number.");
    }
    if (errors.length) return { originalPatientId: original.patientId, changes: {}, errors };

    const changes: Partial<BackendPatient> = {};
    const newId = modifyForm.patientId.trim();

    if (newId !== original.patientId) {
      changes.patientId = newId;
    }

    const trimEq = (a?: string, b?: string) => (a ?? "").trim() === (b ?? "").trim();

    if (!trimEq(modifyForm.firstName, original.firstName)) {
      changes.firstName = modifyForm.firstName.trim();
    }
    if (!trimEq(modifyForm.lastName, original.lastName)) {
      changes.lastName = modifyForm.lastName.trim();
    }

    const normalizedDob = modifyForm.dobInput.trim() ? normalizeDobInput(modifyForm.dobInput) : { ok: true, iso: original.dob };
    if (!normalizedDob.ok) {
      errors.push(normalizedDob.error ?? "Invalid date.");
      return { originalPatientId: original.patientId, changes: {}, errors };
    }
    const newDob = normalizedDob.iso!;
    if (!trimEq(newDob, original.dob)) {
      changes.dob = newDob;
    }

    const newGender = modifyForm.gender || undefined;
    if ((newGender ?? "") !== (original.gender ?? "")) {
      changes.gender = newGender;
    }

    const newEmail = modifyForm.email.trim() || undefined;
    if (!trimEq(newEmail, original.email)) {
      changes.email = newEmail;
    }

    const newPhone = modifyForm.phone.trim() || undefined;
    if (!trimEq(newPhone, original.phone)) {
      changes.phone = newPhone;
    }

    const newInsurance: Insurance | undefined =
      modifyForm.insuranceProvider.trim() || modifyForm.insuranceMemberNumber.trim()
        ? {
            provider: modifyForm.insuranceProvider.trim() || undefined,
            memberNumber: modifyForm.insuranceMemberNumber.trim() || undefined,
          }
        : undefined;

    const origInsProvider = original.insurance?.provider ?? undefined;
    const origInsMember = original.insurance?.memberNumber ?? undefined;
    const insChanged =
      (newInsurance?.provider ?? undefined) !== origInsProvider ||
      (newInsurance?.memberNumber ?? undefined) !== origInsMember;

    if (insChanged) {
      changes.insurance = newInsurance;
    }

    const newDeleted = Boolean(modifyForm.deleted);
    if (newDeleted !== Boolean(original.deleted)) {
      changes.deleted = newDeleted;
    }

    return { originalPatientId: original.patientId, changes, errors };
  };

  const cancelModifyScreen = (): void => {
    setView("list");
    setSelectedPatient(null);
  };

  const onModifySubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!accessToken) {
      addMessage("error", "Missing access token. Please sign in again.");
      return;
    }
    if (!canModify) {
      addMessage("error", "Access denied: you do not have permission to modify patients.");
      return;
    }

    const { originalPatientId, changes, errors } = computeModifyChanges();
    if (errors.length) {
      errors.forEach((msg) => addMessage("warning", msg));
      return;
    }

    if (Object.keys(changes).length === 0) {
      addMessage("info", "No changes to save.");
      return;
    }

    setIsSubmitting(true);
    const ok = await patchPatient(accessToken, originalPatientId, changes);
    setIsSubmitting(false);

    if (ok) {
      setView("list");
      setSelectedPatient(null);
      await fetchPatients(accessToken);
    }
  };

  // ===== Handlers: Details =====
  const openDetailsScreen = (p: BackendPatient): void => {
    if (!canRead) {
      addMessage("error", "Access denied: you do not have read access.");
      return;
    }
    setSelectedPatient(p);
    setView("details");
    // Fetch reports for this patient (uses patientId query param)
    if (accessToken) {
      void fetchReports(accessToken, p.patientId);
    }
  };
  const closeDetailsScreen = (): void => {
    setSelectedPatient(null);
    setReports([]);
    setView("list");
  };

  // ===== Handlers: Delete =====
  const onDeletePatient = async (p: BackendPatient): Promise<void> => {
    if (!canDelete) {
      addMessage("error", "Access denied: you do not have permission to delete patients.");
      return;
    }
    if (!accessToken) {
      addMessage("error", "Missing access token. Please sign in again.");
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete Patient '${p.patientId}'?`);
    if (!confirmed) return;

    const ok = await deletePatient(accessToken, p.patientId);
    if (ok) {
      await fetchPatients(accessToken);
    }
  };

  // ===== Handlers: Upload =====
  const openUploadScreen = (p: BackendPatient): void => {
    if (!canModify) {
      addMessage("error", "Access denied: you do not have permission to upload reports.");
      return;
    }
    setSelectedPatient(p);
    setUploadForm({
      patientId: p.patientId,
      fileType: "",
      file: null,
    });
    setUploadProgress(0);
    setIsUploading(false);
    setView("upload");
  };

  const onUploadChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const target = e.currentTarget;
    if (target instanceof HTMLSelectElement) {
      const { name, value } = target;
      setUploadForm((prev) => ({ ...prev, [name]: value as UploadReportForm["fileType"] }));
    } else if (target instanceof HTMLInputElement) {
      const { name, files } = target;
      if (name === "file" && files && files.length > 0) {
        setUploadForm((prev) => ({ ...prev, file: files[0] }));
      }
    }
  };

  const cancelUploadScreen = (): void => {
    setView("list");
    setSelectedPatient(null);
    setUploadForm({ patientId: "", fileType: "", file: null });
    setUploadProgress(0);
    setIsUploading(false);
  };

  const onUploadSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!accessToken) {
      addMessage("error", "Missing access token. Please sign in again.");
      return;
    }
    if (!canModify) {
      addMessage("error", "Access denied: you do not have permission to upload reports.");
      return;
    }
    if (!endpoints.uploadReport) {
      addMessage("error", "API endpoint 'uploadReport' is not configured.");
      return;
    }
    const pid = uploadForm.patientId.trim();
    if (!isValidPatientId(pid)) {
      addMessage("warning", "Patient ID must be 4–10 digits (numbers only).");
      return;
    }
    if (!uploadForm.fileType) {
      addMessage("warning", "Please select a file type (Text, PDF or Image).");
      return;
    }
    if (!uploadForm.file) {
      addMessage("warning", "Please choose a local file to upload.");
      return;
    }

    const file = uploadForm.file;
    const fileName = file.name;
    const fileSize = file.size;
    const fileType = uploadForm.fileType;

    // Prepare JSON body including base64 content to satisfy Function App's validator
    let fileBase64: string;
    try {
      fileBase64 = await fileToBase64(file);
    } catch (err) {
      addMessage("error", `Failed to read file. ${String(err)}`);
      return;
    }

    const payload = {
      patientId: pid,
      fileName,
      fileSize, // required by backend
      fileType,      // "Text" | "PDF" | "Image"
      fileBase64,    // to satisfy backend file content validation
    };

    setIsUploading(true);
    setUploadProgress(0);
    const ok = await uploadReportXHR(
      accessToken,
      endpoints.uploadReport!,
      payload,
      (pct) => setUploadProgress(pct)
    );
    setIsUploading(false);

    if (ok) {
      setView("list");
      setSelectedPatient(null);
      await fetchPatients(accessToken);
    }
  };

  // ===== Render: if user has no roles, deny page access =====
  if (roles.length === 0) {
    return (
      <div className="page">
        <h2 className="page__title">Patients</h2>
        <div className="alert alert--error">You do not have access to this page (no read access).</div>
      </div>
    );
  }

  // ===== Views =====
  const renderList = () => (
    <section className="card" aria-label="Patients List">
      <div className="card__header">
        <h3 className="card__title">Patients List</h3>

        <div className="actions">
          <button
            className={`btn ${canCreate ? "btn--primary" : "btn--disabled"}`}
            type="button"
            onClick={openAddScreen}
            disabled={!canCreate}
            title={canCreate ? "Add a new patient" : "You do not have permission to add patients"}
          >
            Add New Patient
          </button>

          <button
            className={`btn ${accessToken && canRead && !loading ? "btn--secondary" : "btn--disabled"}`}
            type="button"
            onClick={() => accessToken && fetchPatients(accessToken)}
            disabled={!accessToken || !canRead || loading}
            title={!canRead ? "You do not have read access" : "Refresh"}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {!canRead && (
        <div className="alert alert--error">You do not have read access to view patients.</div>
      )}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Date of Birth</th>
              <th>Operations</th>
            </tr>
          </thead>
          <tbody>
            {!canRead ? (
              <tr>
                <td className="table__cell--center" colSpan={5}>Access denied.</td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td className="table__cell--center" colSpan={5}>
                  {loading ? "Loading patients..." : "No patients found."}
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p._id ?? p.patientId}>
                  <td>{p.patientId}</td>
                  <td>{p.firstName}</td>
                  <td>{p.lastName}</td>
                  <td>{displayDob(p.dob)}</td>
                  <td>
                    <div className="ops">
                      <button className="btn btn--ghost" type="button" onClick={() => openDetailsScreen(p)}>
                        Details
                      </button>
                      <button className="btn btn--ghost" type="button" onClick={() => openModifyScreen(p)} disabled={!canModify}>
                        Modify
                      </button>
                      <button
                        className="btn btn--ghost"
                        type="button"
                        onClick={() => openUploadScreen(p)}
                        disabled={!canModify}
                        title={canModify ? "Upload a report for this patient" : "You do not have permission to upload reports"}
                      >
                        Upload Report
                      </button>
                      <button className="btn btn--danger" type="button" onClick={() => onDeletePatient(p)} disabled={!canDelete}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderAdd = () => (
    <section className={`card ${canCreate ? "" : "card--disabled"}`} aria-label="Add Patient">
      <h3 className="card__title">Add New Patient</h3>
      {!canCreate && (
        <div className="alert alert--warning">
          You have read-only access (role: app.read). Adding patients is disabled.
        </div>
      )}

      <form onSubmit={onAddSubmit}>
        <div className="grid grid--two">
          <label className="field">
            <span className="field__label">Patient ID *</span>
            <input
              className="input"
              type="text"
              name="patientId"
              value={form.patientId}
              onChange={onAddChange}
              placeholder="1234"
              disabled={!canCreate || isSubmitting}
              required
              inputMode="numeric"
              pattern="\d{4,10}"
              title="Patient ID must be 4–10 digits (numbers only)."
            />
            <small className="help">Format: numbers only (4–10 digits), e.g., 1234</small>
          </label>

          <label className="field">
            <span className="field__label">First Name *</span>
            <input
              className="input"
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={onAddChange}
              placeholder="John"
              disabled={!canCreate || isSubmitting}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Last Name *</span>
            <input
              className="input"
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={onAddChange}
              placeholder="Smith"
              disabled={!canCreate || isSubmitting}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Date of Birth (dd/mm/yyyy) *</span>
            <input
              className="input"
              type="text"
              name="dobInput"
              value={form.dobInput}
              onChange={onAddChange}
              placeholder="31/12/2025"
              disabled={!canCreate || isSubmitting}
              required
              inputMode="numeric"
            />
          </label>

          <label className="field">
            <span className="field__label">Gender</span>
            <select
              className="input"
              name="gender"
              value={form.gender}
              onChange={onAddChange}
              disabled={!canCreate || isSubmitting}
            >
              <option value="">Select gender</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
              <option value="O">Other</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">E-mail</span>
            <input
              className="input"
              type="email"
              name="email"
              value={form.email}
              onChange={onAddChange}
              placeholder="name@example.com"
              disabled={!canCreate || isSubmitting}
            />
          </label>

          <label className="field">
            <span className="field__label">Phone</span>
            <input
              className="input"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={onAddChange}
              placeholder="+55 41 99999-9999"
              disabled={!canCreate || isSubmitting}
            />
          </label>

          <label className="field">
            <span className="field__label">Insurance Provider</span>
            <input
              className="input"
              type="text"
              name="insuranceProvider"
              value={form.insuranceProvider}
              onChange={onAddChange}
              placeholder="Unimed"
              disabled={!canCreate || isSubmitting}
            />
          </label>

          <label className="field">
            <span className="field__label">Insurance Member Number</span>
            <input
              className="input"
              type="text"
              name="insuranceMemberNumber"
              value={form.insuranceMemberNumber}
              onChange={onAddChange}
              placeholder="UN-4485"
              disabled={!canCreate || isSubmitting}
            />
          </label>
        </div>

        <div className="actions">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={cancelAddScreen}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className={`btn ${accessToken && canCreate && !isSubmitting ? "btn--primary" : "btn--disabled"}`}
            type="submit"
            disabled={!accessToken || !canCreate || isSubmitting}
            title={
              !accessToken
                ? "Sign-in required to submit"
                : !canCreate
                ? "You do not have permission to add patients"
                : "Confirm"
            }
          >
            {isSubmitting ? "Saving..." : "Confirm"}
          </button>
        </div>
      </form>
    </section>
  );

  const renderModify = () => (
    <section className={`card ${canModify ? "" : "card--disabled"}`} aria-label="Modify Patient">
      <h3 className="card__title">Modify Patient</h3>
      {!canModify && (
        <div className="alert alert--warning">
          You have read-only access (role: app.read). Modifying patients is disabled.
        </div>
      )}

      <form onSubmit={onModifySubmit}>
        <div className="grid grid--two">
          <label className="field">
            <span className="field__label">Patient ID *</span>
            <input
              className="input"
              type="text"
              name="patientId"
              value={modifyForm.patientId}
              onChange={onModifyChange}
              onBlur={onModifyPatientIdBlur}
              placeholder="1234"
              disabled={!canModify || isSubmitting}
              required
              inputMode="numeric"
              pattern="\d{4,10}"
              title="Patient ID must be 4–10 digits (numbers only)."
            />
          </label>

          <label className="field">
            <span className="field__label">First Name *</span>
            <input
              className="input"
              type="text"
              name="firstName"
              value={modifyForm.firstName}
              onChange={onModifyChange}
              placeholder="John"
              disabled={!canModify || isSubmitting}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Last Name *</span>
            <input
              className="input"
              type="text"
              name="lastName"
              value={modifyForm.lastName}
              onChange={onModifyChange}
              placeholder="Smith"
              disabled={!canModify || isSubmitting}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Date of Birth (dd/mm/yyyy)</span>
            <input
              className="input"
              type="text"
              name="dobInput"
              value={modifyForm.dobInput}
              onChange={onModifyChange}
              placeholder="31/12/1988"
              disabled={!canModify || isSubmitting}
              inputMode="numeric"
            />
          </label>

          <label className="field">
            <span className="field__label">Gender</span>
            <select
              className="input"
              name="gender"
              value={modifyForm.gender}
              onChange={onModifyChange}
              disabled={!canModify || isSubmitting}
            >
              <option value="">Select gender</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
              <option value="O">Other</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">E-mail</span>
            <input
              className="input"
              type="email"
              name="email"
              value={modifyForm.email}
              onChange={onModifyChange}
              placeholder="name@example.com"
              disabled={!canModify || isSubmitting}
            />
          </label>

          <label className="field">
            <span className="field__label">Phone</span>
            <input
              className="input"
              type="tel"
              name="phone"
              value={modifyForm.phone}
              onChange={onModifyChange}
              placeholder="+55 41 99999-9999"
              disabled={!canModify || isSubmitting}
            />
          </label>

          <label className="field">
            <span className="field__label">Insurance Provider</span>
            <input
              className="input"
              type="text"
              name="insuranceProvider"
              value={modifyForm.insuranceProvider}
              onChange={onModifyChange}
              placeholder="Sulamerica"
              disabled={!canModify || isSubmitting}
            />
          </label>

          <label className="field">
            <span className="field__label">Insurance Member Number</span>
            <input
              className="input"
              type="text"
              name="insuranceMemberNumber"
              value={modifyForm.insuranceMemberNumber}
              onChange={onModifyChange}
              placeholder="SM-4485"
              disabled={!canModify || isSubmitting}
            />
          </label>

          <label className="field field--checkbox">
            <span className="field__label">Deleted</span>
            <input
              className="input"
              type="checkbox"
              name="deleted"
              checked={modifyForm.deleted}
              onChange={onModifyChange}
              disabled={!canModify || isSubmitting}
            />
          </label>
        </div>

        <div className="actions">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={cancelModifyScreen}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className={`btn ${accessToken && canModify && !isSubmitting ? "btn--primary" : "btn--disabled"}`}
            type="submit"
            disabled={!accessToken || !canModify || isSubmitting}
            title={
              !accessToken
                ? "Sign-in required to submit"
                : !canModify
                ? "You do not have permission to modify patients"
                : "Confirm"
            }
          >
            {isSubmitting ? "Saving..." : "Confirm"}
          </button>
        </div>
      </form>
    </section>
  );

  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined) return "--";
    if (typeof v === "string" && v.trim() === "") return "--";
    return String(v);
  };

  const formatYesNo = (v: unknown): string => {
    const b = Boolean(v);
    return b ? "Yes" : "No";
  };

  const formatDate = (v: unknown): string => {
    if (!v) return "--";
    try {
      const d = new Date(String(v));
      if (isNaN(d.getTime())) return "--";
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "--";
    }
  };

  const formatDateOnly = (v: unknown): string => {
    if (!v) return "--";
    try {
      const d = new Date(String(v));
      if (isNaN(d.getTime())) return "--";
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "--";
    }
  };

  // Build a full link to the file if possible
  const computeReportFileLink = (r: BackendReport): string | undefined => {
    const direct = (r.fileUrl as string) || (r.sasUrl as string) || (r.url as string);
    if (direct) return direct;
    const storage = r.storageUrl as string | undefined;
    const sas = r.sasToken as string | undefined;
    if (storage && sas) {
      const sep = storage.includes("?") ? "&" : "?";
      const cleanSas = sas.startsWith("?") ? sas.slice(1) : sas;
      return `${storage}${sep}${cleanSas}`;
    }
    return undefined;
  };

  // Render details + reports
  const renderDetails = () => {
    const p = selectedPatient;
    if (!p) return null;

    return (
      <section className="card" aria-label="Patient Details">
        <div className="card__header">
          <h3 className="card__title">Patient Details</h3>
          <button
            className="btn btn--secondary"
            type="button"
            onClick={closeDetailsScreen}
          >
            Return to List
          </button>
        </div>

        {/* Top: two-column patient details grid */}
        <div className="details-grid details-grid--two">
          <div className="field">
            <span className="field__label">_id:</span>
            <div className="field__value">{formatValue(p._id)}</div>
          </div>

          <div className="field">
            <span className="field__label">Patient ID:</span>
            <div className="field__value">{formatValue(p.patientId)}</div>
          </div>

          <div className="field">
            <span className="field__label">First Name:</span>
            <div className="field__value">{formatValue(p.firstName)}</div>
          </div>

          <div className="field">
            <span className="field__label">Last Name:</span>
            <div className="field__value">{formatValue(p.lastName)}</div>
          </div>

          <div className="field">
            <span className="field__label">Date of Birth:</span>
            <div className="field__value">{formatDateOnly(p.dob)}</div>
          </div>

          <div className="field">
            <span className="field__label">Gender:</span>
            <div className="field__value">{formatValue(p.gender)}</div>
          </div>

          <div className="field">
            <span className="field__label">E-mail:</span>
            <div className="field__value">{formatValue(p.email)}</div>
          </div>

          <div className="field">
            <span className="field__label">Phone:</span>
            <div className="field__value">{formatValue(p.phone)}</div>
          </div>

          <div className="field">
            <span className="field__label">Insurance Provider:</span>
            <div className="field__value">{formatValue(p.insurance?.provider)}</div>
          </div>

          <div className="field">
            <span className="field__label">Insurance Member Number:</span>
            <div className="field__value">{formatValue(p.insurance?.memberNumber)}</div>
          </div>

          <div className="field">
            <span className="field__label">Deleted:</span>
            <div className="field__value">{formatYesNo(p.deleted)}</div>
          </div>

          <div className="field">
            <span className="field__label">Created At:</span>
            <div className="field__value">{formatDate(p.createdAt)}</div>
          </div>

          <div className="field">
            <span className="field__label">Updated At:</span>
            <div className="field__value">{formatDate(p.updatedAt)}</div>
          </div>

          <div className="field">
            <span className="field__label">Deleted At:</span>
            <div className="field__value">{formatDate(p.deletedAt)}</div>
          </div>
        </div>

        {/* Reports below the details */}
        <div className="reports-section">
          <h4 className="card__subtitle">Reports</h4>
          {reportsLoading ? (
            <div className="table__cell--center" style={{ padding: "0.5rem" }}>Loading reports...</div>
          ) : reports.length === 0 ? (
            // Keep the exact wording requested
            <div className="table__cell--center" style={{ padding: "0.5rem" }}>No reprts for this patient found</div>
          ) : (
            <div>
              {reports.map((r, idx) => {
                const link = computeReportFileLink(r);
                const entries = Object.entries(r);
                return (
                  <div key={(r.id as string) ?? (r.reportId as string) ?? `${selectedPatient?.patientId}-${idx}`} className="report-block">
                    {/* Show all fields */}
                    <div className="report-grid">
                      {entries.map(([k, v]) => (
                        <div className="field" key={k}>
                          <span className="field__label">{k}:</span>
                          <div className="field__value">{formatValue(v)}</div>
                        </div>
                      ))}
                      {/* Explicit link field */}
                      <div className="field">
                        <span className="field__label">File:</span>
                        <div className="field__value">
                          {link ? (
                            <a className="file-link" href={link} target="_blank" rel="noopener noreferrer">Link to File</a>
                          ) : (
                            "--"
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Separator */}
                    <hr className="divider" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="actions">
          <button
            className="btn btn--secondary"
            type="button"
            onClick={closeDetailsScreen}
          >
            Return to List
          </button>
        </div>
      </section>
    );
  };

  const renderUpload = () => (
    <section className={`card ${canModify ? "" : "card--disabled"}`} aria-label="Upload Patient Report">
      <div className="card__header">
        <h3 className="card__title">Upload Report</h3>
        <button
          className="btn btn--secondary"
          type="button"
          onClick={cancelUploadScreen}
          disabled={isUploading}
        >
          Return to List
        </button>
      </div>

      {!canModify && (
        <div className="alert alert--warning">
          You have read-only access (role: app.read). Uploading reports is disabled.
        </div>
      )}

      <form onSubmit={onUploadSubmit}>
        <div className="grid grid--two">
          <label className="field">
            <span className="field__label">Patient ID *</span>
            <input
              className="input"
              type="text"
              name="patientId"
              value={uploadForm.patientId}
              readOnly
              disabled
            />
          </label>

          <label className="field">
            <span className="field__label">File Type *</span>
            <select
              className="input"
              name="fileType"
              value={uploadForm.fileType}
              onChange={onUploadChange}
              disabled={!canModify || isUploading}
              required
            >
              <option value="">Select type</option>
              <option value="Text">Text</option>
              <option value="PDF">PDF</option>
              <option value="Image">Image</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">Choose File *</span>
            <input
              className="input"
              type="file"
              name="file"
              onChange={onUploadChange}
              accept={getAcceptForType(uploadForm.fileType)}
              disabled={!canModify || isUploading}
              required
            />
            {uploadForm.file && (
              <small className="help">
                Selected: {uploadForm.file.name} ({uploadForm.file.size} bytes)
              </small>
            )}
          </label>
        </div>

        {isUploading && (
          <div className="progress-bar" aria-label="Upload Progress" style={{ marginTop: "1rem" }}>
            <div
              className="progress-bar__fill"
              style={{
                width: `${uploadProgress}%`,
                height: "8px",
                backgroundColor: "#0a66c2",
                transition: "width 200ms ease",
              }}
            />
            <div style={{ marginTop: "0.25rem" }}>{uploadProgress}%</div>
          </div>
        )}

        <div className="actions">
          <button
            className="btn btn--ghost"
            type="button"
            onClick={cancelUploadScreen}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            className={`btn ${accessToken && canModify && !isUploading ? "btn--primary" : "btn--disabled"}`}
            type="submit"
            disabled={!accessToken || !canModify || isUploading}
            title={
              !accessToken
                ? "Sign-in required to submit"
                : !canModify
                ? "You do not have permission to upload reports"
                : "Confirm"
            }
          >
            {isUploading ? "Uploading..." : "Confirm"}
          </button>
        </div>
      </form>
    </section>
  );

  return (
    <div className="page">
      <h2 className="page__title">Patients</h2>

      {view === "list" && renderList()}
      {view === "add" && renderAdd()}
      {view === "modify" && renderModify()}
      {view === "details" && renderDetails()}
      {view === "upload" && renderUpload()}
    </div>
  );
};

export default PatientPage;

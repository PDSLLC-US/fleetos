"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getAuthRole,
  roleLabel,
  type AuthRoleContext,
} from "@/lib/auth-role";

type LoadDocument = {
  id: string;
  company_id: string;
  load_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  uploaded_by: string | null;
  created_at: string;
};

type LoadOption = {
  id: string;
  load_number: string;
  driver_id: string | null;
};

type DriverOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type ProfileOption = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type MemberOption = {
  user_id: string;
  role: string;
  driver_id: string | null;
  is_active: boolean;
};

type DocumentForm = {
  load_id: string;
  document_type: string;
  file: File | null;
};

const DOCUMENT_TYPES = [
  { value: "rate_confirmation", label: "Rate Confirmation" },
  { value: "bol", label: "BOL" },
  { value: "pod", label: "POD" },
  { value: "invoice", label: "Invoice" },
  { value: "lumper_receipt", label: "Lumper Receipt" },
  { value: "detention_document", label: "Detention Document" },
  { value: "other", label: "Other" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function DocumentsPage() {
  const supabase = createClient();

  const [auth, setAuth] = useState<AuthRoleContext | null>(null);

  const [documents, setDocuments] = useState<LoadDocument[]>([]);
  const [loads, setLoads] = useState<LoadOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [showUpload, setShowUpload] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<DocumentForm>({
    load_id: "",
    document_type: "",
    file: null,
  });

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const authContext = await getAuthRole(supabase);

      if (!authContext) {
        throw new Error("Unable to verify your FleetOS account.");
      }

      setAuth(authContext);

      const [
        documentsResult,
        loadsResult,
        driversResult,
        profilesResult,
        membersResult,
      ] = await Promise.all([
        supabase
          .from("load_documents")
          .select(`
            id,
            company_id,
            load_id,
            document_type,
            file_name,
            file_path,
            uploaded_by,
            created_at
          `)
          .order("created_at", { ascending: false }),

        supabase
          .from("loads")
          .select("id, load_number, driver_id")
          .order("load_number", { ascending: true }),

        supabase
          .from("drivers")
          .select("id, first_name, last_name")
          .order("first_name", { ascending: true }),

        supabase
          .from("profiles")
          .select("id, full_name, role"),

        supabase
          .from("company_members")
          .select("user_id, role, driver_id, is_active")
          .eq("is_active", true),
      ]);

      if (documentsResult.error) {
        console.error("Error loading documents:", documentsResult.error);
        throw documentsResult.error;
      }

      if (loadsResult.error) {
        console.error("Error loading loads:", loadsResult.error);
        throw loadsResult.error;
      }

      if (driversResult.error) {
        console.error("Error loading drivers:", driversResult.error);
        throw driversResult.error;
      }

      if (profilesResult.error) {
        console.error("Error loading profiles:", profilesResult.error);
        throw profilesResult.error;
      }

      if (membersResult.error) {
        console.error("Error loading company members:", membersResult.error);
        throw membersResult.error;
      }

      setDocuments((documentsResult.data ?? []) as unknown as LoadDocument[]);
      setLoads((loadsResult.data ?? []) as unknown as LoadOption[]);
      setDrivers((driversResult.data ?? []) as unknown as DriverOption[]);
      setProfiles((profilesResult.data ?? []) as unknown as ProfileOption[]);
      setMembers((membersResult.data ?? []) as unknown as MemberOption[]);
    } catch (err) {
      console.error("Documents load error:", err);
      setError(err instanceof Error ? err.message : "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setForm({ load_id: "", document_type: "", file: null });
  }

  function documentTypeLabel(type: string) {
    return DOCUMENT_TYPES.find((item) => item.value === type)?.label ?? type.replaceAll("_", " ");
  }

  const loadMap = useMemo(() => new Map(loads.map((load) => [load.id, load])), [loads]);

  const driverMap = useMemo(() => {
    return new Map(
      drivers.map((driver) => {
        const fullName = [driver.first_name, driver.last_name].filter(Boolean).join(" ").trim();
        return [driver.id, fullName || "Unnamed Driver"];
      })
    );
  }, [drivers]);

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const memberMap = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members]);

  function getLoadNumber(document: LoadDocument) {
    return loadMap.get(document.load_id)?.load_number ?? "—";
  }

  function getAssignedDriverName(document: LoadDocument) {
    const driverId = loadMap.get(document.load_id)?.driver_id;
    if (!driverId) return "Unassigned";
    return driverMap.get(driverId) ?? "Unknown Driver";
  }

  function prettyRole(role: string) {
    return role.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function getUploaderInfo(document: LoadDocument) {
    if (!document.uploaded_by) {
      return { name: "Unknown", role: "Unknown" };
    }

    const member = memberMap.get(document.uploaded_by);

    if (member?.driver_id) {
      return {
        name: driverMap.get(member.driver_id) ?? profileMap.get(document.uploaded_by)?.full_name ?? "Driver",
        role: roleLabel(member.role as AuthRoleContext["role"]),
      };
    }

    const profile = profileMap.get(document.uploaded_by);

    return {
      name: profile?.full_name || "FleetOS User",
      role: member?.role
        ? roleLabel(member.role as AuthRoleContext["role"])
        : profile?.role
          ? prettyRole(profile.role)
          : "User",
    };
  }

  function sanitizeFileName(fileName: string) {
    const lastDot = fileName.lastIndexOf(".");
    const base = lastDot >= 0 ? fileName.slice(0, lastDot) : fileName;
    const extension = lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : "";
    const safeBase = base.trim().replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return `${safeBase || "document"}${extension}`;
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.load_id) return setError("Please select a load.");
    if (!form.document_type) return setError("Please select a document type.");
    if (!form.file) return setError("Please select a file.");
    if (form.file.size > MAX_FILE_SIZE) return setError("File size cannot exceed 10 MB.");

    const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
    const lowerName = form.file.name.toLowerCase();
    if (!allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
      return setError("Only PDF, JPG, JPEG, and PNG files are allowed.");
    }

    setUploading(true);
    let uploadedPath: string | null = null;

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be logged in.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.company_id) throw new Error("No company is assigned to this user.");

      const safeName = sanitizeFileName(form.file.name);
      const generatedFileName = `${Date.now()}-${safeName}`;
      const filePath = `${profile.company_id}/${form.load_id}/${generatedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("fleet-documents")
        .upload(filePath, form.file, { upsert: false });

      if (uploadError) throw uploadError;
      uploadedPath = filePath;

      const { error: metadataError } = await supabase
        .from("load_documents")
        .insert({
          company_id: profile.company_id,
          load_id: form.load_id,
          document_type: form.document_type,
          file_name: form.file.name,
          file_path: filePath,
          uploaded_by: user.id,
        });

      if (metadataError) {
        await supabase.storage.from("fleet-documents").remove([filePath]);
        uploadedPath = null;
        throw metadataError;
      }

      setSuccess("Document uploaded successfully.");
      setShowUpload(false);
      resetForm();
      await loadData();
    } catch (err) {
      console.error("Document upload error:", err);
      if (uploadedPath) console.error("Upload may require cleanup:", uploadedPath);
      setError(err instanceof Error ? err.message : "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleView(document: LoadDocument) {
    setError("");
    setSuccess("");
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("fleet-documents")
        .createSignedUrl(document.file_path, 60);
      if (signedUrlError) throw signedUrlError;
      if (!data?.signedUrl) throw new Error("Unable to generate document link.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open document.");
    }
  }

  async function handleDownload(document: LoadDocument) {
    setError("");
    setSuccess("");
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("fleet-documents")
        .createSignedUrl(document.file_path, 60);
      if (signedUrlError) throw signedUrlError;
      if (!data?.signedUrl) throw new Error("Unable to generate download link.");

      const link = window.document.createElement("a");
      link.href = data.signedUrl;
      link.download = document.file_name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download document.");
    }
  }

  async function handleDelete(document: LoadDocument) {
    const confirmed = window.confirm(`Delete "${document.file_name}" from Load #${getLoadNumber(document)}?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const { error: storageError } = await supabase.storage
        .from("fleet-documents")
        .remove([document.file_path]);
      if (storageError) throw storageError;

      const { error: metadataError } = await supabase
        .from("load_documents")
        .delete()
        .eq("id", document.id);

      if (metadataError) {
        throw new Error(`The file was removed from Storage, but the database record could not be deleted: ${metadataError.message}`);
      }

      setSuccess("Document deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete document.");
    }
  }

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((document) => {
      const loadNumber = getLoadNumber(document);
      const driverName = getAssignedDriverName(document);
      const uploader = getUploaderInfo(document);

      const matchesSearch =
        !query ||
        document.file_name.toLowerCase().includes(query) ||
        document.document_type.toLowerCase().includes(query) ||
        documentTypeLabel(document.document_type).toLowerCase().includes(query) ||
        loadNumber.toLowerCase().includes(query) ||
        driverName.toLowerCase().includes(query) ||
        uploader.name.toLowerCase().includes(query) ||
        uploader.role.toLowerCase().includes(query);

      const matchesType = typeFilter === "all" || document.document_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [documents, search, typeFilter, loadMap, driverMap, profileMap, memberMap]);

  const totalDocuments = documents.length;
  const rateConfirmations = documents.filter((document) => document.document_type === "rate_confirmation").length;
  const bols = documents.filter((document) => document.document_type === "bol").length;
  const pods = documents.filter((document) => document.document_type === "pod").length;
  const otherDocuments = documents.filter((document) => !["rate_confirmation", "bol", "pod"].includes(document.document_type)).length;

  const canDelete = auth?.role === "owner" || auth?.role === "admin";

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-600">Loading documents...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Documents</h1>
            <p className="mt-1 text-slate-600">Upload and manage rate confirmations, BOLs, PODs and load-related files.</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              resetForm();
              setShowUpload(true);
            }}
            className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Upload Document
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        {success && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">{success}</div>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Total Documents" value={totalDocuments} />
          <SummaryCard label="Rate Confirmations" value={rateConfirmations} />
          <SummaryCard label="BOLs" value={bols} />
          <SummaryCard label="PODs" value={pods} />
          <SummaryCard label="Other" value={otherDocuments} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search file, load #, driver, uploader or type..."
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500"
            />

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500"
            >
              <option value="all">All Types</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-100">
                <tr>
                  <TableHeader>Document</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Load #</TableHeader>
                  <TableHeader>Assigned Driver</TableHeader>
                  <TableHeader>Uploaded By</TableHeader>
                  <TableHeader>Uploaded</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No documents found.</td>
                  </tr>
                ) : (
                  filteredDocuments.map((document) => {
                    const uploader = getUploaderInfo(document);
                    return (
                      <tr key={document.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="max-w-[260px] truncate font-medium text-slate-900">{document.file_name}</p>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {documentTypeLabel(document.document_type)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4"><span className="font-semibold text-slate-900">{getLoadNumber(document)}</span></td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">{getAssignedDriverName(document)}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900">{uploader.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{uploader.role}</p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                          {document.created_at ? new Date(document.created_at).toLocaleString() : "—"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => void handleView(document)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">View</button>
                            <button type="button" onClick={() => void handleDownload(document)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Download</button>
                            {canDelete && (
                              <button type="button" onClick={() => void handleDelete(document)} className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Upload Document</h2>
                <p className="mt-1 text-sm text-slate-500">Upload a load-related document to secure private storage.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!uploading) {
                    setShowUpload(false);
                    resetForm();
                  }
                }}
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Load *</label>
                <select
                  required
                  value={form.load_id}
                  onChange={(event) => setForm((current) => ({ ...current, load_id: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5"
                >
                  <option value="">Select a load</option>
                  {loads.map((load) => (
                    <option key={load.id} value={load.id}>
                      Load #{load.load_number}{load.driver_id ? ` — ${driverMap.get(load.driver_id) ?? "Unknown Driver"}` : " — Unassigned"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Document Type *</label>
                <select
                  required
                  value={form.document_type}
                  onChange={(event) => setForm((current) => ({ ...current, document_type: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5"
                >
                  <option value="">Select document type</option>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">File *</label>
                <input
                  required
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5"
                />
                <p className="mt-2 text-xs text-slate-500">PDF, JPG, JPEG or PNG. Maximum file size: 10 MB.</p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    setShowUpload(false);
                    resetForm();
                  }}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
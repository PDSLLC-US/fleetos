"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getAuthRole,
  type AuthRoleContext,
} from "@/lib/auth-role";

type DriverLoad = {
  id: string;
  company_id: string;
  load_number: string;
  driver_id: string | null;
  truck_id: string | null;
  trailer_id: string | null;
  equipment_type: string | null;

  pickup_location: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_date: string | null;

  delivery_location: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_date: string | null;

  miles: number | null;
  status: string;
  notes: string | null;
};

type LoadDocument = {
  id: string;
  company_id: string;
  load_id: string;
  document_type: string;
  file_name: string | null;
  file_path: string | null;
  uploaded_by: string | null;
  created_at: string;
};

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const DRIVER_STATUS_FLOW: Record<
  string,
  {
    nextStatus: string;
    buttonLabel: string;
    description: string;
  }
> = {
  booked: {
    nextStatus: "dispatched",
    buttonLabel: "Start Dispatch",
    description:
      "Confirm that you have received and accepted this load.",
  },

  dispatched: {
    nextStatus: "picked_up",
    buttonLabel: "Mark Picked Up",
    description:
      "Use this after the freight has been picked up.",
  },

  picked_up: {
    nextStatus: "in_transit",
    buttonLabel: "Start In Transit",
    description:
      "Confirm that the load is now moving toward delivery.",
  },

  in_transit: {
    nextStatus: "delivered",
    buttonLabel: "Mark Delivered",
    description:
      "Use this only after the load has been delivered.",
  },
};

export default function DriverLoadPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  const loadId = String(
    params.id ?? ""
  );

  const [auth, setAuth] =
    useState<AuthRoleContext | null>(
      null
    );

  const [load, setLoad] =
    useState<DriverLoad | null>(
      null
    );

  const [documents, setDocuments] =
    useState<LoadDocument[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [
    updatingStatus,
    setUpdatingStatus,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [
    documentType,
    setDocumentType,
  ] = useState("pod");

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(null);

  useEffect(() => {
    void initializePage();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId]);

  async function initializePage() {
    setLoading(true);
    setError("");

    try {
      const authContext =
        await getAuthRole(
          supabase
        );

      if (!authContext) {
        router.replace("/login");
        return;
      }

      if (
        authContext.role !==
        "driver"
      ) {
        router.replace("/");
        return;
      }

      if (
        !authContext.driverId
      ) {
        throw new Error(
          "Your FleetOS login is not linked to a driver record."
        );
      }

      setAuth(authContext);

      await loadAssignedLoad();
      await loadDocuments();
    } catch (err: unknown) {
      console.error(
        "Driver load page initialization error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load this assigned load."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignedLoad() {
    const {
      data,
      error: loadError,
    } = await supabase
      .from("loads")
      .select(`
        id,
        company_id,
        load_number,
        driver_id,
        truck_id,
        trailer_id,
        equipment_type,
        pickup_location,
        pickup_city,
        pickup_state,
        pickup_date,
        delivery_location,
        delivery_city,
        delivery_state,
        delivery_date,
        miles,
        status,
        notes
      `)
      .eq("id", loadId)
      .maybeSingle();

    if (loadError) {
      console.error(
        "Assigned load query error:",
        loadError.message,
        loadError.code,
        loadError.details,
        loadError.hint
      );

      throw new Error(
        loadError.message ||
          "Unable to retrieve this load."
      );
    }

    if (!data) {
      throw new Error(
        "This load is not assigned to your driver account or is no longer available."
      );
    }

    setLoad(
      data as DriverLoad
    );
  }

  async function loadDocuments() {
    const {
      data,
      error: documentsError,
    } = await supabase
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
      .eq("load_id", loadId)
      .order("created_at", {
        ascending: false,
      });

    if (documentsError) {
      console.error(
        "Load documents query error:",
        documentsError.message
      );

      throw new Error(
        documentsError.message ||
          "Unable to retrieve load documents."
      );
    }

    setDocuments(
      (data ?? []) as LoadDocument[]
    );
  }

  // ============================================================
  // DRIVER STATUS UPDATE
  // ============================================================

  async function updateLoadStatus() {
    if (!load) {
      return;
    }

    const statusAction =
      DRIVER_STATUS_FLOW[
        load.status
      ];

    if (!statusAction) {
      return;
    }

    const confirmed =
      window.confirm(
        `Change Load #${load.load_number} from "${prettyStatus(
          load.status
        )}" to "${prettyStatus(
          statusAction.nextStatus
        )}"?`
      );

    if (!confirmed) {
      return;
    }

    setUpdatingStatus(true);
    setError("");
    setSuccess("");

    try {
      const {
        data,
        error: rpcError,
      } = await supabase.rpc(
        "driver_update_load_status",
        {
          target_load_id:
            load.id,

          new_status:
            statusAction.nextStatus,
        }
      );

      if (rpcError) {
        console.error(
          "Driver status update error:",
          rpcError.message,
          rpcError.code,
          rpcError.details,
          rpcError.hint
        );

        throw new Error(
          rpcError.message ||
            "Unable to update load status."
        );
      }

      console.log(
        "Driver status update result:",
        data
      );

      setSuccess(
        `Load status updated to ${prettyStatus(
          statusAction.nextStatus
        )}.`
      );

      await loadAssignedLoad();
    } catch (err: unknown) {
      console.error(
        "Driver load status error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update load status."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  // ============================================================
  // DOCUMENT UPLOAD
  // ============================================================

  function cleanFileName(
    fileName: string
  ) {
    return fileName
      .trim()
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      )
      .replace(/-+/g, "-");
  }

  async function handleUpload(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!auth || !load) {
      setError(
        "Unable to verify your FleetOS account."
      );
      return;
    }

    if (!selectedFile) {
      setError(
        "Please select a document."
      );
      return;
    }

    if (
      selectedFile.size >
      MAX_FILE_SIZE
    ) {
      setError(
        "The maximum allowed file size is 10 MB."
      );
      return;
    }

    const allowedExtensions = [
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
    ];

    const fileName =
      selectedFile.name.toLowerCase();

    if (
      !allowedExtensions.some(
        (extension) =>
          fileName.endsWith(
            extension
          )
      )
    ) {
      setError(
        "Only PDF, JPG, JPEG and PNG documents are allowed."
      );
      return;
    }

    if (
      documentType !== "pod" &&
      documentType !== "bol"
    ) {
      setError(
        "Drivers may upload only POD or BOL documents."
      );
      return;
    }

    setUploading(true);

    try {
      const storedFileName =
        `${Date.now()}-${cleanFileName(
          selectedFile.name
        )}`;

      const filePath =
        `${auth.companyId}/${load.id}/${storedFileName}`;

      // ========================================================
      // 1. UPLOAD ACTUAL FILE
      // ========================================================

      const {
        error: uploadError,
      } = await supabase.storage
        .from("fleet-documents")
        .upload(
          filePath,
          selectedFile,
          {
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          "Storage upload error:",
          uploadError.message
        );

        throw new Error(
          uploadError.message
        );
      }

      // ========================================================
      // 2. CREATE DOCUMENT DATABASE RECORD
      // ========================================================

      const {
        error: metadataError,
      } = await supabase
        .from("load_documents")
        .insert({
          company_id:
            auth.companyId,

          load_id:
            load.id,

          document_type:
            documentType,

          file_name:
            selectedFile.name,

          file_path:
            filePath,

          uploaded_by:
            auth.userId,
        });

      if (metadataError) {
        /*
         * Remove the uploaded file if
         * database metadata creation fails.
         */

        await supabase.storage
          .from(
            "fleet-documents"
          )
          .remove([filePath]);

        console.error(
          "Document record error:",
          metadataError.message
        );

        throw new Error(
          metadataError.message
        );
      }

      // ========================================================
      // 3. AUTOMATIC POD_RECEIVED
      //
      // Only do this when:
      //
      // document = POD
      // AND
      // load is currently delivered
      //
      // The database function independently verifies:
      // - logged-in user
      // - driver role
      // - company
      // - assigned driver
      // - delivered status
      // - actual POD record exists
      // ========================================================

      let podStatusUpdated = false;

      if (
        documentType === "pod" &&
        load.status ===
          "delivered"
      ) {
        const {
          data: podResult,
          error: podError,
        } = await supabase.rpc(
          "driver_confirm_pod_received",
          {
            target_load_id:
              load.id,
          }
        );

        if (podError) {
          /*
           * IMPORTANT:
           *
           * The POD itself has already been
           * uploaded successfully.
           *
           * We therefore DO NOT delete the POD
           * just because automatic status processing
           * had a problem.
           */

          console.error(
            "Automatic POD status error:",
            podError.message,
            podError.code,
            podError.details,
            podError.hint
          );

          setSuccess(
            "POD uploaded successfully, but FleetOS could not automatically update the load to POD Received."
          );
        } else {
          console.log(
            "Automatic POD status result:",
            podResult
          );

          podStatusUpdated =
            true;
        }
      }

      // ========================================================
      // 4. SUCCESS MESSAGE
      // ========================================================

      if (
        documentType === "pod" &&
        podStatusUpdated
      ) {
        setSuccess(
          "POD uploaded successfully. Load status automatically updated to POD Received."
        );
      } else if (
        documentType === "pod" &&
        load.status !==
          "delivered"
      ) {
        setSuccess(
          "POD uploaded successfully."
        );
      } else if (
        documentType === "bol"
      ) {
        setSuccess(
          "BOL uploaded successfully."
        );
      }

      // ========================================================
      // 5. RESET FILE INPUT
      // ========================================================

      setSelectedFile(null);

      const input =
        document.getElementById(
          "driver-file"
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      // ========================================================
      // 6. REFRESH DOCUMENTS + LOAD STATUS
      // ========================================================

      await loadDocuments();
      await loadAssignedLoad();
    } catch (err: unknown) {
      console.error(
        "Document upload error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload document."
      );
    } finally {
      setUploading(false);
    }
  }

  // ============================================================
  // DOCUMENT VIEW
  // ============================================================

  async function viewDocument(
    documentRow: LoadDocument
  ) {
    setError("");

    if (
      !documentRow.file_path
    ) {
      setError(
        "This document does not have a stored file."
      );
      return;
    }

    try {
      const {
        data,
        error: urlError,
      } = await supabase.storage
        .from(
          "fleet-documents"
        )
        .createSignedUrl(
          documentRow.file_path,
          60
        );

      if (urlError) {
        throw new Error(
          urlError.message
        );
      }

      if (!data?.signedUrl) {
        throw new Error(
          "Unable to generate document link."
        );
      }

      window.open(
        data.signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open document."
      );
    }
  }

  // ============================================================
  // DISPLAY HELPERS
  // ============================================================

  function formatDate(
    value: string | null
  ) {
    if (!value) {
      return "Not scheduled";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "Not scheduled";
    }

    return date.toLocaleString();
  }

  function locationText(
    location: string | null,
    city: string | null,
    state: string | null
  ) {
    const parts: string[] =
      [];

    if (location) {
      parts.push(location);
    }

    const cityState =
      [city, state]
        .filter(Boolean)
        .join(", ");

    if (cityState) {
      parts.push(cityState);
    }

    return parts.length
      ? parts.join(" — ")
      : "Location not provided";
  }

  function prettyStatus(
    status: string
  ) {
    if (!status) {
      return "";
    }

    return status
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase()
      );
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
            FleetOS
          </p>

          <p className="mt-3 text-lg font-semibold">
            Loading your load...
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // LOAD NOT ACCESSIBLE
  // ============================================================

  if (!load) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() =>
              router.replace(
                "/driver"
              )
            }
            className="mb-6 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
          >
            ← Back to My Loads
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-xl font-bold text-red-700">
              Load unavailable
            </h1>

            <p className="mt-2 text-red-600">
              {error ||
                "Unable to access this load."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const statusAction =
    DRIVER_STATUS_FLOW[
      load.status
    ];

  const hasPod =
    documents.some(
      (documentRow) =>
        documentRow.document_type ===
        "pod"
    );

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
              FleetOS
            </p>

            <h1 className="mt-1 text-2xl font-bold">
              Load #
              {load.load_number}
            </h1>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/driver"
              )
            }
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
          >
            ← My Loads
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {success}
          </div>
        )}

        {/* LOAD HEADER */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Assigned Load
              </p>

              <h2 className="mt-1 text-3xl font-bold">
                #
                {
                  load.load_number
                }
              </h2>
            </div>

            <StatusBadge
              status={
                load.status
              }
            />
          </div>
        </section>

        {/* LOAD PROGRESS */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold">
              Load Progress
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Update the operational status as you complete each step.
            </p>
          </div>

          <div className="p-6">
            <StatusProgress
              currentStatus={
                load.status
              }
            />

            {statusAction ? (
              <div className="mt-7 flex flex-col gap-4 rounded-2xl bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    Next step:{" "}
                    {prettyStatus(
                      statusAction.nextStatus
                    )}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {
                      statusAction.description
                    }
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    updatingStatus
                  }
                  onClick={() =>
                    void updateLoadStatus()
                  }
                  className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatingStatus
                    ? "Updating..."
                    : statusAction.buttonLabel}
                </button>
              </div>
            ) : load.status ===
                "delivered" &&
              !hasPod ? (
              <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-semibold text-amber-800">
                  POD Required
                </p>

                <p className="mt-1 text-sm text-amber-700">
                  Delivery is complete.
                  Upload the signed POD
                  below to complete the
                  delivery paperwork.
                </p>
              </div>
            ) : load.status ===
              "pod_received" ? (
              <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-semibold text-emerald-800">
                  POD Received
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  Delivery paperwork has
                  been received. FleetOS
                  management can now
                  proceed with invoicing.
                </p>
              </div>
            ) : load.status ===
              "delivered" ? (
              <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-semibold text-emerald-800">
                  Delivery completed
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  POD has been uploaded.
                </p>
              </div>
            ) : (
              <div className="mt-7 rounded-2xl bg-slate-100 p-5">
                <p className="font-semibold text-slate-700">
                  No driver status action
                  is available.
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  This load is currently
                  controlled by FleetOS
                  management.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* PICKUP / DELIVERY */}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Pickup
            </p>

            <h3 className="mt-3 text-xl font-bold">
              {locationText(
                load.pickup_location,
                load.pickup_city,
                load.pickup_state
              )}
            </h3>

            <p className="mt-3 text-sm text-slate-500">
              {formatDate(
                load.pickup_date
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Delivery
            </p>

            <h3 className="mt-3 text-xl font-bold">
              {locationText(
                load.delivery_location,
                load.delivery_city,
                load.delivery_state
              )}
            </h3>

            <p className="mt-3 text-sm text-slate-500">
              {formatDate(
                load.delivery_date
              )}
            </p>
          </div>
        </section>

        {/* LOAD DETAILS */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold">
              Load Details
            </h2>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <Info
              label="Load Number"
              value={
                load.load_number
              }
            />

            <Info
              label="Equipment"
              value={
                load.equipment_type ||
                "—"
              }
            />

            <Info
              label="Miles"
              value={
                load.miles != null
                  ? Number(
                      load.miles
                    ).toLocaleString()
                  : "—"
              }
            />

            <Info
              label="Status"
              value={prettyStatus(
                load.status
              )}
            />
          </div>

          {load.notes && (
            <div className="border-t border-slate-200 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Notes
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {load.notes}
              </p>
            </div>
          )}
        </section>

        {/* DOCUMENT UPLOAD */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold">
              Upload POD / BOL
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Upload paperwork for this
              load.
            </p>
          </div>

          <form
            onSubmit={
              handleUpload
            }
            className="grid gap-5 p-6 lg:grid-cols-[200px_1fr_auto] lg:items-end"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Document Type
              </label>

              <select
                value={
                  documentType
                }
                onChange={(
                  event
                ) =>
                  setDocumentType(
                    event.target
                      .value
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
              >
                <option value="pod">
                  POD
                </option>

                <option value="bol">
                  BOL
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                File
              </label>

              <input
                id="driver-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(
                  event
                ) =>
                  setSelectedFile(
                    event.target
                      .files?.[0] ??
                      null
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5"
              />

              <p className="mt-2 text-xs text-slate-500">
                PDF, JPG or PNG —
                maximum 10 MB.
              </p>
            </div>

            <button
              type="submit"
              disabled={
                uploading
              }
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading
                ? "Uploading..."
                : "Upload Document"}
            </button>
          </form>
        </section>

        {/* DOCUMENT LIST */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold">
              Documents
            </h2>
          </div>

          {documents.length ===
          0 ? (
            <div className="p-10 text-center text-slate-500">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {documents.map(
                (doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">
                        {doc.file_name ||
                          "Load Document"}
                      </p>

                      <p className="mt-1 text-sm uppercase text-slate-500">
                        {doc.document_type.replaceAll(
                          "_",
                          " "
                        )}
                      </p>
                    </div>

                    {doc.file_path && (
                      <button
                        type="button"
                        onClick={() =>
                          void viewDocument(
                            doc
                          )
                        }
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                      >
                        View
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  let classes =
    "bg-slate-100 text-slate-700";

  if (
    status === "delivered" ||
    status === "paid" ||
    status ===
      "pod_received"
  ) {
    classes =
      "bg-emerald-100 text-emerald-700";
  } else if (
    status === "booked" ||
    status ===
      "dispatched" ||
    status ===
      "in_transit"
  ) {
    classes =
      "bg-blue-100 text-blue-700";
  } else if (
    status === "picked_up"
  ) {
    classes =
      "bg-amber-100 text-amber-700";
  } else if (
    status === "cancelled"
  ) {
    classes =
      "bg-red-100 text-red-700";
  }

  return (
    <span
      className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold capitalize ${classes}`}
    >
      {status.replaceAll(
        "_",
        " "
      )}
    </span>
  );
}

function StatusProgress({
  currentStatus,
}: {
  currentStatus: string;
}) {
  const stages = [
    "booked",
    "dispatched",
    "picked_up",
    "in_transit",
    "delivered",
    "pod_received",
  ];

  const currentIndex =
    stages.indexOf(
      currentStatus
    );

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stages.map(
        (stage, index) => {
          const completed =
            currentIndex >=
            index;

          const active =
            currentStatus ===
            stage;

          return (
            <div
              key={stage}
              className={`rounded-xl border p-4 ${
                active
                  ? "border-blue-500 bg-blue-50"
                  : completed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div
                className={`mb-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-blue-600 text-white"
                    : completed
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {completed
                  ? "✓"
                  : index + 1}
              </div>

              <p
                className={`text-sm font-semibold capitalize ${
                  active
                    ? "text-blue-700"
                    : completed
                      ? "text-emerald-700"
                      : "text-slate-500"
                }`}
              >
                {stage.replaceAll(
                  "_",
                  " "
                )}
              </p>
            </div>
          );
        }
      )}
    </div>
  );
}
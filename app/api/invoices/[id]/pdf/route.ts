import { NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Snapshot = {
  version?: number;
  generated_at?: string | null;

  carrier?: {
    name?: string | null;
    company_name?: string | null;
    legal_name?: string | null;
    mc_number?: string | null;
    dot_number?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
    country?: string | null;
    payment_terms?: number | string | null;
    invoice_notes?: string | null;
  };

  broker?: {
    company_name?: string | null;
    contact_name?: string | null;
    phone?: string | null;
    email?: string | null;
    mc_number?: string | null;
    dot_number?: string | null;
    payment_terms_days?: number | string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  };

  load?: {
    load_number?: string | null;
    equipment_type?: string | null;
    miles?: number | string | null;
    pickup_location?: string | null;
    pickup_city?: string | null;
    pickup_state?: string | null;
    pickup_date?: string | null;
    delivery_location?: string | null;
    delivery_city?: string | null;
    delivery_state?: string | null;
    delivery_date?: string | null;
  };

  charges?: {
    linehaul?: number | string | null;
    detention?: number | string | null;
    layover?: number | string | null;
    lumper?: number | string | null;
    tolls?: number | string | null;
    other_charges?: number | string | null;
  };

  totals?: {
    calculated_amount?: number | string | null;
    invoice_amount?: number | string | null;
  };
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount: number | string;
  paid_amount: number | string;
  status: string;
  notes: string | null;
  invoice_snapshot: Snapshot | null;
};

function textValue(
  value: unknown,
  fallback = "-"
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const result =
    String(value).trim();

  return result || fallback;
}

function numberValue(
  value: unknown
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function money(
  value: unknown
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  ).format(
    numberValue(value)
  );
}

function dateText(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  const normalized =
    value.length === 10
      ? `${value}T00:00:00`
      : value;

  const date =
    new Date(normalized);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }
  );
}

function dateTimeText(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-US",
    {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function cityStateZip(
  city?: string | null,
  state?: string | null,
  zip?: string | null
) {
  const cityState =
    [city, state]
      .filter(Boolean)
      .join(", ");

  return [
    cityState,
    zip,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function locationText(
  location?: string | null,
  city?: string | null,
  state?: string | null
) {
  if (location?.trim()) {
    return location.trim();
  }

  return (
    [city, state]
      .filter(Boolean)
      .join(", ") ||
    "-"
  );
}

function cleanFileName(
  value: string
) {
  const cleaned =
    value
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  return cleaned || "invoice";
}

function fitText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number
) {
  if (
    font.widthOfTextAtSize(
      text,
      size
    ) <= maxWidth
  ) {
    return text;
  }

  let result = text;

  while (
    result.length > 1 &&
    font.widthOfTextAtSize(
      `${result}...`,
      size
    ) > maxWidth
  ) {
    result =
      result.slice(0, -1);
  }

  return `${result}...`;
}

function drawLabelValue(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  labelFont: PDFFont,
  valueFont: PDFFont,
  maxWidth = 240
) {
  page.drawText(
    label.toUpperCase(),
    {
      x,
      y,
      size: 8,
      font: labelFont,
      color:
        rgb(
          0.38,
          0.43,
          0.5
        ),
    }
  );

  page.drawText(
    fitText(
      value,
      maxWidth,
      valueFont,
      10
    ),
    {
      x,
      y: y - 14,
      size: 10,
      font: valueFont,
      color:
        rgb(
          0.08,
          0.11,
          0.16
        ),
    }
  );
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        id: string;
      }>;
  }
) {
  try {
    const {
      id,
    } = await params;

    const supabase =
      await createClient();

    // ============================================================
    // AUTH
    // ============================================================

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    // RLS protects company isolation here.
    const {
      data: invoiceData,
      error: invoiceError,
    } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        paid_amount,
        status,
        notes,
        invoice_snapshot
      `)
      .eq(
        "id",
        id
      )
      .maybeSingle();

    if (invoiceError) {
      console.error(
        "Invoice PDF lookup error:",
        invoiceError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load invoice.",
        },
        {
          status: 500,
        }
      );
    }

    if (!invoiceData) {
      return NextResponse.json(
        {
          error:
            "Invoice not found.",
        },
        {
          status: 404,
        }
      );
    }

    const invoice =
      invoiceData as unknown as InvoiceRow;

    const snapshot =
      invoice.invoice_snapshot;

    if (!snapshot) {
      return NextResponse.json(
        {
          error:
            "This invoice does not have a billing snapshot. Recreate the invoice before generating its PDF.",
        },
        {
          status: 409,
        }
      );
    }

    const carrier =
      snapshot.carrier ?? {};

    const broker =
      snapshot.broker ?? {};

    const load =
      snapshot.load ?? {};

    const charges =
      snapshot.charges ?? {};

    const pdf =
      await PDFDocument.create();

    const page =
      pdf.addPage(
        [612, 792]
      );

    const regular =
      await pdf.embedFont(
        StandardFonts.Helvetica
      );

    const bold =
      await pdf.embedFont(
        StandardFonts.HelveticaBold
      );

    const width =
      page.getWidth();

    const margin = 48;

    const navy =
      rgb(
        0.08,
        0.08,
        0.08
      );

    const slate =
      rgb(
        0.34,
        0.4,
        0.48
      );

    const border =
      rgb(
        0.87,
        0.89,
        0.92
      );

    const light =
      rgb(
        0.97,
        0.98,
        0.99
      );

    const blue =
      rgb(
        0.18,
        0.18,
        0.18
      );

    // ============================================================
    // HEADER
    // ============================================================

    page.drawRectangle({
      x: 0,
      y: 700,
      width,
      height: 92,
      color: rgb(1, 1, 1),
    });

    page.drawLine({
      start: {
        x: margin,
        y: 706,
      },
      end: {
        x: width - margin,
        y: 706,
      },
      thickness: 1.5,
      color: navy,
    });

    page.drawText(
      textValue(
        carrier.name ||
        carrier.company_name,
        "FleetOS Carrier"
      ),
      {
        x: margin,
        y: 752,
        size: 18,
        font: bold,
        color: navy,
      }
    );

    const carrierIdLine = [
      carrier.mc_number
        ? `MC ${carrier.mc_number}`
        : null,

      carrier.dot_number
        ? `DOT ${carrier.dot_number}`
        : null,
    ]
      .filter(Boolean)
      .join("  |  ");

    if (carrierIdLine) {
      page.drawText(
        carrierIdLine,
        {
          x: margin,
          y: 730,
          size: 9,
          font: regular,
          color: slate,
        }
      );
    }

    page.drawText(
      "INVOICE",
      {
        x: width - 150,
        y: 750,
        size: 22,
        font: bold,
        color: navy,
      }
    );

    page.drawText(
      `# ${invoice.invoice_number}`,
      {
        x: width - 150,
        y: 728,
        size: 10,
        font: regular,
        color:
          rgb(
            0.75,
            0.82,
            0.9
          ),
      }
    );

    // ============================================================
    // INVOICE META
    // ============================================================

    drawLabelValue(
      page,
      "Invoice Date",
      dateText(
        invoice.invoice_date
      ),
      margin,
      670,
      bold,
      regular,
      120
    );

    drawLabelValue(
      page,
      "Due Date",
      dateText(
        invoice.due_date
      ),
      190,
      670,
      bold,
      regular,
      120
    );

    drawLabelValue(
      page,
      "Status",
      textValue(
        invoice.status
      )
        .replaceAll(
          "_",
          " "
        )
        .toUpperCase(),
      330,
      670,
      bold,
      regular,
      110
    );

    drawLabelValue(
      page,
      "Amount Due",
      money(
        numberValue(
          invoice.amount
        ) -
        numberValue(
          invoice.paid_amount
        )
      ),
      455,
      670,
      bold,
      bold,
      110
    );

    // ============================================================
    // FROM / BILL TO
    // ============================================================

    page.drawRectangle({
      x: margin,
      y: 516,
      width: 244,
      height: 118,
      borderColor: border,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    page.drawRectangle({
      x: 320,
      y: 516,
      width: 244,
      height: 118,
      borderColor: border,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    page.drawText(
      "FROM",
      {
        x: margin + 16,
        y: 610,
        size: 8,
        font: bold,
        color: blue,
      }
    );

    page.drawText(
      fitText(
        textValue(
          carrier.name ||
          carrier.company_name
        ),
        210,
        bold,
        11
      ),
      {
        x: margin + 16,
        y: 590,
        size: 11,
        font: bold,
        color: navy,
      }
    );

    const carrierLines = [
      carrier.address,

      cityStateZip(
        carrier.city,
        carrier.state,
        carrier.zip_code
      ),

      carrier.email,

      carrier.phone,
    ]
      .filter(Boolean)
      .map(String);

    carrierLines
      .slice(0, 4)
      .forEach(
        (
          line,
          index
        ) => {
          page.drawText(
            fitText(
              line,
              210,
              regular,
              9
            ),
            {
              x:
                margin +
                16,
              y:
                572 -
                index *
                  15,
              size: 9,
              font: regular,
              color: slate,
            }
          );
        }
      );

    page.drawText(
      "BILL TO",
      {
        x: 336,
        y: 610,
        size: 8,
        font: bold,
        color: blue,
      }
    );

    page.drawText(
      fitText(
        textValue(
          broker.company_name,
          "Broker"
        ),
        210,
        bold,
        11
      ),
      {
        x: 336,
        y: 590,
        size: 11,
        font: bold,
        color: navy,
      }
    );

    const brokerLines = [
      broker.contact_name
        ? `Attn: ${broker.contact_name}`
        : null,

      broker.address,

      cityStateZip(
        broker.city,
        broker.state,
        broker.zip_code
      ),

      broker.email,

      broker.mc_number
        ? `MC ${broker.mc_number}`
        : null,
    ]
      .filter(Boolean)
      .map(String);

    if (
      brokerLines.length === 0
    ) {
      brokerLines.push(
        "Broker billing details not provided"
      );
    }

    brokerLines
      .slice(0, 5)
      .forEach(
        (
          line,
          index
        ) => {
          page.drawText(
            fitText(
              line,
              210,
              regular,
              9
            ),
            {
              x: 336,
              y:
                572 -
                index *
                  15,
              size: 9,
              font: regular,
              color: slate,
            }
          );
        }
      );

    // ============================================================
    // LOAD DETAILS
    // ============================================================

    page.drawText(
      "LOAD DETAILS",
      {
        x: margin,
        y: 480,
        size: 10,
        font: bold,
        color: navy,
      }
    );

    page.drawLine({
      start: {
        x: margin,
        y: 470,
      },
      end: {
        x:
          width -
          margin,
        y: 470,
      },
      thickness: 1,
      color: border,
    });

    drawLabelValue(
      page,
      "Load #",
      textValue(
        load.load_number
      ),
      margin,
      447,
      bold,
      regular,
      115
    );

    drawLabelValue(
      page,
      "Equipment",
      textValue(
        load.equipment_type
      ),
      180,
      447,
      bold,
      regular,
      110
    );

    drawLabelValue(
      page,
      "Miles",
      textValue(
        load.miles
      ),
      320,
      447,
      bold,
      regular,
      85
    );

    drawLabelValue(
      page,
      "Pickup",
      locationText(
        load.pickup_location,
        load.pickup_city,
        load.pickup_state
      ),
      margin,
      405,
      bold,
      regular,
      210
    );

    drawLabelValue(
      page,
      "Pickup Date",
      dateTimeText(
        load.pickup_date
      ),
      320,
      405,
      bold,
      regular,
      200
    );

    drawLabelValue(
      page,
      "Delivery",
      locationText(
        load.delivery_location,
        load.delivery_city,
        load.delivery_state
      ),
      margin,
      363,
      bold,
      regular,
      210
    );

    drawLabelValue(
      page,
      "Delivery Date",
      dateTimeText(
        load.delivery_date
      ),
      320,
      363,
      bold,
      regular,
      200
    );

    // ============================================================
    // CHARGES
    // ============================================================

    page.drawText(
      "CHARGES",
      {
        x: margin,
        y: 315,
        size: 10,
        font: bold,
        color: navy,
      }
    );

    const rows: Array<
      [
        string,
        number,
      ]
    > = [
      [
        "Linehaul",
        numberValue(
          charges.linehaul
        ),
      ],
      [
        "Detention",
        numberValue(
          charges.detention
        ),
      ],
      [
        "Layover",
        numberValue(
          charges.layover
        ),
      ],
      [
        "Lumper",
        numberValue(
          charges.lumper
        ),
      ],
      [
        "Tolls",
        numberValue(
          charges.tolls
        ),
      ],
      [
        "Other Charges",
        numberValue(
          charges.other_charges
        ),
      ],
    ];

    const visibleRows =
      rows.filter(
        (
          [label, value]
        ) =>
          label ===
            "Linehaul" ||
          value !== 0
      );

    const tableTop = 296;
    const rowHeight = 26;

    page.drawRectangle({
      x: margin,
      y:
        tableTop -
        visibleRows.length *
          rowHeight -
        28,
      width:
        width -
        margin * 2,
      height:
        visibleRows.length *
          rowHeight +
        28,
      borderColor: border,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: margin,
      y: tableTop,
      width:
        width -
        margin * 2,
      height: 28,
      color:
        rgb(
          0.93,
          0.93,
          0.93
        ),
    });

    page.drawText(
      "DESCRIPTION",
      {
        x: margin + 12,
        y: tableTop + 9,
        size: 8,
        font: bold,
        color: slate,
      }
    );

    page.drawText(
      "AMOUNT",
      {
        x:
          width -
          margin -
          74,
        y: tableTop + 9,
        size: 8,
        font: bold,
        color: slate,
      }
    );

    visibleRows.forEach(
      (
        [label, value],
        index
      ) => {
        const y =
          tableTop -
          22 -
          index *
            rowHeight;

        page.drawText(
          label,
          {
            x: margin + 12,
            y,
            size: 9,
            font: regular,
            color: navy,
          }
        );

        const amountText =
          money(value);

        const amountWidth =
          regular.widthOfTextAtSize(
            amountText,
            9
          );

        page.drawText(
          amountText,
          {
            x:
              width -
              margin -
              12 -
              amountWidth,
            y,
            size: 9,
            font: regular,
            color: navy,
          }
        );
      }
    );

    const tableBottom =
      tableTop -
      visibleRows.length *
        rowHeight -
      28;

    // ============================================================
    // TOTAL
    // ============================================================

    const totalY =
      tableBottom -
      40;

    page.drawLine({
      start: {
        x: width - margin - 190,
        y: totalY + 18,
      },
      end: {
        x: width - margin,
        y: totalY + 18,
      },
      thickness: 1,
      color: navy,
    });

    page.drawText(
      "TOTAL",
      {
        x:
          width -
          margin -
          180,
        y: totalY,
        size: 10,
        font: bold,
        color: slate,
      }
    );

    const totalText =
      money(
        invoice.amount
      );

    const totalWidth =
      bold.widthOfTextAtSize(
        totalText,
        16
      );

    page.drawText(
      totalText,
      {
        x:
          width -
          margin -
          totalWidth,
        y:
          totalY -
          4,
        size: 16,
        font: bold,
        color: navy,
      }
    );

    // ============================================================
    // PAYMENT TERMS / NOTES
    // ============================================================

    const footerY =
      Math.max(
        66,
        totalY -
          58
      );

    const paymentTerms =
      broker.payment_terms_days ??
      carrier.payment_terms ??
      null;

    page.drawText(
      paymentTerms !==
        null &&
      paymentTerms !==
        undefined
        ? `Payment Terms: Net ${paymentTerms}`
        : "Payment Terms: -",
      {
        x: margin,
        y: footerY,
        size: 9,
        font: bold,
        color: navy,
      }
    );

    const notes =
      textValue(
        invoice.notes ||
        carrier.invoice_notes,
        ""
      );

    if (notes) {
      page.drawText(
        fitText(
          notes,
          350,
          regular,
          8
        ),
        {
          x: margin,
          y:
            footerY -
            18,
          size: 8,
          font: regular,
          color: slate,
        }
      );
    }

    page.drawText(
      "FleetOS  |  Invoice generated securely",
      {
        x: margin,
        y: 28,
        size: 7,
        font: regular,
        color:
          rgb(
            0.55,
            0.59,
            0.65
          ),
      }
    );

    const pdfBytes =
      await pdf.save();

    const fileName =
      `${cleanFileName(
        textValue(
          carrier.name ||
          carrier.company_name,
          "FleetOS"
        )
      )}-${cleanFileName(
        invoice.invoice_number
      )}.pdf`;

    return new Response(
      Buffer.from(
        pdfBytes
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${fileName}"`,

          "Cache-Control":
            "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Invoice PDF exception:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to generate invoice PDF.",
      },
      {
        status: 500,
      }
    );
  }
}

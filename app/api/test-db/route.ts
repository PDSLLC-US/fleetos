import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "Not found",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    success: true,
    message:
      "FleetOS local test endpoint is available in development only.",
  });
}
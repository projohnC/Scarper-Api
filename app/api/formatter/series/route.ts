import { NextRequest, NextResponse } from "next/server";
import { formatWebSeriesData, type RawSeriesData } from "@/lib/series-formatter";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RawSeriesData;
    const formatted = formatWebSeriesData(payload);

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}

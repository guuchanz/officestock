import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { auth } from "@/lib/auth";
import { contentTypeFor, resolveUploadPath } from "@/lib/uploads";

export const runtime = "nodejs";
// Read from disk per request: uploads arrive after the server has started.
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await params;
  const filePath = resolveUploadPath(segments);
  if (!filePath) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const file = await readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentTypeFor(filePath),
        "Content-Length": String(info.size),
        // Private: these are internal documents behind auth.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
}

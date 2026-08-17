import { NextResponse, type NextRequest } from "next/server";
import {
  IMAGEKIT_PRODUCT_FOLDER,
  IMAGEKIT_PUBLIC_KEY,
  imagekitConfigured,
  mintUploadAuth,
} from "@/lib/imagekit";
import { isSellerRequest } from "@/lib/seller-auth";

/**
 * GET /api/imagekit-auth — signature for a direct-to-ImageKit upload.
 * 503 when ImageKit isn't configured, so the client falls back to /api/upload.
 * Seller-only, same as /api/upload.
 */
export async function GET(req: NextRequest) {
  if (!isSellerRequest(req)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!imagekitConfigured()) {
    return NextResponse.json(
      { error: "ImageKit not configured" },
      { status: 503 },
    );
  }

  const { token, expire, signature } = mintUploadAuth();

  return NextResponse.json({
    token,
    expire,
    signature,
    publicKey: IMAGEKIT_PUBLIC_KEY,
    folder: IMAGEKIT_PRODUCT_FOLDER,
  });
}

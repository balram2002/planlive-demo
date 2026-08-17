import { NextResponse, type NextRequest } from "next/server";
import {
  IMAGEKIT_FOLDERS,
  IMAGEKIT_PUBLIC_KEY,
  imagekitConfigured,
  mintUploadAuth,
  type ImagekitFolderKind,
} from "@/lib/imagekit";
import { isSellerRequest } from "@/lib/seller-auth";

/**
 * GET /api/imagekit-auth?kind=product|thumbnail — signature for a
 * direct-to-ImageKit upload. 503 when ImageKit isn't configured, so the
 * client falls back to /api/upload. Seller-only, same as /api/upload.
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

  const kind = req.nextUrl.searchParams.get("kind") as ImagekitFolderKind | null;
  const folder = (kind && IMAGEKIT_FOLDERS[kind]) || IMAGEKIT_FOLDERS.product;

  const { token, expire, signature } = mintUploadAuth();

  return NextResponse.json({
    token,
    expire,
    signature,
    publicKey: IMAGEKIT_PUBLIC_KEY,
    folder,
  });
}

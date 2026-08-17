// No "server-only" guard — imported from route handlers only.
import {
  AccessToken,
  DataPacket_Kind,
  RoomServiceClient,
} from "livekit-server-sdk";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

/** wss:// URL the browser connects to. Returned to clients via the token route. */
export const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "";

export function livekitConfigured(): boolean {
  return Boolean(apiKey && apiSecret && LIVEKIT_URL);
}

/**
 * Mints a room-scoped access token. Only the broadcaster (verified by the
 * caller via the stream's broadcastSecret) may publish; everyone else joins
 * subscribe-only.
 */
export async function createAccessToken(opts: {
  roomName: string;
  identity: string;
  name?: string;
  canPublish: boolean;
}): Promise<string> {
  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit API key/secret not configured");
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name,
  });

  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: opts.canPublish,
    canPublishData: false,
    canSubscribe: true,
  });

  return at.toJwt();
}

function getRoomClient(): RoomServiceClient {
  if (!apiKey || !apiSecret || !LIVEKIT_URL) {
    throw new Error("LiveKit not configured");
  }
  const httpUrl = LIVEKIT_URL.replace(/^ws/, "http");
  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

/** Best-effort: disconnects everyone by deleting the room when a stream ends. */
export async function deleteRoom(roomName: string): Promise<void> {
  if (!livekitConfigured()) return;
  try {
    await getRoomClient().deleteRoom(roomName);
  } catch {
    // Room may already be gone (auto-closed when empty).
  }
}

/**
 * Best-effort broadcast of a JSON data message to everyone in a room, e.g.
 * live stock updates ("3 left"). Never throws.
 */
export async function broadcastToRoom(
  roomName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!livekitConfigured()) return;
  try {
    const data = new TextEncoder().encode(JSON.stringify(payload));
    await getRoomClient().sendData(
      roomName,
      data,
      DataPacket_Kind.RELIABLE,
      {},
    );
  } catch (err) {
    console.error(`LiveKit broadcast to ${roomName} failed:`, err);
  }
}

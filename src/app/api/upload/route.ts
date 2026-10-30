import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const kinds: Record<string, { ext: string; magic: number[] }> = {
  "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  "image/webp": { ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
};

type Cloudinary = { cloudName: string; apiKey: string; apiSecret: string };

/** Reads CLOUDINARY_URL (cloudinary://key:secret@cloud) or the three separate variables. */
function cloudinaryConfig(): Cloudinary | null {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (match) return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
  }
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

/** Signed upload. The API secret stays on the server and never reaches the browser. */
async function uploadToCloudinary(config: Cloudinary, bytes: Buffer, mime: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "daylight";
  const signature = createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${config.apiSecret}`)
    .digest("hex");
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), "upload");
  body.append("api_key", config.apiKey);
  body.append("timestamp", timestamp);
  body.append("folder", folder);
  body.append("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, { method: "POST", body });
  if (!response.ok) throw new Error("cloudinary");
  const result = (await response.json()) as { secure_url?: string };
  if (!result.secure_url) throw new Error("cloudinary");
  // f_auto,q_auto serves the best format and size for each device.
  return result.secure_url.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  }
  const kind = kinds[file.type];
  if (!kind) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Images must be under 4 MB." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const matches = kind.magic.every((byte, index) => bytes[index] === byte);
  if (!matches) {
    return NextResponse.json({ error: "That file is not a valid image." }, { status: 400 });
  }
  const cloud = cloudinaryConfig();
  if (cloud) {
    try {
      return NextResponse.json({ url: await uploadToCloudinary(cloud, bytes, file.type) });
    } catch {
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 502 });
    }
  }

  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  const name = `${randomUUID()}.${kind.ext}`;
  await writeFile(path.join(directory, name), bytes);
  return NextResponse.json({ url: `/uploads/${name}` });
}

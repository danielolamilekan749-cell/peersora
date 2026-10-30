import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const kinds: Record<string, { ext: string; magic: number[] }> = {
  "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  "image/webp": { ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
};

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
  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  const name = `${randomUUID()}.${kind.ext}`;
  await writeFile(path.join(directory, name), bytes);
  return NextResponse.json({ url: `/uploads/${name}` });
}

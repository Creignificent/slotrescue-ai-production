import { NextResponse } from "next/server";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function missing(name: string) {
  return json({ error: `${name} is required.` }, 400);
}

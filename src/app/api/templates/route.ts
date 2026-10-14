import { NextResponse } from 'next/server';
import { TEMPLATES } from '@/lib/templates';

export async function GET() {
  return NextResponse.json(
    TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, imageUrl: `/templates/${t.id}.png` }))
  );
}

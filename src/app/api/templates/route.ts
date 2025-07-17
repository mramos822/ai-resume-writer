import { NextResponse } from 'next/server';

export async function GET() {
  const templates = [
    {
      id: 'classic',
      name: 'Classic (Default)',
      description: 'A timeless, professional resume template.',
      imageUrl: '/templates/classic.png',
    },
    {
      id: 'modern',
      name: 'Modern',
      description: 'A stylish, contemporary resume template.',
      imageUrl: '/templates/modern.png',
    },
    {
      id: 'creative',
      name: 'Creative',
      description: 'A bold, artistic resume template for creative professionals.',
      imageUrl: '/templates/creative.png',
    },
  ];

  return NextResponse.json(templates);
}

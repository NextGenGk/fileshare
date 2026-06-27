import { PrismaClient } from './node_modules/@prisma/client/index.js';
import { put } from './node_modules/@vercel/blob/dist/index.js';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function run() {
  console.log('Uploading test blob...');
  const blob = await put('drops/test-drop-1234', 'test content', {
    access: 'public',
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN
  });
  console.log('Blob uploaded:', blob.url);

  console.log('Inserting expired drop into DB...');
  await prisma.drop.create({
    data: {
      id: 'test-drop-1234',
      slug: 'test-slug-1234',
      originalName: 'test.txt',
      sizeBytes: 12,
      contentType: 'text/plain',
      blobUrl: blob.url,
      uploadCompletedAt: new Date(),
      expiresAt: new Date(Date.now() - 1000)
    }
  });

  console.log('Confirming blob exists...');
  const res1 = await fetch(blob.url);
  console.log('Status before:', res1.status);

  console.log('Triggering cleanup cron...');
  const res2 = await fetch('http://localhost:5173/api/public/cron/cleanup', { method: 'POST' });
  console.log('Cleanup result:', await res2.json());

  console.log('Confirming blob deleted...');
  const res3 = await fetch(blob.url);
  console.log('Status after (expecting 404/403):', res3.status);

  await prisma.drop.deleteMany({ where: { id: 'test-drop-1234' } });
}

run().catch(console.error).finally(() => prisma.$disconnect());

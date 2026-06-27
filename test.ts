import { prisma } from './src/integrations/prisma/client.server.ts';
import { put } from '@vercel/blob';

async function run() {
  const uuid = crypto.randomUUID();
  console.log('Uploading test blob for ' + uuid + '...');
  const blob = await put('drops/' + uuid, 'test content', {
    access: 'public',
    token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN
  });
  console.log('Blob uploaded:', blob.url);

  console.log('Inserting expired drop into DB...');
  await prisma().drop.create({
    data: {
      id: uuid,
      slug: uuid,
      originalName: 'test.txt',
      sizeBytes: 12,
      contentType: 'text/plain',
      blobUrl: blob.url,
      uploadCompletedAt: new Date(),
      expiresAt: new Date(Date.now() - 1000)
    }
  });

  const res1 = await fetch(blob.url);
  console.log('Status before:', res1.status);

  console.log('Triggering cleanup cron...');
  const res2 = await fetch('http://localhost:8080/api/public/cron/cleanup', { method: 'POST' });
  console.log('Cleanup result status:', res2.status, await res2.text());

  const res3 = await fetch(blob.url);
  console.log('Status after (expecting 404/403):', res3.status);

  await prisma().drop.deleteMany({ where: { slug: uuid } });
}

run().catch(console.error);

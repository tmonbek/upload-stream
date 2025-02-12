import cors from 'cors';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'node:path';
import { mimeTypes } from './src/constants';

const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream' }));
app.use(cors());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CHUNK_DIR = path.join(__dirname, 'chunks');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(CHUNK_DIR)) {
  fs.mkdirSync(CHUNK_DIR, { recursive: true });
}

app.post('/ufs/:filename', async (req: Request, res: Response) => {
  const fileDir = path.join(CHUNK_DIR, req.params.filename);
  const writeStream = fs.createWriteStream(fileDir, {
    flags: 'a',
    encoding: 'binary',
  });

  req.on('data', (chunk) => {
    console.log((chunk.length / 1024).toFixed(2), 'KB');
    writeStream.write(chunk);
  });

  req.on('end', () => {
    writeStream.end();
    fs.rename(fileDir, path.join(UPLOAD_DIR, req.params.filename), (err) => {
      if (err) {
        console.log(err);
        return;
      }
    });
    res.status(200).send('File successfully uploaded!');
  });

  req.on('error', (err: Error) => {
    writeStream.end();
    console.error('Error Request on writing chunk:', err);
    res.status(500).send('Error on uploading chunk!');
  });

  writeStream.on('error', (err: Error) => {
    writeStream.end();
    console.error('Error Write on writing chunk:', err);
    res.status(500).send('Error writing chunk');
  });
});

app.get('/chunk-info/:filename', async (req: Request, res: Response) => {
  const uploadedDir = path.join(UPLOAD_DIR, req.params.filename);
  if (fs.existsSync(uploadedDir)) {
    res.status(200).send({
      message: 'File uploaded!',
      isUpload: false,
      size: fs.statSync(uploadedDir).size,
    });
    return;
  }

  const fileDir = path.join(CHUNK_DIR, req.params.filename);
  if (fs.existsSync(fileDir)) {
    res.status(200).send({
      message: 'Part of file uploaded!',
      isUpload: true,
      size: fs.statSync(fileDir).size,
    });
    return;
  }

  res.status(200).send({
    message: 'File not found!',
    isUpload: true,
    size: 0,
  });
});

app.post('/chunk-info/:filename', async (req: Request, res: Response) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  const receivedSize = req.body.receivedSize;
  const chunkSize = req.body.chunkSize;
  if (!fs.existsSync(filePath)) {
    res.status(404).send('File not found');
    return;
  }

  const fileSize = fs.statSync(filePath).size;
  const extname = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';

  if (receivedSize >= fileSize) {
    res.status(416).send('Requested range not satisfiable');
    return;
  }

  res.setHeader('Content-Length', fileSize);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const fileStream = fs.createReadStream(filePath, {
    start: receivedSize,
    highWaterMark: chunkSize || 2 * 1024 * 1024,
  });

  let totalBytesSent = 0;

  fileStream.on('data', (chunk) => {
    totalBytesSent += chunk.length;
  });

  res.on('close', () => {
    res.send(`Connection closed. Total bytes sent before closure: ${totalBytesSent}`);
  });

  fileStream.on('end', () => {
    res.send(`File successfully sent. Total bytes sent: ${totalBytesSent}`);
  });

  fileStream.on('error', (err) => {
    res.status(500).send('Error reading the file');
  });

  fileStream.pipe(res);
});

app.get('/download/:filename', async (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('File not found');
    return;
  }

  const fileSize = fs.statSync(filePath).size;
  const extname = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';

  res.setHeader('Content-Length', fileSize);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const fileStream = fs.createReadStream(filePath, { highWaterMark: 2 * 1024 * 1024 });

  let totalBytesSent = 0;

  fileStream.on('data', (chunk) => {
    totalBytesSent += chunk.length;
  });

  res.on('close', () => {
    res.status(499).send(`Connection closed. Total bytes sent before closure: ${totalBytesSent}`);
  });

  fileStream.on('end', () => {
    res.status(200).send(`File successfully sent. Total bytes sent: ${totalBytesSent}`);
  });

  fileStream.on('error', (err) => {
    res.status(500).send('Error reading the file');
  });

  fileStream.pipe(res);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

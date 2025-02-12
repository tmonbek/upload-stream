// import express, {Request, Response, NextFunction} from 'express';
// import multer, {FileFilterCallback} from 'multer';
// import path from 'path';
// import fs from 'fs';
// import {mimeTypes} from "./src/constants";
// import {stat} from "node:fs/promises";
//
// const app = express();
// const port = 3000;
//
// const uploadDir = path.join(__dirname, 'uploads');
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }
//
// // Configure Multer storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/'); // Save files in 'uploads' directory
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
//     cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
//   },
// });
//
// const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
//   const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/x-msdos-program'];
//   if (allowedTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(null, false);
//   }
// };
//
// const upload = multer({storage, fileFilter});
//
// app.get('/download/:filename', async (req, res) => {
//   const filePath = path.join(uploadDir, req.params.filename);
//   if (!fs.existsSync(filePath)) {
//     res.status(404).send('File not found');
//     return
//   }
//
//   const {size} = await stat(filePath);
//   const extname = path.extname(filePath).toLowerCase();
//   const mimeType = mimeTypes[extname] || 'application/octet-stream';
//
//
//   res.setHeader('Content-Length', size);
//   res.setHeader('Content-Type', mimeType);
//   res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
//   res.setHeader('Content-Security-Policy', "default-src 'none'")
//   res.setHeader('X-Content-Type-Options', 'nosniff')
//
//   const fileStream = fs.createReadStream(filePath);
//
//   let totalBytesSent = 0;
//
//   fileStream.on('data', (chunk) => {
//     totalBytesSent += chunk.length;
//   });
//
//   res.on('close', () => {
//     console.log(`Connection closed. Total bytes sent before closure: ${totalBytesSent}`);
//   });
//
//   fileStream.on('end', () => {
//     console.log(`File successfully sent. Total bytes sent: ${totalBytesSent}`);
//   });
//
//   fileStream.on('error', (err) => {
//     res.status(500).send('Error reading the file');
//   });
//
//   fileStream.pipe(res);
// });
//
// app.post('/upload', upload.single('file'), (req: Request, res: Response) => {
//   if (!req.file) {
//     res.status(400).json({message: 'No file uploaded or file type not allowed.'});
//     return;
//   }
//   res.json({message: 'File uploaded successfully', filename: req.file.filename});
// });
//
// app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
//   console.error(err.stack);
//   res.status(500).json({error: 'Internal Server Error', details: err.message});
// });
//
// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });

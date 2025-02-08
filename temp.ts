import express, { Request, Response } from "express";
import path from "node:path";
import fs from "fs";
import cors from "cors";
import { pipeline } from "stream";
import { promisify } from "util";

const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
app.use(cors());

const UPLOAD_DIR = path.join(__dirname, "uploads");
const CHUNK_DIR = path.join(__dirname, "chunks");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(CHUNK_DIR)) {
    fs.mkdirSync(CHUNK_DIR, { recursive: true });
}

async function getTotalFileSize(dir: string) {
    let currentFilesSize = 0;

    try {
        const files = await fs.promises.readdir(dir, { withFileTypes: true });

        const fileSizes = await Promise.all(files.map(async (file) => {
            const filePath = path.join(dir, file.name);
            const stats = await fs.promises.stat(filePath);
            return stats.isFile() ? stats.size : 0;
        }));

        currentFilesSize = fileSizes.reduce((acc, size) => acc + size, 0);
    } catch (err) {
        console.error("Error:", err);
    }

    return currentFilesSize;
}

app.post("/file-stream-upload", async (req: Request, res: Response) => {
    const fileName = (req.query.filename as string) || `upload-${Date.now()}.bin`;
    const fileDir = path.join(CHUNK_DIR, fileName);

    let uploadedSize = 0;

    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
    }

    const filesSize = await getTotalFileSize(fileDir);

    req.on("data", (chunk) => {
        const currentChunkPath = path.join(fileDir, `${fileName}.part${new Date().getTime()}`);
        const writeStream = fs.createWriteStream(currentChunkPath);

        if (filesSize && uploadedSize <= filesSize) {
            uploadedSize+=chunk.length;
            return;
        }

        if (filesSize && uploadedSize >= filesSize  && chunk.length - (uploadedSize - filesSize) > 0) {
            const data = chunk.slice((uploadedSize - filesSize));
            writeStream.write(data);
        }

        writeStream.write(chunk);
        uploadedSize += chunk.length;
        writeStream.end();

        writeStream.on("error", (err) => {
            console.error("Error writing chunk:", err);
            res.status(500).send("Error writing chunk");
        });
    });

    req.on("end", () => {
        console.log(`All chunks received for file: ${fileName}`);
        res.status(200).send("All chunks uploaded successfully");
    });

    req.on("error", (err) => {
        console.error("Error reading request stream:", err);
        res.status(400).send("Error uploading file");
    });
});

app.post("/merge-chunks", (req: Request, res: Response) => {
    const fileName = (req.query.filename as string) || `upload-${Date.now()}.bin`;
    const fileDir = path.join(CHUNK_DIR, fileName);
    const outputFilePath = path.join(UPLOAD_DIR, fileName);

    if (!fs.existsSync(fileDir)) {
         res.status(404).send("File chunks not found");
        return
    }

    const chunkFiles = fs
        .readdirSync(fileDir)
        .sort((a, b) => parseInt(a.split("part")[1]) - parseInt(b.split("part")[1]));

    const writeStream = fs.createWriteStream(outputFilePath);

    chunkFiles.forEach((chunkFile) => {
        const chunkFilePath = path.join(fileDir, chunkFile);
        const chunkData = fs.readFileSync(chunkFilePath);
        writeStream.write(chunkData);
    });

    writeStream.end();

    writeStream.on("finish", () => {
        // Remove the chunk directory after merging
        fs.rmdirSync(fileDir, { recursive: true });
        console.log(`File merged successfully: ${outputFilePath}`);
        res.status(200).send("File merged successfully");
    });

    writeStream.on("error", (err) => {
        console.error("Error merging chunks:", err);
        res.status(500).send("Error merging chunks");
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
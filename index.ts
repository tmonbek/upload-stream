// @ts-ignore
import express, {Request, Response} from "express"
// @ts-ignore
import path from "node:path";
// @ts-ignore
import fs from 'fs'
import cors from 'cors'

/**
 * receive chunks to unique file
 * if all chunks received merge all chunks and remove that dir
 * create chunks check endpoint
 *
 * create merge endpoint
 */



const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
app.use(cors())

const UPLOAD_DIR = path.join(__dirname, "uploads");
const CHUNK_DIR = path.join(__dirname, "chunks");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

if (!fs.existsSync(CHUNK_DIR)) {
    fs.mkdirSync(CHUNK_DIR);
}

app.post("/file-stream-upload", async (req: Request, res: Response) => {
    const chunkIndex = req.headers["chunkindex"] as string;
    const totalChunks = req.headers["totalchunks"] as string;
    const fileName = req.headers["filename"] as string;

    if (!chunkIndex || !totalChunks || !fileName) {
         res.status(400).json({ error: "Missing required headers" });
        return
    }

    const chunkDirPath = path.join(CHUNK_DIR, path.basename(fileName, path.extname(fileName)));
    const finalFilePath = path.join(UPLOAD_DIR, fileName);

    if (!fs.existsSync(chunkDirPath)) {
        fs.mkdirSync(chunkDirPath, { recursive: true });
    }

    const currentChunkPath = path.join(chunkDirPath, `${fileName}.part${chunkIndex}`);
    const writeStream = fs.createWriteStream(currentChunkPath);
    req.pipe(writeStream);

    writeStream.on("finish", async () => {
        const uploadedChunks = fs.readdirSync(chunkDirPath).filter((file) => file.startsWith(`${fileName}.part`)).length;

        if (uploadedChunks === parseInt(totalChunks)) {
            const finalWriteStream = fs.createWriteStream(finalFilePath);
            for (let i = 0; i < parseInt(totalChunks); i++) {
                const chunkPath = path.join(chunkDirPath, `${fileName}.part${i}`);
                const chunk = fs.readFileSync(chunkPath);
                finalWriteStream.write(chunk);
                fs.unlinkSync(chunkPath);
            }
            finalWriteStream.end(() => {
                fs.rmdirSync(chunkDirPath);
                console.log(`File ${fileName} successfully merged.`);
            });
        }

        res.status(200).send("Chunk uploaded");
    });

    writeStream.on("error", (err) => {
        console.error("Error writing chunk:", err);
        res.status(500).json({ error: "Chunk upload failed" });
    });
});

app.post("/file-merge/:filename", async (req, res) => {

})
app.get("/file-chunks-stat/:filename", async (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename, path.extname(req.params.filename));
    if (!fs.existsSync(path.join(UPLOAD_DIR, filename))) {
        res.sendStatus(404)
        return;
    }
    const totalChunks = req.headers["totalChunks"] as string;
    const files = fs.readdirSync(path.join(UPLOAD_DIR, filename));

    const filteredFileParts = files.filter(file => fs.statSync(path.join(path.join(UPLOAD_DIR, filename), file)).isFile());
    if (filteredFileParts.length === parseInt(totalChunks)) {
        res.status(200).send({
            message: "Success!",
            chunks: []
        })
    }
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

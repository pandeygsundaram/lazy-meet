import express, { Request, Response } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

app.use(express.json());

app.post('/transcribe-and-summarize', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Received audio file:', req.file.originalname);

    const audioFilePath = req.file.path;

    console.log('Transcribing audio...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: 'whisper-1',
    });

    const transcribedText = transcription.text;
    console.log('Transcription complete:', transcribedText.substring(0, 100) + '...');

    console.log('Generating summary...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes audio transcriptions. Provide a clear, concise summary of what was discussed in the audio.',
        },
        {
          role: 'user',
          content: `Please summarize the following transcription:\n\n${transcribedText}`,
        },
      ],
    });

    const summary = completion.choices[0].message.content;

    const timestamp = Date.now();
    const fileExtension = path.extname(req.file.originalname) || '.mp3';
    const fileName = `${timestamp}${fileExtension}`;

    console.log('Uploading audio to R2...');
    const fileBuffer = fs.readFileSync(audioFilePath);
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(uploadCommand);
    console.log('Audio uploaded to R2:', fileName);

    fs.unlinkSync(audioFilePath);
    console.log('Temporary file cleaned up');

    res.json({
      success: true,
      transcription: transcribedText,
      summary: summary,
      audioUrl: fileName,
    });
  } catch (error: any) {
    console.error('Error processing audio:', error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to process audio',
      details: error.message,
    });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`POST /transcribe-and-summarize - Upload audio file for transcription and summary`);
  console.log(`GET /health - Check server status`);

  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }
});

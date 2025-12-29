import { Router, Response } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

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

// Upload and process recording
router.post('/upload', authMiddleware, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  let recordingId: string | null = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Received audio file:', req.file.originalname);

    const audioFilePath = req.file.path;
    const duration = parseInt(req.body.duration || '0');

    // Step 1: Upload to R2 first
    const timestamp = Date.now();
    const fileExtension = path.extname(req.file.originalname) || '.m4a';
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

    // Step 2: Create recording with status "uploaded"
    const recording = await prisma.recording.create({
      data: {
        userId: req.userId!,
        title: 'Processing...',
        audioUrl: fileName,
        duration,
        status: 'uploaded',
      },
    });

    recordingId = recording.id;
    console.log('Recording saved with status: uploaded');

    // Clean up temp file immediately
    fs.unlinkSync(audioFilePath);

    // Step 3: Return immediately with upload confirmation
    res.json({
      success: true,
      recording: {
        id: recording.id,
        title: recording.title,
        status: recording.status,
        audioUrl: recording.audioUrl,
        duration: recording.duration,
        createdAt: recording.createdAt,
      },
    });

    // Step 4: Process in background using presigned URL (don't await)
    processRecordingInBackground(recording.id, fileName).catch((error) => {
      console.error('Background processing failed:', error);
    });

  } catch (error: any) {
    console.error('Error uploading audio:', error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // If recording was created, mark it as failed
    if (recordingId) {
      await prisma.recording.update({
        where: { id: recordingId },
        data: { status: 'failed' },
      }).catch(console.error);
    }

    res.status(500).json({
      error: 'Failed to upload audio',
      details: error.message,
    });
  }
});

// Background processing function
async function processRecordingInBackground(recordingId: string, fileName: string) {
  try {
    // Update status to processing
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: 'processing' },
    });

    console.log(`Processing recording ${recordingId}...`);

    // Generate presigned URL from R2
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    console.log('Generated presigned URL for transcription');

    // Transcribe audio using presigned URL
    console.log('Transcribing audio...');
    const transcription = await openai.audio.transcriptions.create({
      file: await fetch(presignedUrl).then(r => r.blob()) as any,
      model: 'whisper-1',
    });

    const transcribedText = transcription.text;
    console.log('Transcription complete');

    // Generate summary
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

    const summary = completion.choices[0].message.content || '';

    // Generate title from transcription
    const title = transcribedText.split(/[.!?]/)[0].trim().substring(0, 100) || 'Untitled Recording';

    // Update recording with processed data
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        title,
        summary,
        transcription: transcribedText,
        status: 'processed',
      },
    });

    console.log(`Recording ${recordingId} processed successfully`);

  } catch (error: any) {
    console.error(`Failed to process recording ${recordingId}:`, error);

    // Mark as failed
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: 'failed' },
    }).catch(console.error);
  }
}

// Get all recordings for user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const recordings = await prisma.recording.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        summary: true,
        audioUrl: true,
        duration: true,
        createdAt: true,
      },
    });

    res.json({ success: true, recordings });
  } catch (error: any) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings', details: error.message });
  }
});

// Get single recording
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const recording = await prisma.recording.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    res.json({ success: true, recording });
  } catch (error: any) {
    console.error('Error fetching recording:', error);
    res.status(500).json({ error: 'Failed to fetch recording', details: error.message });
  }
});

// Delete recording
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const recording = await prisma.recording.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    await prisma.recording.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: 'Recording deleted' });
  } catch (error: any) {
    console.error('Error deleting recording:', error);
    res.status(500).json({ error: 'Failed to delete recording', details: error.message });
  }
});

export default router;

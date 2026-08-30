/**
 * AI Streaming Routes - SSE endpoints for real-time AI responses
 */

import { Router, type Request, type Response } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { generateAi } from '../lib/aiProvider';
import type { AiRequest } from '../lib/aiProvider';

export const aiStreamingRouter = Router();

/**
 * Format SSE data message
 */
function sseData(data: { type: string; content: string; metadata?: any }): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Format SSE comment (keeps connection alive)
 */
function sseComment(comment: string): string {
  return `: ${comment}\n\n`;
}

/**
 * Stream AI response as SSE events
 */
async function streamAiResponse(
  res: Response,
  prompt: string,
  userId: string
) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const startTime = Date.now();

  // Keep-alive heartbeat
  const heartbeat = setInterval(() => {
    res.write(sseComment('heartbeat'));
  }, 15000);

  try {
    // Meta event
    res.write(sseData({
      type: 'meta',
      content: 'Stream started',
      metadata: { latencyMs: Date.now() - startTime },
    }));

    // Generate AI response
    const aiReq: AiRequest = {
      userId,
      prompt,
      purpose: 'streaming_coach',
    };

    const result = await generateAi(aiReq);

    if (result && result.text) {
      const text = result.text;
      const chunkSize = 20;
      
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        res.write(sseData({ type: 'token', content: chunk }));
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      res.write(sseData({
        type: 'done',
        content: 'Stream complete',
        metadata: {
          model: result.model,
          tokensUsed: (result.tokensIn || 0) + (result.tokensOut || 0),
          latencyMs: Date.now() - startTime,
        },
      }));
    } else {
      res.write(sseData({
        type: 'error',
        content: 'Failed to generate response',
      }));
    }
  } catch (error) {
    res.write(sseData({
      type: 'error',
      content: error instanceof Error ? error.message : 'Unknown error',
    }));
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

/**
 * GET /api/ai/coach?prompt=... (non-streaming fallback)
 */
aiStreamingRouter.get('/ai/coach', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { prompt } = req.query;
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt parameter' });
    return;
  }

  const result = await generateAi({
    userId,
    prompt,
    purpose: 'coach_reply',
  });

  if (result?.text) {
    res.json({ reply: result.text });
  } else {
    res.status(502).json({ error: 'AI unavailable' });
  }
});

/**
 * GET /api/ai/coach/stream?prompt=...&context=...
 */
aiStreamingRouter.get('/ai/coach/stream', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { prompt, context } = req.query;
  if (!prompt || typeof prompt !== 'string' || prompt.length === 0) {
    res.status(400).json({ error: 'Missing prompt parameter' });
    return;
  }
  if (prompt.length > 2000) {
    res.status(400).json({ error: 'Prompt too long (max 2000 chars)' });
    return;
  }

  await streamAiResponse(res, prompt, userId);
});

/**
 * GET /api/ai/feynman/stream?topic=...&level=...
 */
aiStreamingRouter.get('/ai/feynman/stream', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { topic, level } = req.query;
  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ error: 'Missing topic parameter' });
    return;
  }

  const levelStr = level === 'child' ? 'explain like I am 12'
    : level === 'teen' ? 'explain like I am 16'
    : 'explain clearly with analogies';

  const prompt = `${levelStr}: Explain "${topic}" using simple language, real-world analogies, and concrete examples. Break it into: (1) what it is, (2) why it matters, (3) how it works in practice.`;

  await streamAiResponse(res, prompt, userId);
});

/**
 * GET /api/ai/tasks/decompose/stream?task=...
 */
aiStreamingRouter.get('/ai/tasks/decompose/stream', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { task } = req.query;
  if (!task || typeof task !== 'string') {
    res.status(400).json({ error: 'Missing task parameter' });
    return;
  }

  const prompt = `Break this task into 3-7 concrete subtasks. For each subtask: give it a clear title, estimate time in minutes, and add a one-line description. Format as a numbered list.

Task: "${task}"`;

  await streamAiResponse(res, prompt, userId);
});

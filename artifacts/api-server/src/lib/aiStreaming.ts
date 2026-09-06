/**
 * AI Streaming utilities - SSE helpers for real-time AI responses
 * 
 * Blueprint: Weeks 5-6 AI Intelligence
 * Provides sub-200ms first token via Server-Sent Events
 */

import type { Response } from 'express';

export interface StreamMessage {
  type: 'token' | 'done' | 'error' | 'meta';
  content: string;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    latencyMs?: number;
  };
}

/**
 * Format SSE data message
 */
export function formatSseData(data: StreamMessage): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Format SSE comment (keeps connection alive)
 */
export function formatSseComment(comment: string): string {
  return `: ${comment}\n\n`;
}

/**
 * Set SSE headers on response
 */
export function setSseHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

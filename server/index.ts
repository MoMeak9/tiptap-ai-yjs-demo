import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { DeepSeekClient } from './deepseek';
import type { AIRewriteRequest } from './types';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'ai-proxy-server',
    version: '1.0.0',
  });
});

// AI rewrite endpoint
app.post('/api/ai/rewrite', async (req, res) => {
  try {
    const { content, instruction, format } = req.body as AIRewriteRequest;

    // Validation
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required',
      });
    }

    if (!instruction) {
      return res.status(400).json({
        success: false,
        error: 'Instruction is required',
      });
    }

    if (format && !['yjs', 'json', 'html'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Must be: yjs, json, or html',
      });
    }

    // Check API key
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'DEEPSEEK_API_KEY not configured',
      });
    }

    // Call DeepSeek
    console.log(
      `[AI Rewrite] Format: ${format}, Instruction: ${instruction.substring(0, 50)}...`
    );

    const client = new DeepSeekClient(apiKey);
    const result = await client.rewrite(content, instruction, format || 'json');

    if (!result.success) {
      return res.status(500).json(result);
    }

    console.log(
      `[AI Rewrite] Success - Duration: ${result.meta?.duration}ms, Tokens: ${result.meta?.tokenCount}`
    );

    res.json(result);
  } catch (error) {
    console.error('[AI Rewrite] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DeepSeek health check endpoint
app.get('/api/ai/health', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.json({
        healthy: false,
        error: 'API key not configured',
      });
    }

    const client = new DeepSeekClient(apiKey);
    const healthy = await client.health();

    res.json({
      healthy,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.json({
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('[Server Error]:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 AI Proxy Server started`);
  console.log(`   - Local:   http://localhost:${PORT}`);
  console.log(`   - Health:  http://localhost:${PORT}/api/health`);
  console.log(`   - API Key: ${process.env.DEEPSEEK_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`\n📡 Endpoints:`);
  console.log(`   POST /api/ai/rewrite`);
  console.log(`   GET  /api/ai/health`);
  console.log(`   GET  /api/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

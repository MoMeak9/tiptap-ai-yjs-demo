import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { DeepSeekClient } from './deepseek';
import { BailianClient } from './bailian';
import { JimengClient, JIMENG_PROMPT_SYSTEM } from './jimeng';
import { MermaidGenerator } from './mermaid';
import type {
  AIRewriteRequest,
  TextToImageRequest,
  JimengTextToImageRequest,
  MermaidGenerateRequest,
} from './types';

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

// AI text-to-image endpoint (Alibaba Bailian / DashScope)
app.post('/api/ai/text-to-image', async (req, res) => {
  try {
    const { prompt, negativePrompt, size, n, model } = req.body as TextToImageRequest;

    // Validation
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    // Check API key
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'DASHSCOPE_API_KEY not configured',
      });
    }

    // Call Bailian (DashScope)
    console.log(
      `[AI Text-to-Image] Prompt: ${prompt.substring(0, 50)}..., Model: ${model || 'wanx2.1-t2i-turbo'}`
    );

    const client = new BailianClient(apiKey);
    const result = await client.textToImage(prompt, {
      negativePrompt,
      size,
      n,
      model,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    console.log(
      `[AI Text-to-Image] Success - Duration: ${result.meta?.duration}ms, Images: ${result.meta?.imageCount}`
    );

    res.json(result);
  } catch (error) {
    console.error('[AI Text-to-Image] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Bailian (DashScope) health check endpoint
app.get('/api/ai/text-to-image/health', async (req, res) => {
  try {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return res.json({
        healthy: false,
        error: 'DASHSCOPE_API_KEY not configured',
      });
    }

    const client = new BailianClient(apiKey);
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

// Jimeng (即梦AI) text-to-image endpoint with context-aware prompt optimization
app.post('/api/ai/jimeng', async (req, res) => {
  try {
    const {
      selectedText,
      contextBefore,
      contextAfter,
      size,
      reqKey,
      skipPromptOptimization,
    } = req.body as JimengTextToImageRequest;

    // Validation
    if (!selectedText) {
      return res.status(400).json({
        success: false,
        error: 'selectedText is required',
      });
    }

    // Check Volcengine credentials
    const volcAccessKey = process.env.VOLC_ACCESSKEY;
    const volcSecretKey = process.env.VOLC_SECRETKEY;
    if (!volcAccessKey || !volcSecretKey) {
      return res.status(500).json({
        success: false,
        error: 'Volcengine credentials (VOLC_ACCESSKEY, VOLC_SECRETKEY) not configured',
      });
    }

    const startTime = Date.now();
    let optimizedPrompt = selectedText;
    let promptOptimizationDuration = 0;

    // Step 1: Optimize prompt using DeepSeek (if enabled and available)
    if (!skipPromptOptimization) {
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
      if (deepseekApiKey) {
        try {
          console.log('[Jimeng] Optimizing prompt with DeepSeek...');
          const promptStartTime = Date.now();

          const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${deepseekApiKey}`,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: JIMENG_PROMPT_SYSTEM },
                {
                  role: 'user',
                  content: `前文: ${contextBefore || '(无)'}\n选中文本: ${selectedText}\n后文: ${contextAfter || '(无)'}`,
                },
              ],
              temperature: 0.7,
              max_tokens: 500,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
              optimizedPrompt = content.trim();
              promptOptimizationDuration = Date.now() - promptStartTime;
              console.log(`[Jimeng] Optimized prompt: ${optimizedPrompt.substring(0, 100)}...`);
            }
          }
        } catch (promptError) {
          console.warn('[Jimeng] Prompt optimization failed, using original text:', promptError);
        }
      } else {
        console.log('[Jimeng] DeepSeek not configured, using original text as prompt');
      }
    }

    // Step 2: Generate image using Jimeng
    console.log(`[Jimeng] Generating image with req_key: ${reqKey || 'high_aes_general_v21_L'}`);

    const jimengClient = new JimengClient(
      volcAccessKey,
      volcSecretKey,
      process.env.VOLC_REGION || 'cn-north-1'
    );

    const result = await jimengClient.generateImage(optimizedPrompt, {
      reqKey: reqKey || 'high_aes_general_v21_L',
      width: size?.width || 1024,
      height: size?.height || 1024,
      returnUrl: true,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Add optimized prompt and timing info to response
    if (result.data) {
      result.data.optimizedPrompt = optimizedPrompt;
    }
    if (result.meta) {
      result.meta.promptOptimizationDuration = promptOptimizationDuration;
      result.meta.duration = Date.now() - startTime;
    }

    console.log(
      `[Jimeng] Success - Total: ${result.meta?.duration}ms, Prompt: ${promptOptimizationDuration}ms`
    );

    res.json(result);
  } catch (error) {
    console.error('[Jimeng] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Jimeng health check endpoint
app.get('/api/ai/jimeng/health', async (req, res) => {
  try {
    const volcAccessKey = process.env.VOLC_ACCESSKEY;
    const volcSecretKey = process.env.VOLC_SECRETKEY;

    if (!volcAccessKey || !volcSecretKey) {
      return res.json({
        healthy: false,
        error: 'Volcengine credentials not configured',
      });
    }

    const client = new JimengClient(
      volcAccessKey,
      volcSecretKey,
      process.env.VOLC_REGION || 'cn-north-1'
    );
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

// AI Mermaid generation endpoint
app.post('/api/ai/mermaid', async (req, res) => {
  try {
    const {
      selectedText,
      contextBefore,
      contextAfter,
      documentOutline,
      userInstruction,
    } = req.body as MermaidGenerateRequest;

    // Validation
    if (!selectedText) {
      return res.status(400).json({
        success: false,
        error: 'selectedText is required',
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

    // Call Mermaid Generator
    console.log(
      `[AI Mermaid] Generating diagram from: "${selectedText.substring(0, 50)}..."`
    );

    const generator = new MermaidGenerator(apiKey);
    const result = await generator.generate({
      selectedText,
      contextBefore,
      contextAfter,
      documentOutline,
      userInstruction,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    console.log(
      `[AI Mermaid] Success - Type: ${result.data?.diagramType}, Duration: ${result.meta?.duration}ms, Repaired: ${result.data?.wasRepaired}`
    );

    res.json(result);
  } catch (error) {
    console.error('[AI Mermaid] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Mermaid generation health check endpoint
app.get('/api/ai/mermaid/health', async (req, res) => {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.json({
        healthy: false,
        error: 'DEEPSEEK_API_KEY not configured',
      });
    }

    const generator = new MermaidGenerator(apiKey);
    const healthy = await generator.health();

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
  console.log(`\n🔑 API Keys:`);
  console.log(`   - DeepSeek:   ${process.env.DEEPSEEK_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   - DashScope:  ${process.env.DASHSCOPE_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   - Volcengine: ${process.env.VOLC_ACCESSKEY && process.env.VOLC_SECRETKEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`\n📡 Endpoints:`);
  console.log(`   POST /api/ai/rewrite          - Text rewriting (DeepSeek)`);
  console.log(`   POST /api/ai/text-to-image    - Text to image (Bailian/DashScope)`);
  console.log(`   POST /api/ai/jimeng           - Text to image (Jimeng/Volcengine)`);
  console.log(`   POST /api/ai/mermaid          - Mermaid diagram generation (DeepSeek)`);
  console.log(`   GET  /api/ai/health           - DeepSeek health check`);
  console.log(`   GET  /api/ai/text-to-image/health - DashScope health check`);
  console.log(`   GET  /api/ai/jimeng/health    - Jimeng health check`);
  console.log(`   GET  /api/ai/mermaid/health   - Mermaid generation health check`);
  console.log(`   GET  /api/health              - Server health check\n`);
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

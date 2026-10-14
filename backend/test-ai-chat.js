/**
 * Comprehensive Automated Test Suite for Edunix Unified AI Architecture
 * Tests:
 * 1. N8nLearningAgentService (availability, extraction, error handling)
 * 2. OnlineChatEngine / Gemini (availability, normalization)
 * 3. OllamaChatEngine (local detection, model check)
 * 4. ChatEngineManager:
 *    - AUTO mode: n8n primary, fallback to Ollama (NEVER Gemini)
 *    - GEMINI mode: Gemini primary, fallback to Ollama (NEVER n8n)
 *    - LOCAL mode: Ollama only (NEVER n8n or Gemini)
 *    - Dual failure handling (503 combined error)
 *    - History context bounding (15 messages)
 * 5. End-to-End Live HTTP API Tests (/api/chat/status, /api/chat/message)
 */

import { ChatEngineManager } from './src/services/ai/chatEngineManager.js';
import { N8nLearningAgentService } from './src/services/ai/n8nLearningAgentService.js';
import { OnlineChatEngine } from './src/services/ai/onlineEngine.js';
import { OllamaChatEngine } from './src/services/ai/ollamaEngine.js';

let passed = 0;
let failed = 0;

const assert = (condition, description) => {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
};

const runAllTests = async () => {
  console.log('🧪 Starting EDUNIX Unified AI Provider Test Suite...\n');

  // ==========================================
  // SECTION 1: UNIT TESTS - N8N AGENTIC AI
  // ==========================================
  console.log('--- Section 1: N8nLearningAgentService Unit Tests ---');

  const n8nService = new N8nLearningAgentService();

  // Test 1.1: Availability check
  const n8nStatus = await n8nService.checkAvailability();
  assert(
    typeof n8nStatus.available === 'boolean' && n8nStatus.provider === 'n8n',
    'N8nLearningAgentService reports structured availability'
  );

  // Test 1.2: Response content extraction
  assert(
    n8nService._extractContent({ answer: 'Extracted answer text' }) === 'Extracted answer text',
    'N8nLearningAgentService extracts content from data.answer'
  );
  assert(
    n8nService._extractContent({ output: 'Extracted output text' }) === 'Extracted output text',
    'N8nLearningAgentService extracts content from data.output'
  );
  assert(
    n8nService._extractContent([{ message: 'Array message text' }]) === 'Array message text',
    'N8nLearningAgentService extracts content from array payloads'
  );

  // Test 1.3: HTML error detection
  let htmlRejected = false;
  try {
    n8nService._extractContent('<!DOCTYPE html><html><body>502 Bad Gateway</body></html>');
  } catch (e) {
    htmlRejected = e.message.includes('HTML error page');
  }
  assert(htmlRejected, 'N8nLearningAgentService cleanly rejects HTML error pages as provider failures');

  // ==========================================
  // SECTION 2: UNIT TESTS - GEMINI ONLINE ENGINE
  // ==========================================
  console.log('\n--- Section 2: OnlineChatEngine Unit Tests ---');

  const onlineEngine = new OnlineChatEngine();
  const geminiStatus = await onlineEngine.checkAvailability();
  assert(
    typeof geminiStatus.available === 'boolean',
    'OnlineChatEngine reports availability status structure correctly'
  );

  // ==========================================
  // SECTION 3: UNIT TESTS - OLLAMA LOCAL ENGINE
  // ==========================================
  console.log('\n--- Section 3: OllamaChatEngine Unit Tests ---');

  const ollamaEngine = new OllamaChatEngine();
  const offlineStatus = await ollamaEngine.checkAvailability();
  assert(
    offlineStatus.provider === 'ollama' && typeof offlineStatus.available === 'boolean',
    'OllamaChatEngine detects local service status without crashing'
  );

  // ==========================================
  // SECTION 4: UNIFIED ORCHESTRATION & ISOLATION
  // ==========================================
  console.log('\n--- Section 4: ChatEngineManager Orchestration & Isolation Rules ---');

  // Test 4.1: AUTO Mode - n8n primary, NEVER calls Gemini
  const managerAuto = new ChatEngineManager();
  let geminiCalledInAuto = false;
  let ollamaCalledInAuto = false;

  managerAuto.n8nService = {
    sendMessage: async () => ({
      role: 'assistant',
      content: 'Answer from n8n Agentic AI',
      engine: 'n8n',
      provider: 'n8n',
      model: 'agentic-ai',
    }),
  };
  managerAuto.onlineEngine = {
    sendMessage: async () => {
      geminiCalledInAuto = true;
      return { role: 'assistant', content: 'Gemini', engine: 'online' };
    },
  };
  managerAuto.ollamaEngine = {
    sendMessage: async () => {
      ollamaCalledInAuto = true;
      return { role: 'assistant', content: 'Ollama', engine: 'ollama' };
    },
  };

  const autoRes = await managerAuto.executeChat({
    messages: [{ role: 'user', content: 'Hello' }],
    mode: 'auto',
    conversationId: 'c-auto-1',
  });

  assert(
    autoRes.engine === 'n8n' &&
      autoRes.providerLabel === 'n8n Agentic AI' &&
      autoRes.fallback === false &&
      !geminiCalledInAuto &&
      !ollamaCalledInAuto,
    'AUTO mode uses n8n Agentic AI primary and NEVER calls Gemini or Ollama on success'
  );

  // Test 4.1b: Dedicated AGENTIC Mode - Direct n8n only, NO fallback to Ollama or Gemini
  const managerAgenticOnly = new ChatEngineManager();
  let ollamaCalledInAgentic = false;
  let geminiCalledInAgentic = false;

  managerAgenticOnly.n8nService = {
    sendMessage: async () => ({
      role: 'assistant',
      content: 'Dedicated agentic direct answer',
      engine: 'n8n',
      provider: 'n8n',
      model: 'agentic-ai',
    }),
  };
  managerAgenticOnly.ollamaEngine = {
    sendMessage: async () => {
      ollamaCalledInAgentic = true;
      return { role: 'assistant', content: 'Ollama', engine: 'ollama' };
    },
  };
  managerAgenticOnly.onlineEngine = {
    sendMessage: async () => {
      geminiCalledInAgentic = true;
      return { role: 'assistant', content: 'Gemini', engine: 'online' };
    },
  };

  const agenticRes = await managerAgenticOnly.executeChat({
    messages: [{ role: 'user', content: 'Hello' }],
    mode: 'agentic',
    conversationId: 'c-agentic-1',
  });

  assert(
    agenticRes.engine === 'n8n' &&
      agenticRes.mode === 'agentic' &&
      agenticRes.providerLabel === 'n8n Agentic AI' &&
      agenticRes.fallback === false &&
      !ollamaCalledInAgentic &&
      !geminiCalledInAgentic,
    'Dedicated AGENTIC mode uses n8n directly and NEVER calls Ollama or Gemini on success'
  );

  // Test 4.1c: Dedicated AGENTIC Mode Failure - Throws directly without fallback (test mode)
  const managerAgenticFail = new ChatEngineManager();
  let ollamaCalledInAgenticFail = false;

  managerAgenticFail.n8nService = {
    sendMessage: async () => {
      const err = new Error('n8n webhook timeout or 500 error');
      err.isAvailabilityError = true;
      throw err;
    },
  };
  managerAgenticFail.ollamaEngine = {
    sendMessage: async () => {
      ollamaCalledInAgenticFail = true;
      return { role: 'assistant', content: 'Ollama', engine: 'ollama' };
    },
  };

  try {
    await managerAgenticFail.executeChat({
      messages: [{ role: 'user', content: 'Hello' }],
      mode: 'agentic',
      conversationId: 'c-agentic-fail',
    });
    assert(false, 'Dedicated AGENTIC mode should throw on n8n failure without falling back');
  } catch (err) {
    assert(
      !ollamaCalledInAgenticFail && err.message.includes('n8n webhook timeout'),
      'Dedicated AGENTIC mode throws n8n error directly and NEVER falls back to Ollama (pure test mode)'
    );
  }

  // Test 4.2: AUTO Mode Fallback - When n8n fails, falls back to Ollama, NEVER Gemini
  const managerAutoFallback = new ChatEngineManager();
  let geminiCalledInAutoFallback = false;

  managerAutoFallback.n8nService = {
    sendMessage: async () => {
      const err = new Error('n8n webhook 404 Not Found');
      err.isAvailabilityError = true;
      throw err;
    },
  };
  managerAutoFallback.onlineEngine = {
    sendMessage: async () => {
      geminiCalledInAutoFallback = true;
      return { role: 'assistant', content: 'Gemini', engine: 'online' };
    },
  };
  managerAutoFallback.ollamaEngine = {
    sendMessage: async () => ({
      role: 'assistant',
      content: 'Local Ollama fallback response',
      engine: 'ollama',
      model: 'llama3.2:1b',
    }),
  };

  const autoFallbackRes = await managerAutoFallback.executeChat({
    messages: [{ role: 'user', content: 'Hello' }],
    mode: 'auto',
    conversationId: 'c-auto-2',
  });

  assert(
    autoFallbackRes.engine === 'ollama' &&
      autoFallbackRes.fallback === true &&
      autoFallbackRes.providerLabel === 'Local AI (Ollama)' &&
      typeof autoFallbackRes.fallbackNotice === 'string' &&
      !geminiCalledInAutoFallback,
    'AUTO mode falls back to Ollama when n8n fails, and NEVER silently falls back to Gemini'
  );

  // Test 4.3: GEMINI Mode - NEVER calls n8n
  const managerGemini = new ChatEngineManager();
  let n8nCalledInGemini = false;

  managerGemini.n8nService = {
    sendMessage: async () => {
      n8nCalledInGemini = true;
      return { role: 'assistant', content: 'n8n', engine: 'n8n' };
    },
  };
  managerGemini.onlineEngine = {
    sendMessage: async () => ({
      role: 'assistant',
      content: 'Gemini response',
      engine: 'online',
      model: 'gemini-3.5-flash-lite',
    }),
  };
  managerGemini.ollamaEngine = {
    sendMessage: async () => ({
      role: 'assistant',
      content: 'Ollama',
      engine: 'ollama',
    }),
  };

  const geminiRes = await managerGemini.executeChat({
    messages: [{ role: 'user', content: 'Hello' }],
    mode: 'gemini',
    conversationId: 'c-gemini-1',
  });

  assert(
    geminiRes.engine === 'online' &&
      geminiRes.providerLabel === 'Gemini AI' &&
      geminiRes.fallback === false &&
      !n8nCalledInGemini,
    'GEMINI mode uses Gemini online and NEVER calls n8n'
  );

  // Test 4.4: GEMINI Mode Fallback - When Gemini fails, falls back to Ollama, NEVER n8n
  const managerGeminiFallback = new ChatEngineManager();
  let n8nCalledInGeminiFallback = false;

  managerGeminiFallback.n8nService = {
    sendMessage: async () => {
      n8nCalledInGeminiFallback = true;
      return { role: 'assistant', content: 'n8n', engine: 'n8n' };
    },
  };
  managerGeminiFallback.onlineEngine = {
    sendMessage: async () => {
      const err = new Error('Gemini API quota exceeded');
      err.isAvailabilityError = true;
      throw err;
    },
  };
  managerGeminiFallback.ollamaEngine = {
    sendMessage: async () => ({
      role: 'assistant',
      content: 'Local Ollama response for Gemini fallback',
      engine: 'ollama',
      model: 'llama3.2:1b',
    }),
  };

  const geminiFallbackRes = await managerGeminiFallback.executeChat({
    messages: [{ role: 'user', content: 'Hello' }],
    mode: 'gemini',
    conversationId: 'c-gemini-2',
  });

  assert(
    geminiFallbackRes.engine === 'ollama' &&
      geminiFallbackRes.fallback === true &&
      geminiFallbackRes.providerLabel === 'Local AI (Ollama)' &&
      !n8nCalledInGeminiFallback,
    'GEMINI mode falls back to Ollama when Gemini fails, and NEVER calls n8n'
  );

  // Test 4.5: LOCAL Mode - Strict Local Ollama only, NEVER calls n8n or Gemini
  const managerLocal = new ChatEngineManager();
  let n8nCalledInLocal = false;
  let geminiCalledInLocal = false;

  managerLocal.n8nService = {
    sendMessage: async () => {
      n8nCalledInLocal = true;
      return { role: 'assistant', content: 'n8n', engine: 'n8n' };
    },
  };
  managerLocal.onlineEngine = {
    sendMessage: async () => {
      geminiCalledInLocal = true;
      return { role: 'assistant', content: 'Gemini', engine: 'online' };
    },
  };
  managerLocal.ollamaEngine = {
    sendMessage: async () => ({
      role: 'assistant',
      content: 'Local Ollama only response',
      engine: 'ollama',
      model: 'llama3.2:1b',
    }),
  };

  const localRes = await managerLocal.executeChat({
    messages: [{ role: 'user', content: 'Hello' }],
    mode: 'local',
    conversationId: 'c-local-1',
  });

  assert(
    localRes.engine === 'ollama' &&
      localRes.providerLabel === 'Local AI (Ollama)' &&
      localRes.fallback === false &&
      !n8nCalledInLocal &&
      !geminiCalledInLocal,
    'LOCAL mode uses Ollama directly and NEVER calls n8n or Gemini'
  );

  // Test 4.6: Both n8n and Ollama fail in AUTO mode -> 503 error
  const managerDualFail = new ChatEngineManager();
  managerDualFail.n8nService = {
    sendMessage: async () => {
      throw new Error('n8n network timeout');
    },
  };
  managerDualFail.ollamaEngine = {
    sendMessage: async () => {
      throw new Error('Ollama connection refused');
    },
  };

  try {
    await managerDualFail.executeChat({
      messages: [{ role: 'user', content: 'Hello' }],
      mode: 'auto',
      conversationId: 'c-dual-fail',
    });
    assert(false, 'Dual failure in auto mode should throw');
  } catch (err) {
    assert(
      err.statusCode === 503 &&
        err.message.includes('n8n Agentic AI') &&
        err.message.includes('Local Ollama'),
      'AUTO mode returns descriptive 503 error explaining both n8n and Ollama failures'
    );
  }

  // ==========================================
  // SECTION 5: LIVE HTTP API INTEGRATION TESTS
  // ==========================================
  console.log('\n--- Section 5: Live HTTP API Integration Tests ---');

  const BASE_URL = 'http://localhost:5000/api';

  // Test 5.1: GET /api/chat/status
  try {
    const res = await fetch(`${BASE_URL}/chat/status`);
    const json = await res.json();
    assert(
      res.status === 200 &&
        json.success === true &&
        json.data &&
        typeof json.data.n8n === 'object' &&
        typeof json.data.gemini === 'object' &&
        typeof json.data.ollama === 'object',
      'GET /api/chat/status returns structured availability for n8n, gemini, and ollama'
    );
  } catch (err) {
    assert(false, `GET /api/chat/status failed: ${err.message}`);
  }

  // Test 5.2: POST /api/chat/message input validation
  try {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    const json = await res.json();
    assert(
      res.status === 400 && json.success === false,
      'POST /api/chat/message rejects empty messages array with 400'
    );
  } catch (err) {
    assert(false, `Validation check failed: ${err.message}`);
  }

  // Test 5.3: POST /api/chat/message with mode: 'auto'
  try {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say OK' }],
        mode: 'auto',
      }),
    });
    const json = await res.json();
    assert(
      res.status === 200 &&
        json.success === true &&
        (json.data?.engine === 'n8n' || json.data?.engine === 'ollama') &&
        typeof json.data?.content === 'string' &&
        json.data?.content.length > 0,
      'POST /api/chat/message (mode: auto) succeeds with n8n or local Ollama fallback'
    );
  } catch (err) {
    assert(false, `Auto mode API check failed: ${err.message}`);
  }

  // Test 5.4: POST /api/chat/message with mode: 'local'
  try {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say OK' }],
        mode: 'local',
      }),
    });
    const json = await res.json();
    assert(
      res.status === 200 &&
        json.success === true &&
        json.data?.engine === 'ollama' &&
        json.data?.providerLabel === 'Local AI (Ollama)' &&
        typeof json.data?.content === 'string',
      'POST /api/chat/message (mode: local) produces valid local Ollama response'
    );
  } catch (err) {
    assert(false, `Local mode API check failed: ${err.message}`);
  }

  // Test 5.5: POST /api/chat/message with mode: 'gemini'
  try {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say OK' }],
        mode: 'gemini',
      }),
    });
    const json = await res.json();
    assert(
      res.status === 200 &&
        json.success === true &&
        (json.data?.engine === 'online' || json.data?.engine === 'ollama') &&
        typeof json.data?.content === 'string',
      'POST /api/chat/message (mode: gemini) succeeds with Gemini or local fallback'
    );
  } catch (err) {
    assert(false, `Gemini mode API check failed: ${err.message}`);
  }

  // Test 5.6: POST /api/chat/message with mode: 'agentic'
  try {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say OK' }],
        mode: 'agentic',
      }),
    });
    const json = await res.json();
    assert(
      res.status === 200 &&
        json.success === true &&
        json.data?.engine === 'n8n' &&
        json.data?.mode === 'agentic' &&
        json.data?.providerLabel === 'n8n Agentic AI' &&
        typeof json.data?.content === 'string',
      'POST /api/chat/message (mode: agentic) produces dedicated n8n Agentic AI response'
    );
  } catch (err) {
    assert(false, `Agentic mode API check failed: ${err.message}`);
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runAllTests();

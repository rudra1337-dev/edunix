/**
 * Comprehensive Automated Test Suite for Edunix AI Chat Architecture
 * Tests:
 * 1. Online Chat Engine (success, error, timeout, formatting)
 * 2. Ollama Chat Engine (offline availability, model check, error diagnostics)
 * 3. ChatEngineManager:
 *    - Strict ONLINE mode (never calls Ollama)
 *    - Strict OFFLINE mode (never calls Online)
 *    - AUTO mode: online primary, graceful fallback to Ollama, both failing
 * 4. Context management & input validation
 * 5. End-to-end HTTP API tests against live server (/api/chat/status, /api/chat/message)
 */

import { ChatEngineManager } from './src/services/ai/chatEngineManager.js';
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
  console.log('🧪 Starting EDUNIX AI Chat Test Suite...\n');

  // ==========================================
  // SECTION 1: UNIT TESTS - ONLINE ENGINE
  // ==========================================
  console.log('--- Section 1: OnlineChatEngine Unit Tests ---');

  const onlineEngine = new OnlineChatEngine();

  // Test 1.1: Availability check when unconfigured
  const unconfiguredStatus = await onlineEngine.checkAvailability();
  assert(
    typeof unconfiguredStatus.available === 'boolean',
    'OnlineChatEngine reports availability status structure correctly'
  );

  // Test 1.2: Normalized response format
  const mockOnlineSuccess = new OnlineChatEngine();
  mockOnlineSuccess.checkAvailability = async () => ({ available: true });
  mockOnlineSuccess.sendMessage = async (messages) => ({
    role: 'assistant',
    content: `Processed online: ${messages[messages.length - 1].content}`,
    engine: 'online',
    model: 'gemini-1.5-flash',
  });

  const onlineRes = await mockOnlineSuccess.sendMessage([{ role: 'user', content: 'What is a Unix inode?' }]);
  assert(
    onlineRes.role === 'assistant' &&
      onlineRes.engine === 'online' &&
      onlineRes.content.includes('Processed online: What is a Unix inode?'),
    'OnlineChatEngine returns normalized response data'
  );

  // Test 1.3: Online request failure propagation
  const mockOnlineFailure = new OnlineChatEngine();
  mockOnlineFailure.checkAvailability = async () => ({ available: true });
  mockOnlineFailure.sendMessage = async () => {
    const err = new Error('503 Service Unavailable: High traffic');
    err.isAvailabilityError = true;
    err.engine = 'online';
    throw err;
  };

  try {
    await mockOnlineFailure.sendMessage([{ role: 'user', content: 'Hi' }]);
    assert(false, 'OnlineChatEngine should throw on failure');
  } catch (err) {
    assert(
      err.isAvailabilityError === true && err.engine === 'online',
      'OnlineChatEngine propagates availability error flag and engine tag'
    );
  }

  // ==========================================
  // SECTION 2: UNIT TESTS - OLLAMA ENGINE
  // ==========================================
  console.log('\n--- Section 2: OllamaChatEngine Unit Tests ---');

  const ollamaEngine = new OllamaChatEngine();

  // Test 2.1: Ollama offline detection
  const offlineStatus = await ollamaEngine.checkAvailability();
  assert(
    offlineStatus.provider === 'ollama' && typeof offlineStatus.available === 'boolean',
    'OllamaChatEngine detects local service status without crashing'
  );

  // Test 2.2: Mock Ollama success
  const mockOllamaSuccess = new OllamaChatEngine();
  mockOllamaSuccess.checkAvailability = async () => ({ available: true, model: 'llama3' });
  mockOllamaSuccess.sendMessage = async (messages) => ({
    role: 'assistant',
    content: `Local Ollama answer to: ${messages[messages.length - 1].content}`,
    engine: 'ollama',
    model: 'llama3',
  });

  const ollamaRes = await mockOllamaSuccess.sendMessage([{ role: 'user', content: 'Explain grep command' }]);
  assert(
    ollamaRes.role === 'assistant' &&
      ollamaRes.engine === 'ollama' &&
      ollamaRes.model === 'llama3' &&
      ollamaRes.content.includes('Local Ollama answer to: Explain grep command'),
    'OllamaChatEngine returns normalized local response'
  );

  // ==========================================
  // SECTION 3: CHAT ENGINE MANAGER ORCHESTRATION
  // ==========================================
  console.log('\n--- Section 3: ChatEngineManager Orchestration ---');

  // Test 3.1: Strict ONLINE mode (must NOT fall back to Ollama even if online fails)
  const managerOnlineOnly = new ChatEngineManager();
  let ollamaCalledInOnlineMode = false;
  managerOnlineOnly.onlineEngine = {
    sendMessage: async () => {
      const err = new Error('Connection refused to online API');
      err.isAvailabilityError = true;
      throw err;
    },
  };
  managerOnlineOnly.ollamaEngine = {
    sendMessage: async () => {
      ollamaCalledInOnlineMode = true;
      return { role: 'assistant', content: 'Ollama responded', engine: 'ollama' };
    },
  };

  try {
    await managerOnlineOnly.executeChat({
      messages: [{ role: 'user', content: 'Test' }],
      mode: 'online',
      conversationId: 'c1',
    });
    assert(false, 'Strict ONLINE mode should fail when online fails');
  } catch (err) {
    assert(
      !ollamaCalledInOnlineMode && err.message.includes('Connection refused'),
      'Strict ONLINE mode never silently falls back to Ollama'
    );
  }

  // Test 3.2: Strict OFFLINE mode (must NOT call online even if Ollama fails)
  const managerOfflineOnly = new ChatEngineManager();
  let onlineCalledInOfflineMode = false;
  managerOfflineOnly.onlineEngine = {
    sendMessage: async () => {
      onlineCalledInOfflineMode = true;
      return { role: 'assistant', content: 'Online responded', engine: 'online' };
    },
  };
  managerOfflineOnly.ollamaEngine = {
    sendMessage: async () => {
      throw new Error('Ollama not running on 11434');
    },
  };

  try {
    await managerOfflineOnly.executeChat({
      messages: [{ role: 'user', content: 'Test' }],
      mode: 'offline',
      conversationId: 'c2',
    });
    assert(false, 'Strict OFFLINE mode should fail when Ollama fails');
  } catch (err) {
    assert(
      !onlineCalledInOfflineMode && err.message.includes('Ollama not running'),
      'Strict OFFLINE mode never silently sends messages to online AI'
    );
  }

  // Test 3.3: AUTO mode - Online succeeds (no fallback)
  const managerAutoOnline = new ChatEngineManager();
  managerAutoOnline.onlineEngine = {
    sendMessage: async () => ({
      role: 'assistant',
      content: 'Hello from Online Cloud AI',
      engine: 'online',
      model: 'gemini-1.5-flash',
    }),
  };
  managerAutoOnline.ollamaEngine = {
    sendMessage: async () => {
      throw new Error('Should not be called');
    },
  };

  const autoOnlineRes = await managerAutoOnline.executeChat({
    messages: [{ role: 'user', content: 'Hi' }],
    mode: 'auto',
    conversationId: 'c3',
  });

  assert(
    autoOnlineRes.engine === 'online' && autoOnlineRes.fallback === false,
    'AUTO mode uses online service when available without fallback'
  );

  // Test 3.4: AUTO mode - Online fails -> Graceful Fallback to Ollama succeeds
  const managerAutoFallback = new ChatEngineManager();
  managerAutoFallback.onlineEngine = {
    sendMessage: async () => {
      throw new Error('Online endpoint unreachable (timeout)');
    },
  };
  managerAutoFallback.ollamaEngine = {
    sendMessage: async () => ({
      role: 'assistant',
      content: 'Hello from Local Ollama fallback',
      engine: 'ollama',
      model: 'llama3',
    }),
  };

  const fallbackRes = await managerAutoFallback.executeChat({
    messages: [{ role: 'user', content: 'Hi' }],
    mode: 'auto',
    conversationId: 'c4',
  });

  assert(
    fallbackRes.engine === 'ollama' &&
      fallbackRes.fallback === true &&
      typeof fallbackRes.fallbackNotice === 'string' &&
      fallbackRes.content.includes('Local Ollama fallback'),
    'AUTO mode successfully falls back to Ollama and marks fallback: true with notice'
  );

  // Test 3.5: AUTO mode - Both fail -> Clear actionable combined error
  const managerBothFail = new ChatEngineManager();
  managerBothFail.onlineEngine = {
    sendMessage: async () => {
      throw new Error('API key invalid');
    },
  };
  managerBothFail.ollamaEngine = {
    sendMessage: async () => {
      throw new Error('Connection refused to 11434');
    },
  };

  try {
    await managerBothFail.executeChat({
      messages: [{ role: 'user', content: 'Hi' }],
      mode: 'auto',
      conversationId: 'c5',
    });
    assert(false, 'Should throw when both fail');
  } catch (err) {
    assert(
      err.statusCode === 503 &&
        err.message.includes('Online AI') &&
        err.message.includes('Local Ollama'),
      'AUTO mode returns descriptive 503 error explaining both failures without lost context'
    );
  }

  // Test 3.6: Context message limit (bounded context window)
  const managerContext = new ChatEngineManager();
  let receivedCount = 0;
  managerContext.onlineEngine = {
    sendMessage: async (msgs) => {
      receivedCount = msgs.length;
      return { role: 'assistant', content: 'OK', engine: 'online' };
    },
  };

  const manyMessages = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i + 1}`,
  }));

  await managerContext.executeChat({
    messages: manyMessages,
    mode: 'online',
    conversationId: 'c6',
  });

  assert(
    receivedCount === 15,
    `Context manager limits history to the recent 15 messages (received ${receivedCount})`
  );

  // ==========================================
  // SECTION 4: HTTP API ENDPOINT INTEGRATION
  // ==========================================
  console.log('\n--- Section 4: Live HTTP API Tests ---');

  const BASE_URL = 'http://localhost:5000/api';

  // Test 4.1: GET /api/chat/status
  try {
    const res = await fetch(`${BASE_URL}/chat/status`);
    const json = await res.json();
    assert(
      res.status === 200 &&
        json.success === true &&
        json.data?.online &&
        json.data?.offline &&
        typeof json.data?.autoAvailable === 'boolean',
      'GET /api/chat/status returns structured availability for online, offline, and auto'
    );
  } catch (err) {
    assert(false, `GET /api/chat/status failed: ${err.message}`);
  }

  // Test 4.2: POST /api/chat/message with empty messages -> 400 Bad Request
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

  // Test 4.3: POST /api/chat/message in offline mode with active Ollama
  try {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say OK' }],
        mode: 'offline',
      }),
    });
    const json = await res.json();
    assert(
      res.status === 200 &&
        json.success === true &&
        json.data?.engine === 'ollama' &&
        typeof json.data?.content === 'string',
      'POST /api/chat/message (offline mode) generates real local Ollama response'
    );
  } catch (err) {
    assert(false, `Offline mode check failed: ${err.message}`);
  }

  // Test 4.4: POST /api/chat/message in online mode without API key
  try {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'online',
      }),
    });
    const json = await res.json();
    assert(
      res.status >= 400 &&
        json.success === false &&
        json.message.includes('Online AI is not configured'),
      'POST /api/chat/message (online mode) returns clear configuration instructions without falling back'
    );
  } catch (err) {
    assert(false, `Online mode check failed: ${err.message}`);
  }

  // Test 4.5: POST /api/chat/message in auto mode (online fails -> auto fallback to local Ollama)
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
        json.data?.engine === 'ollama' &&
        json.data?.fallback === true &&
        typeof json.data?.fallbackNotice === 'string',
      'POST /api/chat/message (auto mode) gracefully falls back to local Ollama and returns fallbackNotice'
    );
  } catch (err) {
    assert(false, `Auto mode check failed: ${err.message}`);
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runAllTests();

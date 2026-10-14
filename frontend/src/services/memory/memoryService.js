import memoryRepository from '../storage/memoryRepository.js';
import syncQueueRepository from '../storage/syncQueueRepository.js';
import learningEventRepository from '../storage/learningEventRepository.js';
import conversationRepository from '../storage/conversationRepository.js';
import { evaluateMemoryDecision, DECISIONS, areValuesSemanticallyEqual } from './memoryComparison.js';

const generateMemId = () => `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
const generateEvtId = () => `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

export class MemoryService {
  constructor() {
    this.memoryRepo = memoryRepository;
    this.syncRepo = syncQueueRepository;
    this.eventRepo = learningEventRepository;
    this.convRepo = conversationRepository;
  }

  /**
   * Read active memories for a user
   */
  async readMemories(userId, filters = {}) {
    return this.memoryRepo.getMemories(userId, filters);
  }

  /**
   * Process a candidate memory record through the change-driven decision flow.
   * STRICT GUARANTEE: Does NOT write to DB or syncQueue if decision is IGNORE!
   *
   * @param {string} userId
   * @param {Object} candidate - { key, value, type, source, confidence }
   * @returns {Promise<{ action: string, memory: Object|null, reason: string }>}
   */
  async processCandidateMemory(userId, candidate) {
    if (!userId) {
      throw new Error('UserId is required to process candidate memory.');
    }

    // 1. Retrieve existing memories for comparison
    const existingMemories = await this.memoryRepo.getMemories(userId, { status: 'active' });

    // 2. Evaluate decision
    const { decision, targetMemory, reason } = evaluateMemoryDecision(candidate, existingMemories);

    // 3. Apply Decision
    switch (decision) {
      case DECISIONS.IGNORE:
        // No change, no writes, no sync operations!
        return { action: 'ignored', memory: targetMemory, reason };

      case DECISIONS.CREATE: {
        const newMemory = {
          id: generateMemId(),
          userId,
          type: candidate.type || 'learning_preference',
          key: candidate.key,
          value: candidate.value,
          source: candidate.source || 'observed',
          confidence: candidate.confidence || 0.8,
          status: 'active',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending',
        };

        // Persist to local IndexedDB
        await this.memoryRepo.saveMemory(newMemory);

        // Enqueue synchronization ONLY for the new record
        await this.syncRepo.enqueue({
          userId,
          entityType: 'learnerMemory',
          entityId: newMemory.id,
          operation: 'upsert',
          payload: newMemory,
        });

        // Record learning event if it represents a meaningful observation
        if (newMemory.type === 'knowledge_observation' || newMemory.type === 'learning_goal') {
          await this.eventRepo.recordEvent({
            eventId: generateEvtId(),
            userId,
            type: 'topic_explored',
            topic: newMemory.key,
            payload: { value: newMemory.value, source: newMemory.source },
          });
        }

        return { action: 'created', memory: newMemory, reason };
      }

      case DECISIONS.UPDATE: {
        const updatedMemory = {
          ...targetMemory,
          value: candidate.value,
          source: candidate.source || targetMemory.source,
          confidence: candidate.confidence || targetMemory.confidence,
          version: (targetMemory.version || 1) + 1,
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending',
        };

        await this.memoryRepo.saveMemory(updatedMemory);

        // Enqueue synchronization ONLY for this updated record
        await this.syncRepo.enqueue({
          userId,
          entityType: 'learnerMemory',
          entityId: updatedMemory.id,
          operation: 'upsert',
          payload: updatedMemory,
        });

        return { action: 'updated', memory: updatedMemory, reason };
      }

      case DECISIONS.SUPERSEDE: {
        // Mark previous memory as superseded
        const superseded = {
          ...targetMemory,
          status: 'superseded',
          version: (targetMemory.version || 1) + 1,
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending',
        };
        await this.memoryRepo.saveMemory(superseded);

        // Create new active replacement
        const newMemory = {
          id: generateMemId(),
          userId,
          type: candidate.type || targetMemory.type,
          key: candidate.key,
          value: candidate.value,
          source: candidate.source || 'observed',
          confidence: candidate.confidence || 0.85,
          status: 'active',
          supersedesId: targetMemory.id,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending',
        };
        await this.memoryRepo.saveMemory(newMemory);

        // Enqueue sync for both
        await this.syncRepo.enqueue({
          userId,
          entityType: 'learnerMemory',
          entityId: superseded.id,
          operation: 'upsert',
          payload: superseded,
        });
        await this.syncRepo.enqueue({
          userId,
          entityType: 'learnerMemory',
          entityId: newMemory.id,
          operation: 'upsert',
          payload: newMemory,
        });

        return { action: 'superseded', memory: newMemory, previousMemory: superseded, reason };
      }

      default:
        return { action: 'ignored', memory: null, reason: 'Unhandled decision' };
    }
  }

  /**
   * Explicitly delete a memory record (tombstone)
   */
  async deleteMemory(userId, memoryId) {
    const tombstone = await this.memoryRepo.deleteMemory(memoryId);
    if (tombstone) {
      // Enqueue sync deletion to propagate to server
      await this.syncRepo.enqueue({
        userId,
        entityType: 'learnerMemory',
        entityId: memoryId,
        operation: 'delete',
        payload: { id: memoryId, status: 'deleted', version: tombstone.version },
      });
      return true;
    }
    return false;
  }

  /**
   * Pattern-based heuristic candidate extractor from user and assistant interaction.
   * Extracts explicit preferences, goals, and feedback without requiring extra LLM calls.
   */
  extractCandidates(userText, assistantText = '') {
    const candidates = [];
    if (!userText || typeof userText !== 'string') return candidates;

    const lower = userText.toLowerCase().trim();

    // 1. Language Preference Patterns
    const langPatterns = [
      { regex: /(?:explain|teach|speak|talk|write)\s+(?:in|using)\s+(odia|oriya)/i, lang: 'or', label: 'Odia' },
      { regex: /(?:explain|teach|speak|talk|write)\s+(?:in|using)\s+(hindi)/i, lang: 'hi', label: 'Hindi' },
      { regex: /(?:explain|teach|speak|talk|write)\s+(?:in|using)\s+(english)/i, lang: 'en', label: 'English' },
      { regex: /(?:explain|teach|speak|talk|write)\s+(?:in|using)\s+(bengali|bangla)/i, lang: 'bn', label: 'Bengali' },
      { regex: /(?:explain|teach|speak|talk|write)\s+(?:in|using)\s+(tamil)/i, lang: 'ta', label: 'Tamil' },
      { regex: /(?:explain|teach|speak|talk|write)\s+(?:in|using)\s+(telugu)/i, lang: 'te', label: 'Telugu' },
    ];

    for (const p of langPatterns) {
      if (p.regex.test(lower) || lower === p.label.toLowerCase()) {
        candidates.push({
          key: 'preferred_language',
          value: p.label,
          type: 'learning_preference',
          source: 'explicit',
          confidence: 1.0,
        });
        break;
      }
    }

    // 2. Explanation Style Patterns
    if (lower.includes('simple example') || lower.includes('keep it simple') || lower.includes('beginner friendly')) {
      candidates.push({
        key: 'explanation_style',
        value: 'Simple explanations with beginner-friendly practical examples',
        type: 'learning_preference',
        source: 'explicit',
        confidence: 0.9,
      });
    } else if (lower.includes('in-depth') || lower.includes('technical deep dive') || lower.includes('detailed')) {
      candidates.push({
        key: 'explanation_style',
        value: 'Detailed technical explanations with in-depth architecture',
        type: 'learning_preference',
        source: 'explicit',
        confidence: 0.9,
      });
    }

    // 3. Learning Goal Patterns
    const goalMatch = lower.match(/(?:i want to learn|my goal is to master|teach me about|i want to master)\s+([^.!?]+)/i);
    if (goalMatch && goalMatch[1]) {
      const topic = goalMatch[1].trim();
      if (topic.length > 2 && topic.length < 50) {
        candidates.push({
          key: `goal_${topic.replace(/\s+/g, '_')}`,
          value: `Master ${topic}`,
          type: 'learning_goal',
          source: 'explicit',
          confidence: 0.95,
        });
      }
    }

    // 4. Difficulty / Struggle Observations
    const difficultyMatch = lower.match(/(?:i don't understand|i am struggling with|i am confused about|hard to understand)\s+([^.!?]+)/i);
    if (difficultyMatch && difficultyMatch[1]) {
      const topic = difficultyMatch[1].trim();
      if (topic.length > 2 && topic.length < 50) {
        candidates.push({
          key: `difficulty_${topic.replace(/\s+/g, '_')}`,
          value: `Finding ${topic} challenging`,
          type: 'difficulty_observation',
          source: 'observed',
          confidence: 0.8,
        });
      }
    }

    // 5. Explicit ChatGPT-style Memory Directives ("remember that...", "save to memory...", "keep in mind that...")
    const explicitMemoryMatch = lower.match(
      /(?:remember\s+(?:that\s+)?|save\s+(?:this\s+)?(?:in|to)\s+memory[:\s]+|keep\s+in\s+mind\s+(?:that\s+)?|note\s+(?:that\s+)?|please\s+remember\s+(?:that\s+)?)([^.!?\n]+)/i
    );
    if (explicitMemoryMatch && explicitMemoryMatch[1]) {
      const fact = explicitMemoryMatch[1].trim();
      if (fact.length > 2 && fact.length < 150) {
        const cleanSlug = fact
          .replace(/^(?:i\s+am|i\s+use|i\s+prefer|i\s+work\s+as|my\s+name\s+is|my\s+)\s*/i, '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .trim()
          .split(/\s+/)
          .slice(0, 3)
          .join('_');
        const key = cleanSlug.length >= 2 ? `user_${cleanSlug}` : `user_fact_${Date.now()}`;

        candidates.push({
          key,
          value: fact.charAt(0).toUpperCase() + fact.slice(1),
          type: 'learning_preference',
          source: 'explicit',
          confidence: 1.0,
        });
      }
    }

    // 6. Explicit Preferences ("I prefer...")
    const preferMatch = lower.match(/(?:i\s+prefer|my\s+preference\s+is)\s+([^.!?\n]+)/i);
    if (
      preferMatch &&
      preferMatch[1] &&
      !candidates.some((c) => c.key === 'preferred_language' || c.key === 'explanation_style')
    ) {
      const prefText = preferMatch[1].trim();
      if (prefText.length > 2 && prefText.length < 80) {
        candidates.push({
          key: `preference_${prefText.split(/\s+/).slice(0, 2).join('_').toLowerCase().replace(/[^a-z0-9_]/g, '')}`,
          value: `Prefers ${prefText}`,
          type: 'learning_preference',
          source: 'explicit',
          confidence: 0.95,
        });
      }
    }

    return candidates;
  }

  /**
   * Conditionally update conversation summary.
   * Only triggers when message count delta >= 4 since last summary,
   * avoiding expensive LLM summarization on every single message.
   */
  async evaluateConversationSummary(conversationId, messages) {
    if (!conversationId || !Array.isArray(messages) || messages.length < 3) {
      return null;
    }

    const conv = await this.convRepo.getConversation(conversationId);
    if (!conv) return null;

    const lastCount = conv.summaryMessageCount || 0;
    if (messages.length - lastCount < 4 && conv.summary) {
      // Threshold not met, reuse existing summary without rewriting
      return conv.summary;
    }

    // Derive concise summary based on topics and recent messages
    const userTopics = messages
      .filter((m) => m.role === 'user')
      .slice(-4)
      .map((m) => m.content.substring(0, 40));

    const derivedSummary = `Recent topics: ${userTopics.join('; ')}. Focus: Technical Linux/Unix instruction.`;

    if (!areValuesSemanticallyEqual(conv.summary, derivedSummary)) {
      conv.summary = derivedSummary;
      conv.summaryMessageCount = messages.length;
      await this.convRepo.saveConversation(conv);

      await this.syncRepo.enqueue({
        userId: conv.userId || 'local-user',
        entityType: 'conversation',
        entityId: conv.id,
        operation: 'upsert',
        payload: { id: conv.id, title: conv.title, summary: conv.summary },
      });
    }

    return conv.summary;
  }
}

export default new MemoryService();

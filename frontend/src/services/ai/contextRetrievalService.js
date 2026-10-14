import memoryRepository from '../storage/memoryRepository.js';
import learningPlanRepository from '../storage/learningPlanRepository.js';
import conversationRepository from '../storage/conversationRepository.js';

export class ContextRetrievalService {
  constructor() {
    this.memoryRepo = memoryRepository;
    this.planRepo = learningPlanRepository;
    this.convRepo = conversationRepository;
    this.maxRecentMessages = 10;
    this.maxMemories = 6;
  }

  /**
   * Assemble a clean context package for AI prompt construction from local IndexedDB.
   * Internal DB fields and sync metadata are strictly filtered out.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.conversationId
   * @param {Array<Object>} params.currentMessages
   * @returns {Promise<Object>} Clean context package
   */
  async assembleContext({ userId = 'local-user', conversationId, currentMessages = [] }) {
    try {
      // 1. Conversation summary and recent messages
      let summary = '';
      if (conversationId) {
        const conv = await this.convRepo.getConversation(conversationId);
        summary = conv?.summary || '';
      }

      const recentMessages = (currentMessages || [])
        .slice(-this.maxRecentMessages)
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      // 2. Active learner preferences and typed memories
      const allMemories = await this.memoryRepo.getMemories(userId, { status: 'active' });

      const preferences = {};
      const relevantMemories = [];

      for (const mem of allMemories || []) {
        if (mem.type === 'learning_preference') {
          preferences[mem.key] = mem.value;
        } else if (relevantMemories.length < this.maxMemories) {
          relevantMemories.push({
            type: mem.type,
            key: mem.key,
            value: mem.value,
            source: mem.source,
          });
        }
      }

      // 3. Active Learning Plan
      const activePlan = await this.planRepo.getActivePlan(userId);
      let planSummary = null;

      if (activePlan) {
        const inProgressItems = (activePlan.items || [])
          .filter((i) => i.status === 'in_progress')
          .map((i) => ({ id: i.id, title: i.title }));

        const nextNotStarted = (activePlan.items || [])
          .filter((i) => i.status === 'not_started')
          .slice(0, 2)
          .map((i) => ({ id: i.id, title: i.title }));

        planSummary = {
          title: activePlan.title,
          goal: activePlan.goal,
          currentFocus: inProgressItems[0]?.title || nextNotStarted[0]?.title || 'Foundations',
          itemsInProgress: inProgressItems,
          upcomingTopics: nextNotStarted,
        };
      }

      return {
        conversation: {
          summary,
          recentMessages,
        },
        learner: {
          preferences,
          relevantMemories,
        },
        learning: {
          activePlan: planSummary,
        },
        contextMetadata: {
          source: 'local_indexeddb',
          memoryCount: relevantMemories.length + Object.keys(preferences).length,
          hasPlan: Boolean(planSummary),
        },
      };
    } catch (err) {
      console.warn('[ContextRetrievalService] Error retrieving local context:', err.message);
      return {
        conversation: { summary: '', recentMessages: currentMessages.slice(-this.maxRecentMessages) },
        learner: { preferences: {}, relevantMemories: [] },
        learning: { activePlan: null },
        contextMetadata: { source: 'fallback', memoryCount: 0, hasPlan: false },
      };
    }
  }

  /**
   * Convert the context package into a clean, structured system instruction
   * suitable for inclusion in prompts for both Online AI and Ollama.
   *
   * @param {Object} contextPackage
   * @returns {string} System instruction string
   */
  buildSystemPrompt(contextPackage) {
    if (!contextPackage) return '';

    const sections = [];
    sections.push('You are Edunix, an empathetic, expert AI learning companion specialized in computer systems, Unix/Linux, DevOps, and programming.');

    // 1. Learner Preferences
    const prefs = contextPackage.learner?.preferences || {};
    const prefEntries = Object.entries(prefs);
    if (prefEntries.length > 0) {
      const prefLines = prefEntries.map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`);
      sections.push(`Learner Preferences:\n${prefLines.join('\n')}`);
    }

    // 2. Relevant Memories
    const memories = contextPackage.learner?.relevantMemories || [];
    if (memories.length > 0) {
      const memLines = memories.map((m) => `- [${m.type}]: ${m.value}`);
      sections.push(`Learner Memory Context:\n${memLines.join('\n')}`);
    }

    // 3. Active Learning Plan
    const plan = contextPackage.learning?.activePlan;
    if (plan) {
      sections.push(
        `Active Study Plan: "${plan.title}"\n- Current Goal: ${plan.goal}\n- Target Topic: ${plan.currentFocus}`
      );
    }

    // 4. Conversation Summary
    const summary = contextPackage.conversation?.summary;
    if (summary) {
      sections.push(`Conversation Context:\n${summary}`);
    }

    sections.push(
      'Pedagogical Guidelines:\n' +
      '1. Tailor your explanations to the learner\'s expressed preferences.\n' +
      '2. If the user asked in a specific language (e.g. Odia, Hindi, English), respond in that language.\n' +
      '3. Be concise, interactive, and check for understanding before advancing.'
    );

    return sections.join('\n\n');
  }
}

export default new ContextRetrievalService();

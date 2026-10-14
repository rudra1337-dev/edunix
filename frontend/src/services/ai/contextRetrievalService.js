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
   * Match user query to roadmap topics and extract best-fitting topic
   */
  findTopicMatch(topics, queryText) {
    if (!topics || topics.length === 0) return null;

    if (queryText && typeof queryText === 'string') {
      const stopWords = new Set([
        'the', 'and', 'for', 'with', 'what', 'how', 'why', 'can', 'you',
        'explain', 'teach', 'about', 'tell', 'me', 'please', 'help', 'is', 'are'
      ]);
      const queryTokens = queryText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w));

      let bestTopic = null;
      let highestScore = 0;

      for (const topic of topics) {
        let score = 0;
        const titleLower = (topic.title || '').toLowerCase();
        const descLower = (topic.summary || topic.description || topic.explanation || '').toLowerCase();

        // Exact match boost
        if (queryText.toLowerCase().includes(titleLower) || (titleLower.length > 3 && titleLower.includes(queryText.toLowerCase()))) {
          score += 10;
        }

        // Token matches
        for (const token of queryTokens) {
          if (titleLower.includes(token)) score += 3;
          if (descLower.includes(token)) score += 1;
        }

        if (score > highestScore && score >= 2) {
          highestScore = score;
          bestTopic = topic;
        }
      }

      if (bestTopic) return bestTopic;
    }

    // Default fallback: prioritize in_progress -> review -> not_started
    return (
      topics.find((t) => t.status === 'in_progress') ||
      topics.find((t) => t.status === 'review') ||
      topics.find((t) => t.status === 'not_started') ||
      topics[0]
    );
  }

  /**
   * Formulate status-specific pedagogical guidance for prompt inclusion
   */
  getPedagogicalGuidance(status) {
    switch (status) {
      case 'completed':
        return 'The learner has already completed this topic. Briefly review or reinforce key points, validate their understanding, and avoid re-explaining from scratch unless they explicitly request it.';
      case 'in_progress':
        return 'The learner is currently working on this topic. Explain core concepts clearly, provide hands-on Unix/Linux practical examples, and guide them step-by-step toward mastery.';
      case 'review':
        return 'The learner needs to review this topic. Provide concise refresher summaries and active recall questions to reinforce retention.';
      case 'not_started':
      default:
        return 'The learner has not started this topic yet. Check prerequisite understanding first, introduce foundational concepts gently, and keep explanations accessible.';
    }
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

      // 3. Active Learning Plan & Roadmap Topic Alignment
      const allPlans = await this.planRepo.getPlans(userId);
      const activePlans = (allPlans || []).filter(
        (p) => !p.isDeleted && !p.isArchived && p.status !== 'archived'
      );
      const activePlan = activePlans.find((p) => p.status === 'active') || activePlans[0] || null;
      let planSummary = null;

      if (activePlan) {
        // Collect all topics across sections or flat items with section context
        const allTopics = [];
        if (Array.isArray(activePlan.sections) && activePlan.sections.length > 0) {
          for (const sec of activePlan.sections) {
            for (const top of sec.topics || []) {
              allTopics.push({
                ...top,
                sectionTitle: sec.title || 'Core Curriculum',
              });
            }
          }
        } else if (Array.isArray(activePlan.items) && activePlan.items.length > 0) {
          for (const item of activePlan.items) {
            allTopics.push({
              ...item,
              sectionTitle: 'Core Curriculum',
            });
          }
        }

        // Extract latest user query for topic matching
        const lastUserMsg = [...(currentMessages || [])].reverse().find((m) => m.role === 'user');
        const userQuery = lastUserMsg?.content || '';

        const matchedTopic = this.findTopicMatch(allTopics, userQuery);

        const inProgressItems = allTopics
          .filter((i) => i.status === 'in_progress')
          .map((i) => ({ id: i.id, title: i.title }));

        const nextNotStarted = allTopics
          .filter((i) => i.status === 'not_started')
          .slice(0, 2)
          .map((i) => ({ id: i.id, title: i.title }));

        planSummary = {
          title: activePlan.title,
          goal: activePlan.goal || activePlan.summary || 'Mastery',
          currentFocus: matchedTopic?.title || inProgressItems[0]?.title || nextNotStarted[0]?.title || 'Foundations',
          itemsInProgress: inProgressItems,
          upcomingTopics: nextNotStarted,
          matchedTopic: matchedTopic
            ? {
                id: matchedTopic.id,
                title: matchedTopic.title,
                section: matchedTopic.sectionTitle || 'Core Curriculum',
                status: matchedTopic.status || 'not_started',
                guidance: this.getPedagogicalGuidance(matchedTopic.status || 'not_started'),
              }
            : null,
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

    // 3. Active Learning Plan & Roadmap Topic Guidance
    const plan = contextPackage.learning?.activePlan;
    if (plan) {
      let planSection = `Active Study Plan: "${plan.title}"\n- Current Goal: ${plan.goal}\n- Target Topic: ${plan.currentFocus}`;
      if (plan.matchedTopic) {
        planSection += `\n- Topic Context: "${plan.matchedTopic.title}" (Status: ${plan.matchedTopic.status.toUpperCase()})`;
        if (plan.matchedTopic.section) {
          planSection += ` in [${plan.matchedTopic.section}]`;
        }
        planSection += `\n- Pedagogical Guidance: ${plan.matchedTopic.guidance}`;
      }
      sections.push(planSection);
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

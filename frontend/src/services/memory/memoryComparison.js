/**
 * Pure functions for deterministic comparison and decision processing in Change-Driven Memory.
 */

export const DECISIONS = {
  IGNORE: 'IGNORE',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  SUPERSEDE: 'SUPERSEDE',
};

/**
 * Normalize text by trimming, lowercasing, and collapsing whitespace
 */
export const normalizeText = (text) => {
  if (text === null || text === undefined) return '';
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Normalize any value (primitive, array, object) deterministically
 */
export const normalizeValue = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return normalizeText(val);
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) {
    return val.map(normalizeValue).sort();
  }
  if (typeof val === 'object') {
    const sorted = {};
    Object.keys(val)
      .sort()
      .forEach((k) => {
        // Skip volatile timestamps or internal sync metadata
        if (['updatedAt', 'createdAt', 'lastMessageAt', 'syncStatus', 'version'].includes(k)) {
          return;
        }
        sorted[k] = normalizeValue(val[k]);
      });
    return sorted;
  }
  return String(val);
};

/**
 * Compare two values semantically ignoring volatile timestamps or property ordering
 */
export const areValuesSemanticallyEqual = (val1, val2) => {
  const norm1 = normalizeValue(val1);
  const norm2 = normalizeValue(val2);

  if (typeof norm1 !== typeof norm2) return false;
  if (typeof norm1 === 'object' && norm1 !== null && norm2 !== null) {
    return JSON.stringify(norm1) === JSON.stringify(norm2);
  }
  return norm1 === norm2;
};

/**
 * Determine whether a candidate memory should be Created, Updated, Superseded, or Ignored
 * against existing stored memories.
 *
 * @param {Object} candidate - { key, value, type, source, confidence }
 * @param {Array<Object>} existingMemories - active memories for this user
 * @returns {{ decision: string, targetMemory: Object|null, reason: string }}
 */
export const evaluateMemoryDecision = (candidate, existingMemories = []) => {
  if (!candidate || !candidate.key || candidate.value === undefined || candidate.value === null) {
    return {
      decision: DECISIONS.IGNORE,
      targetMemory: null,
      reason: 'Candidate lacks valid key or value',
    };
  }

  const normKey = normalizeText(candidate.key);
  const normType = candidate.type || 'learning_preference';
  const candidateSource = candidate.source || 'observed';

  // Find existing active memories matching key and type
  const matching = (existingMemories || []).filter(
    (m) =>
      m.status === 'active' &&
      normalizeText(m.key) === normKey &&
      (!m.type || m.type === normType)
  );

  // Case 1: No existing memory for this key -> CREATE
  if (matching.length === 0) {
    // Only persist if confidence meets threshold or is explicit/observed
    if (candidateSource === 'inferred' && (candidate.confidence || 0) < 0.6) {
      return {
        decision: DECISIONS.IGNORE,
        targetMemory: null,
        reason: 'Inferred candidate confidence below persistence threshold (0.6)',
      };
    }

    return {
      decision: DECISIONS.CREATE,
      targetMemory: null,
      reason: 'No existing memory found with this key and type',
    };
  }

  // Pick the most relevant existing memory
  const existing = matching[0];

  // Case 2: Values are semantically identical -> IGNORE (No change)
  if (areValuesSemanticallyEqual(existing.value, candidate.value)) {
    return {
      decision: DECISIONS.IGNORE,
      targetMemory: existing,
      reason: 'Candidate value is semantically identical to existing memory (No change)',
    };
  }

  // Case 3: Provenance rule — Never allow uncertain AI inference to overwrite explicit user preference
  if (existing.source === 'explicit' && candidateSource === 'inferred') {
    return {
      decision: DECISIONS.IGNORE,
      targetMemory: existing,
      reason: 'Uncertain AI inference cannot overwrite established explicit user preference',
    };
  }

  // Case 4: Explicit user change -> UPDATE or SUPERSEDE
  if (candidateSource === 'explicit') {
    return {
      decision: DECISIONS.UPDATE,
      targetMemory: existing,
      reason: 'Explicit user update takes precedence and modifies existing memory',
    };
  }

  // Case 5: Higher confidence observation -> SUPERSEDE
  const existingConfidence = existing.confidence || (existing.source === 'explicit' ? 1.0 : 0.7);
  const candidateConfidence = candidate.confidence || 0.7;

  if (candidateConfidence >= existingConfidence) {
    return {
      decision: DECISIONS.SUPERSEDE,
      targetMemory: existing,
      reason: 'Candidate has equal or higher confidence, superseding previous observation',
    };
  }

  // Default: lower confidence observation does not overwrite stronger existing memory
  return {
    decision: DECISIONS.IGNORE,
    targetMemory: existing,
    reason: 'Existing memory has higher confidence provenance than candidate',
  };
};

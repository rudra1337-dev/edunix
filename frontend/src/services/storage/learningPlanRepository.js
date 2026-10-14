import { withRead, withWrite, STORES } from './db.js';

export const learningPlanRepository = {
  /**
   * Get all plans for a user
   */
  async getPlans(userId) {
    return withRead(STORES.LEARNING_PLANS, async (store) => {
      const index = store.index('by-user');
      const plans = await index.getAll(userId);
      return (plans || []).sort(
        (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
      );
    });
  },

  /**
   * Get single plan by ID
   */
  async getPlan(id) {
    return withRead(STORES.LEARNING_PLANS, (store) => store.get(id));
  },

  /**
   * Get current active plan for user
   */
  async getActivePlan(userId) {
    const plans = await this.getPlans(userId);
    return plans.find((p) => p.status === 'active') || plans[0] || null;
  },

  /**
   * Save or update a learning plan
   */
  async savePlan(plan) {
    const document = {
      ...plan,
      status: plan.status || 'active',
      version: plan.version !== undefined ? plan.version : 1,
      createdAt: plan.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: plan.syncStatus || 'pending',
    };
    await withWrite(STORES.LEARNING_PLANS, (store) => store.put(document));
    return document;
  },

  /**
   * Delete a plan by ID
   */
  async deletePlan(id) {
    return withWrite(STORES.LEARNING_PLANS, (store) => store.delete(id));
  },
};

export default learningPlanRepository;

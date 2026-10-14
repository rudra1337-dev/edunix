import learningPlanRepository from '../storage/learningPlanRepository.js';
import syncQueueRepository from '../storage/syncQueueRepository.js';
import learningEventRepository from '../storage/learningEventRepository.js';

const generatePlanId = () => `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const generateSecId = () => `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const generateItemId = () => `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const generateCheckId = () => `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const generateEvtId = () => `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

export const PLAN_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

export const ITEM_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  COMPLETED: 'completed',
};

// Valid status transitions
const VALID_TRANSITIONS = {
  [ITEM_STATUSES.NOT_STARTED]: [ITEM_STATUSES.IN_PROGRESS],
  [ITEM_STATUSES.IN_PROGRESS]: [ITEM_STATUSES.COMPLETED, ITEM_STATUSES.REVIEW],
  [ITEM_STATUSES.COMPLETED]: [ITEM_STATUSES.REVIEW, ITEM_STATUSES.IN_PROGRESS],
  [ITEM_STATUSES.REVIEW]: [ITEM_STATUSES.COMPLETED, ITEM_STATUSES.IN_PROGRESS],
};

/**
 * Pure function: Calculate progress statistics from plan items.
 * Safely handles empty or missing arrays without division-by-zero errors.
 */
export const calculateProgress = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      review: 0,
      notStarted: 0,
      percentage: 0,
    };
  }

  let completed = 0;
  let inProgress = 0;
  let review = 0;
  let notStarted = 0;

  for (const item of items) {
    switch (item.status) {
      case ITEM_STATUSES.COMPLETED:
        completed++;
        break;
      case ITEM_STATUSES.IN_PROGRESS:
        inProgress++;
        break;
      case ITEM_STATUSES.REVIEW:
        review++;
        break;
      default:
        notStarted++;
    }
  }

  const total = items.length;
  const percentage = Math.round((completed / total) * 100);

  return {
    total,
    completed,
    inProgress,
    review,
    notStarted,
    percentage,
  };
};

/**
 * Normalize any roadmap document to adhere to the Unified Roadmap Model.
 * Maintains two-way sync between structured `sections` and flat `items` for backward compatibility.
 */
export const normalizeRoadmap = (rawPlan = {}) => {
  if (!rawPlan || typeof rawPlan !== 'object') {
    throw new Error('Invalid roadmap: object expected.');
  }

  const planId = rawPlan.id || rawPlan.planId || generatePlanId();
  const userId = rawPlan.userId || 'local-user';
  const title = (rawPlan.title || 'Untitled Learning Roadmap').trim();
  const goal = (rawPlan.goal || 'Master core subject fundamentals').trim();
  const summary = (rawPlan.summary || rawPlan.description || goal).trim();
  const description = (rawPlan.description || rawPlan.summary || '').trim();
  const learningObjectives = Array.isArray(rawPlan.learningObjectives) ? rawPlan.learningObjectives : [];
  const prerequisites = Array.isArray(rawPlan.prerequisites) ? rawPlan.prerequisites : [];
  const targetAudience = rawPlan.targetAudience || 'All Learners';
  const estimatedDuration = rawPlan.estimatedDuration || '4-6 Weeks';
  const source = rawPlan.source || 'user_created';
  const status = rawPlan.status || PLAN_STATUSES.ACTIVE;
  const version = rawPlan.version || 1;
  const createdAt = rawPlan.createdAt || new Date().toISOString();
  const updatedAt = rawPlan.updatedAt || new Date().toISOString();

  let sections = [];
  let items = [];

  if (Array.isArray(rawPlan.sections) && rawPlan.sections.length > 0) {
    // 1. Process sections and flatten topics into items
    sections = rawPlan.sections.map((sec, secIdx) => {
      const secId = sec.id || `sec_${secIdx + 1}`;
      const secTopics = (sec.topics || []).map((top, topIdx) => {
        const topId = top.id || generateItemId();
        return {
          id: topId,
          sectionId: secId,
          title: top.title || `Topic ${topIdx + 1}`,
          summary: top.summary || top.description || '',
          explanation: top.explanation || top.description || '',
          description: top.description || top.summary || top.explanation || '',
          learningObjectives: Array.isArray(top.learningObjectives) ? top.learningObjectives : [],
          prerequisites: Array.isArray(top.prerequisites) ? top.prerequisites : [],
          checklist: Array.isArray(top.checklist)
            ? top.checklist.map((chk, cIdx) => ({
                id: chk.id || `chk_${topId}_${cIdx + 1}`,
                text: typeof chk === 'string' ? chk : chk.text || '',
                completed: Boolean(chk.completed),
              }))
            : [],
          practiceExercises: Array.isArray(top.practiceExercises) ? top.practiceExercises : [],
          resources: Array.isArray(top.resources) ? top.resources : [],
          status: Object.values(ITEM_STATUSES).includes(top.status) ? top.status : ITEM_STATUSES.NOT_STARTED,
          startedAt: top.startedAt || null,
          completedAt: top.completedAt || null,
          reviewMetadata: top.reviewMetadata || { reviewCount: 0, lastReviewedAt: null },
          notes: top.notes || '',
          order: top.order || topIdx + 1,
          dependencies: Array.isArray(top.dependencies) ? top.dependencies : [],
        };
      });

      return {
        id: secId,
        title: sec.title || `Section ${secIdx + 1}`,
        description: sec.description || '',
        order: sec.order || secIdx + 1,
        topics: secTopics,
      };
    });

    // Flatten all topics into items array
    const flattened = sections.flatMap((sec) => sec.topics);

    if (Array.isArray(rawPlan.items) && rawPlan.items.length > 0) {
      const itemMap = new Map(flattened.map((it) => [it.id, it]));
      const orderedItems = [];
      rawPlan.items.forEach((rit, idx) => {
        const found = itemMap.get(rit.id);
        if (found) {
          orderedItems.push({
            ...rit,
            ...found,
            order: rit.order !== undefined ? rit.order : idx + 1,
          });
          itemMap.delete(rit.id);
        } else {
          orderedItems.push({
            ...rit,
            order: rit.order !== undefined ? rit.order : idx + 1,
          });
        }
      });
      itemMap.forEach((leftover) => {
        orderedItems.push({
          ...leftover,
          order: orderedItems.length + 1,
        });
      });
      items = orderedItems;
    } else {
      items = flattened;
    }
  } else if (Array.isArray(rawPlan.items) && rawPlan.items.length > 0) {
    // 2. Legacy plan with flat items: group under a default section
    items = rawPlan.items.map((item, idx) => ({
      id: item.id || generateItemId(),
      title: item.title || `Topic ${idx + 1}`,
      description: item.description || '',
      summary: item.summary || item.description || '',
      explanation: item.explanation || item.description || '',
      learningObjectives: Array.isArray(item.learningObjectives) ? item.learningObjectives : [],
      prerequisites: Array.isArray(item.prerequisites) ? item.prerequisites : [],
      checklist: Array.isArray(item.checklist) ? item.checklist : [],
      practiceExercises: Array.isArray(item.practiceExercises) ? item.practiceExercises : [],
      resources: Array.isArray(item.resources) ? item.resources : [],
      status: Object.values(ITEM_STATUSES).includes(item.status) ? item.status : ITEM_STATUSES.NOT_STARTED,
      startedAt: item.startedAt || null,
      completedAt: item.completedAt || null,
      reviewMetadata: item.reviewMetadata || { reviewCount: 0, lastReviewedAt: null },
      notes: item.notes || '',
      order: item.order || idx + 1,
      dependencies: Array.isArray(item.dependencies) ? item.dependencies : [],
    }));

    sections = [
      {
        id: 'sec_core',
        title: 'Core Curriculum',
        description: description || 'Primary learning path',
        order: 1,
        topics: items,
      },
    ];
  } else {
    // 3. Fallback when neither sections nor items are provided
    const defaultTopId = generateItemId();
    items = [
      {
        id: defaultTopId,
        sectionId: 'sec_core',
        title: 'Foundations & Overview',
        summary: summary || 'Core orientation and initial setup.',
        explanation: 'Introduction and foundational concepts.',
        learningObjectives: [],
        prerequisites: [],
        checklist: [{ id: `chk_${defaultTopId}_1`, text: 'Review orientation guide', completed: false }],
        practiceExercises: [],
        resources: [],
        status: ITEM_STATUSES.NOT_STARTED,
        startedAt: null,
        completedAt: null,
        reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
        notes: '',
        order: 1,
        dependencies: [],
      },
    ];
    sections = [
      {
        id: 'sec_core',
        title: 'Core Curriculum',
        description: description || 'Primary learning path',
        order: 1,
        topics: items,
      },
    ];
  }

  return {
    id: planId,
    planId,
    userId,
    title,
    goal,
    summary,
    description,
    learningObjectives,
    prerequisites,
    targetAudience,
    estimatedDuration,
    source,
    conversationId: rawPlan.conversationId || null,
    status,
    sections,
    items,
    version,
    createdAt,
    updatedAt,
  };
};

/**
 * Default starter curriculum for Linux / Unix Systems
 */
export const createDefaultPlan = (userId = 'local-user') => {
  const planId = generatePlanId();
  const rawDefault = {
    id: planId,
    planId,
    userId,
    title: 'Linux & Unix Systems Mastery',
    goal: 'Master Unix command line, shell scripting, process control, and systems programming',
    summary: 'A structured, Notion-inspired roadmap covering Unix philosophy, file permissions, streams, pipes, grep, sed, awk, bash automation, and POSIX process control.',
    description: 'Structured adaptive learning path covering foundational to advanced Unix concepts, designed for production software engineers and systems administrators.',
    learningObjectives: [
      'Navigate the POSIX filesystem and inspect inodes, octal permissions, and ownership.',
      'Construct modular text pipelines using standard input, output, stderr, and redirection operators.',
      'Automate system tasks with robust, failure-safe Bash scripts (set -euo pipefail).',
      'Manage system processes, evaluate lifecycle signals (SIGTERM, SIGKILL, SIGHUP), and monitor background jobs.',
    ],
    prerequisites: ['Basic terminal familiarity or willingness to practice hands-on shell commands'],
    targetAudience: 'Software Engineers, DevOps Practitioners, and Computer Science Students',
    estimatedDuration: '4 Weeks (10-15 hrs/week)',
    status: PLAN_STATUSES.ACTIVE,
    source: 'system',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'sec_1_fundamentals',
        title: 'Section 1: Foundations & The Shell Environment',
        description: 'Understand the Unix philosophy, core shell commands, filesystem layout, and security ownership.',
        order: 1,
        topics: [
          {
            id: 'item_1_philosophy',
            title: 'Unix Philosophy & Command Line Fundamentals',
            summary: 'KISS principle, text streams, and core navigation commands (cd, ls, pwd, cat, man).',
            explanation: 'The Unix philosophy emphasizes writing modular programs that do one thing well and communicate via plain-text streams. Learn how POSIX terminals launch binaries, resolve path arguments, and interpret man pages.',
            learningObjectives: [
              'Understand the KISS principle and program composition through text streams.',
              'Master non-destructive navigation and file discovery using ls, cd, file, and pwd.',
              'Navigate manual pages efficiently with section lookups (man 1 ls vs man 2 fork).',
            ],
            prerequisites: ['Terminal emulator access'],
            checklist: [
              { id: 'chk_1_1', text: 'Read the Unix philosophy principles (Douglas McIlroy)', completed: true },
              { id: 'chk_1_2', text: 'Practice absolute vs relative path navigation in /tmp', completed: true },
              { id: 'chk_1_3', text: 'Inspect binary locations using which and type -a', completed: true },
            ],
            practiceExercises: [
              'Create a nested directory tree with `mkdir -p lab/{src,docs,bin}` and inspect it with `ls -laR`.',
              'Examine the man page for `find` and locate all files modified in the last 24 hours.',
            ],
            resources: [{ title: 'The Art of Unix Programming (Eric S. Raymond)', url: 'http://www.catb.org/esr/writings/taoup/', type: 'book' }],
            status: ITEM_STATUSES.COMPLETED,
            startedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            completedAt: new Date(Date.now() - 86400000).toISOString(),
            reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
            notes: 'Remember: Everything in Unix is represented as a byte stream or a file descriptor.',
            order: 1,
            dependencies: [],
          },
          {
            id: 'item_2_permissions',
            title: 'File System Hierarchy & Permissions (chmod/chown)',
            summary: 'Directory layout, inode concepts, octal permissions (755 vs 644), and ownership.',
            explanation: 'Linux controls access through user, group, and other permissions encoded in 9 bits, alongside special bits (SUID, SGID, Sticky). Understand how `chmod` sets read, write, and execute bits and how `chown` adjusts ownership.',
            learningObjectives: [
              'Calculate binary octal masks (e.g. 755 = rwxr-xr-x, 644 = rw-r--r--).',
              'Distinguish file execute permissions from directory search/traverse permissions.',
              'Inspect inode numbers with ls -i and understand hard vs symbolic links.',
            ],
            prerequisites: ['item_1_philosophy'],
            checklist: [
              { id: 'chk_2_1', text: 'Audit permissions of /etc/passwd and /etc/shadow', completed: true },
              { id: 'chk_2_2', text: 'Create a non-executable script and grant execution via chmod +x', completed: true },
              { id: 'chk_2_3', text: 'Create a symbolic link with ln -s and inspect its target', completed: false },
            ],
            practiceExercises: [
              'Set up a shared directory with group write access and the sticky bit (chmod 1777).',
              'Compare hard link inode counts using `ls -l` before and after file deletion.',
            ],
            resources: [{ title: 'Linux Filesystem Hierarchy Standard (FHS)', url: 'https://refspecs.linuxfoundation.org/FHS_3.0/fhs-3.0.html', type: 'specification' }],
            status: ITEM_STATUSES.IN_PROGRESS,
            startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
            completedAt: null,
            reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
            notes: 'Octal breakdown: Read=4, Write=2, Execute=1. Total sum per user category.',
            order: 2,
            dependencies: ['item_1_philosophy'],
          },
        ],
      },
      {
        id: 'sec_2_streams_text',
        title: 'Section 2: Streams, Pipelines & Text Processing',
        description: 'Connect commands using POSIX pipelines and manipulate streams using grep, sed, and awk.',
        order: 2,
        topics: [
          {
            id: 'item_3_streams_pipes',
            title: 'Standard Streams, Redirection & Pipes (|)',
            summary: 'Connecting programs using stdin, stdout, stderr (2>&1), and pipelines.',
            explanation: 'Programs execute with three standard file descriptors: 0 (stdin), 1 (stdout), and 2 (stderr). The pipe operator (|) links the stdout of one process directly to the stdin of another without intermediate disk files.',
            learningObjectives: [
              'Direct stderr and stdout to separate files or combine them using 2>&1.',
              'Prevent pipeline clobbering with set -o noclobber.',
              'Use tee to inspect intermediate pipeline flow while writing to disk.',
            ],
            prerequisites: ['item_1_philosophy'],
            checklist: [
              { id: 'chk_3_1', text: 'Redirect output using > and append using >>', completed: false },
              { id: 'chk_3_2', text: 'Filter error output using 2> /dev/null', completed: false },
              { id: 'chk_3_3', text: 'Build a 3-stage pipe: ls | grep | wc -l', completed: false },
            ],
            practiceExercises: [
              'Capture a command failure into an error.log file while printing standard output to terminal.',
              'Use `find` piped to `xargs` to safely process filenames with spaces.',
            ],
            resources: [{ title: 'GNU Coreutils: Redirection Syntax', url: 'https://www.gnu.org/software/bash/manual/html_node/Redirections.html', type: 'documentation' }],
            status: ITEM_STATUSES.NOT_STARTED,
            startedAt: null,
            completedAt: null,
            reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
            notes: '',
            order: 3,
            dependencies: ['item_1_philosophy'],
          },
          {
            id: 'item_4_text_processing',
            title: 'Text Processing Utilities (grep, sed, awk)',
            summary: 'Powerful stream editing, regular expressions, pattern matching, and columnar extraction.',
            explanation: 'Master regex-driven search with `grep`, non-interactive stream substitution with `sed`, and field-oriented report generation with `awk`.',
            learningObjectives: [
              'Apply extended regular expressions (ERE) with grep -E or egrep.',
              'Perform in-place text substitutions with sed -i s/old/new/g.',
              'Filter and sum log file columns using awk \'{sum += $3} END {print sum}\'.',
            ],
            prerequisites: ['item_3_streams_pipes'],
            checklist: [
              { id: 'chk_4_1', text: 'Extract IP addresses from an access.log using grep -E', completed: false },
              { id: 'chk_4_2', text: 'Replace configuration strings using sed', completed: false },
              { id: 'chk_4_3', text: 'Print specific delimited columns with awk -F\':\' \'{print $1, $7}\'', completed: false },
            ],
            practiceExercises: [
              'Parse /etc/passwd and list all users assigned to /bin/bash.',
              'Calculate total memory allocated across processes from `/proc/meminfo`.',
            ],
            resources: [{ title: 'The AWK Programming Language (Aho, Kernighan, Weinberger)', url: 'https://archive.org/details/awk-book', type: 'book' }],
            status: ITEM_STATUSES.NOT_STARTED,
            startedAt: null,
            completedAt: null,
            reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
            notes: '',
            order: 4,
            dependencies: ['item_3_streams_pipes'],
          },
        ],
      },
      {
        id: 'sec_3_automation_systems',
        title: 'Section 3: Automation & Systems Programming',
        description: 'Robust Bash script construction, environment variables, exit traps, and POSIX process management.',
        order: 3,
        topics: [
          {
            id: 'item_5_bash_scripting',
            title: 'Bash Scripting & Automation (set -euo pipefail)',
            summary: 'Writing robust scripts with variables, loops, conditionals, exit codes, and functions.',
            explanation: 'Move from interactive shell commands to reliable automation scripts. Learn strict mode (`set -euo pipefail`), trap handlers for cleanup, and argument parsing with getopts.',
            learningObjectives: [
              'Understand shell exit codes (0 = success, non-zero = failure).',
              'Apply defensive scripting flags: set -euo pipefail.',
              'Implement cleanup trap handlers with trap "rm -f $TMPFILE" EXIT.',
            ],
            prerequisites: ['item_4_text_processing'],
            checklist: [
              { id: 'chk_5_1', text: 'Write a script with set -euo pipefail and test error trapping', completed: false },
              { id: 'chk_5_2', text: 'Parse command line options using a while getopts loop', completed: false },
              { id: 'chk_5_3', text: 'Format portable functions with local variable scoping', completed: false },
            ],
            practiceExercises: [
              'Create a backup automation script that compresses /var/log into an archive with a timestamp and deletes backups older than 7 days.',
            ],
            resources: [{ title: 'Google Shell Style Guide', url: 'https://google.github.io/styleguide/shellguide.html', type: 'guide' }],
            status: ITEM_STATUSES.NOT_STARTED,
            startedAt: null,
            completedAt: null,
            reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
            notes: '',
            order: 5,
            dependencies: ['item_4_text_processing'],
          },
          {
            id: 'item_6_process_mgmt',
            title: 'Unix Process Management, PIDs & Signals',
            summary: 'Process life cycle (fork/exec), PID, signals (SIGTERM, SIGKILL, SIGHUP), and background jobs (&, bg, fg).',
            explanation: 'Every Unix process is initialized via `fork()` and `exec()`, assigned a unique PID, and communicates through signals. Learn how daemons handle SIGHUP for configuration reloading, gracefully shut down upon SIGTERM, and how job control works.',
            learningObjectives: [
              'Inspect running processes using ps aux, pgrep, and top/htop.',
              'Send lifecycle signals via kill -TERM, kill -HUP, and kill -9.',
              'Manage terminal jobs using &, jobs, fg, bg, and nohup/disown.',
            ],
            prerequisites: ['item_5_bash_scripting'],
            checklist: [
              { id: 'chk_6_1', text: 'Start a long-running command in background with & and bring to fg', completed: false },
              { id: 'chk_6_2', text: 'Trap SIGTERM inside a script to execute graceful exit', completed: false },
              { id: 'chk_6_3', text: 'Identify orphan vs zombie processes using ps -eo stat,ppid,pid,comm', completed: false },
            ],
            practiceExercises: [
              'Write a daemonized background worker that logs heartbeats every 5 seconds until receiving SIGTERM.',
            ],
            resources: [{ title: 'Advanced Programming in the UNIX Environment (W. Richard Stevens)', url: 'http://www.apuebook.com/', type: 'book' }],
            status: ITEM_STATUSES.NOT_STARTED,
            startedAt: null,
            completedAt: null,
            reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
            notes: '',
            order: 6,
            dependencies: ['item_5_bash_scripting'],
          },
        ],
      },
    ],
  };

  return normalizeRoadmap(rawDefault);
};

export class LearningPlanService {
  constructor() {
    this.planRepo = learningPlanRepository;
    this.syncRepo = syncQueueRepository;
    this.eventRepo = learningEventRepository;
  }

  /**
   * Get all roadmaps for a user
   */
  async getPlans(userId = 'local-user') {
    const rawPlans = await this.planRepo.getPlans(userId);
    if (!rawPlans || rawPlans.length === 0) {
      // Auto-initialize default plan if user has none
      const defaultPlan = await this.getOrCreateActivePlan(userId);
      return [defaultPlan];
    }
    return rawPlans
      .filter((p) => p.status !== PLAN_STATUSES.ARCHIVED)
      .map(normalizeRoadmap);
  }

  /**
   * Get single roadmap by ID
   */
  async getPlan(planId) {
    if (!planId) return null;
    const raw = await this.planRepo.getPlan(planId);
    if (!raw) return null;
    return normalizeRoadmap(raw);
  }

  /**
   * Get active plan for user, initializing default if not yet created
   */
  async getOrCreateActivePlan(userId = 'local-user') {
    let raw = await this.planRepo.getActivePlan(userId);
    if (!raw) {
      const plan = createDefaultPlan(userId);
      await this.planRepo.savePlan(plan);
      await this.syncRepo.enqueue({
        userId,
        entityType: 'learningPlan',
        entityId: plan.id,
        operation: 'upsert',
        payload: plan,
      });
      return plan;
    }
    return normalizeRoadmap(raw);
  }

  /**
   * Validate whether a status transition is permitted
   */
  validateTransition(currentStatus, targetStatus) {
    if (currentStatus === targetStatus) return true;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  /**
   * Create and persist a new roadmap
   */
  async createRoadmap({
    id,
    userId = 'local-user',
    title,
    goal,
    summary = '',
    description = '',
    learningObjectives = [],
    prerequisites = [],
    targetAudience = 'All Levels',
    estimatedDuration = '4-6 Weeks',
    sections = [],
    items = [],
    source = 'user_created',
    status = PLAN_STATUSES.ACTIVE,
    conversationId = null,
  }) {
    if (!title || !title.trim()) {
      throw new Error('Roadmap title is required.');
    }
    if (!goal || !goal.trim()) {
      throw new Error('Roadmap learning goal is required.');
    }

    const planId = id || generatePlanId();

    const raw = {
      id: planId,
      userId,
      title: title.trim(),
      goal: goal.trim(),
      summary: summary.trim() || goal.trim(),
      description: description.trim() || summary.trim() || goal.trim(),
      learningObjectives: Array.isArray(learningObjectives) ? learningObjectives : [],
      prerequisites: Array.isArray(prerequisites) ? prerequisites : [],
      targetAudience,
      estimatedDuration,
      source,
      conversationId,
      status: status || PLAN_STATUSES.ACTIVE,
      sections,
      items,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const roadmap = normalizeRoadmap(raw);

    // If new roadmap is active, demote any other active plans for this user
    if (roadmap.status === PLAN_STATUSES.ACTIVE) {
      try {
        const existingPlans = await this.planRepo.getPlans(userId);
        for (const ep of existingPlans) {
          if (ep.id !== roadmap.id && ep.status === PLAN_STATUSES.ACTIVE) {
            ep.status = 'inactive';
            ep.updatedAt = new Date().toISOString();
            await this.planRepo.savePlan(ep);
            await this.syncRepo.enqueue({
              userId,
              entityType: 'learningPlan',
              entityId: ep.id,
              operation: 'upsert',
              payload: ep,
            });
          }
        }
      } catch (err) {
        console.warn('[learningPlanService] Active plan note:', err.message);
      }
    }

    // 1. Save to local IndexedDB
    await this.planRepo.savePlan(roadmap);

    // 2. Queue synchronization
    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: roadmap.id,
      operation: 'upsert',
      payload: roadmap,
    });

    // 3. Record learning event
    await this.eventRepo.recordEvent({
      eventId: generateEvtId(),
      userId,
      learningPlanId: roadmap.id,
      type: 'roadmap_created',
      topic: roadmap.title,
      payload: { goal: roadmap.goal, source: roadmap.source },
    });

    return roadmap;
  }

  /**
   * Set a specific roadmap as the active plan for user
   */
  async setActiveRoadmap({ userId = 'local-user', planId }) {
    if (!planId) {
      throw new Error('planId is required.');
    }

    const plans = await this.planRepo.getPlans(userId);
    let target = null;

    for (const p of plans) {
      if (p.id === planId) {
        p.status = PLAN_STATUSES.ACTIVE;
        p.updatedAt = new Date().toISOString();
        await this.planRepo.savePlan(p);
        await this.syncRepo.enqueue({
          userId,
          entityType: 'learningPlan',
          entityId: p.id,
          operation: 'upsert',
          payload: p,
        });
        target = p;
      } else if (p.status === PLAN_STATUSES.ACTIVE) {
        p.status = 'inactive';
        p.updatedAt = new Date().toISOString();
        await this.planRepo.savePlan(p);
        await this.syncRepo.enqueue({
          userId,
          entityType: 'learningPlan',
          entityId: p.id,
          operation: 'upsert',
          payload: p,
        });
      }
    }

    if (!target) {
      throw new Error(`Roadmap '${planId}' not found.`);
    }

    // Record learning event
    await this.eventRepo.recordEvent({
      eventId: generateEvtId(),
      userId,
      learningPlanId: target.id,
      type: 'roadmap_activated',
      topic: target.title,
      payload: { goal: target.goal },
    });

    return normalizeRoadmap(target);
  }

  /**
   * Rename an existing roadmap
   */
  async renameRoadmap({ userId = 'local-user', planId, newTitle }) {
    if (!newTitle || !newTitle.trim()) {
      throw new Error('New title cannot be empty.');
    }

    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Roadmap '${planId}' not found.`);
    }

    const updated = {
      ...plan,
      title: newTitle.trim(),
      updatedAt: new Date().toISOString(),
      version: (plan.version || 1) + 1,
    };

    await this.planRepo.savePlan(updated);
    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: updated.id,
      operation: 'upsert',
      payload: updated,
    });

    return updated;
  }

  /**
   * Update roadmap details (summary, description, goal, objectives, etc.)
   */
  async updateRoadmapDetails({ userId = 'local-user', planId, updates = {}, ...rest }) {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Roadmap '${planId}' not found.`);
    }

    const detailUpdates = { ...rest, ...updates };

    const updated = normalizeRoadmap({
      ...plan,
      ...detailUpdates,
      id: plan.id,
      userId: plan.userId,
      updatedAt: new Date().toISOString(),
      version: (plan.version || 1) + 1,
    });

    await this.planRepo.savePlan(updated);
    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: updated.id,
      operation: 'upsert',
      payload: updated,
    });

    return updated;
  }

  /**
   * Update learner personal notes on a topic
   */
  async updateTopicNotes({ userId = 'local-user', planId, topicId, notes }) {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Roadmap '${planId}' not found.`);
    }

    let found = false;
    const updatedSections = (plan.sections || []).map((sec) => ({
      ...sec,
      topics: (sec.topics || []).map((t) => {
        if (t.id === topicId) {
          found = true;
          return { ...t, notes: String(notes || '') };
        }
        return t;
      }),
    }));

    if (!found) {
      throw new Error(`Topic '${topicId}' not found in roadmap.`);
    }

    const updated = normalizeRoadmap({
      ...plan,
      sections: updatedSections,
      updatedAt: new Date().toISOString(),
      version: (plan.version || 1) + 1,
    });

    await this.planRepo.savePlan(updated);
    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: updated.id,
      operation: 'upsert',
      payload: updated,
    });

    return updated;
  }

  /**
   * Toggle or update a subtopic checklist item within a topic
   */
  async updateChecklistItem({ userId = 'local-user', planId, topicId, checkId, checklistId, completed }) {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Roadmap '${planId}' not found.`);
    }

    const targetCheckId = checkId || checklistId;
    let foundCheck = false;
    const updatedSections = (plan.sections || []).map((sec) => ({
      ...sec,
      topics: (sec.topics || []).map((t) => {
        if (t.id === topicId) {
          const updatedChecklist = (t.checklist || []).map((c) => {
            if (c.id === targetCheckId) {
              foundCheck = true;
              return { ...c, completed: Boolean(completed) };
            }
            return c;
          });
          return { ...t, checklist: updatedChecklist };
        }
        return t;
      }),
    }));

    if (!foundCheck) {
      throw new Error(`Checklist item '${targetCheckId}' not found in topic '${topicId}'.`);
    }

    const updated = normalizeRoadmap({
      ...plan,
      sections: updatedSections,
      updatedAt: new Date().toISOString(),
      version: (plan.version || 1) + 1,
    });

    await this.planRepo.savePlan(updated);
    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: updated.id,
      operation: 'upsert',
      payload: updated,
    });

    // Record learning event for subtask checklist item
    const targetTopic = (plan.items || []).find((i) => i.id === topicId);
    await this.eventRepo.recordEvent({
      eventId: generateEvtId(),
      userId,
      learningPlanId: plan.id,
      learningPlanItemId: topicId,
      type: completed ? 'checklist_item_completed' : 'checklist_item_reopened',
      topic: targetTopic?.title || 'Checklist Subtask',
      payload: {
        topicId,
        checkId: targetCheckId,
        completed: Boolean(completed),
        timestamp: new Date().toISOString(),
      },
    });

    return updated;
  }

  /**
   * Delete a roadmap with tombstone synchronization
   */
  async deleteRoadmap({ userId = 'local-user', planId }) {
    const plan = await this.getPlan(planId);
    if (!plan) return false;

    // Remove from local IndexedDB
    await this.planRepo.deletePlan(planId);

    // Enqueue sync deletion to delete from MongoDB backend
    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: planId,
      operation: 'delete',
      payload: { id: planId, planId, status: 'archived' },
    });

    // Record learning event
    await this.eventRepo.recordEvent({
      eventId: generateEvtId(),
      userId,
      learningPlanId: planId,
      type: 'roadmap_deleted',
      topic: plan.title,
      payload: { planId, title: plan.title },
    });

    return true;
  }

  /**
   * Update the status of a specific item/topic in a roadmap.
   */
  async updateItemStatus({ userId = 'local-user', planId, itemId, newStatus }) {
    if (!Object.values(ITEM_STATUSES).includes(newStatus)) {
      throw new Error(`Invalid status '${newStatus}'. Allowed: ${Object.values(ITEM_STATUSES).join(', ')}`);
    }

    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Learning plan with ID '${planId}' not found.`);
    }

    const itemIndex = (plan.items || []).findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item with ID '${itemId}' not found in plan.`);
    }

    const item = plan.items[itemIndex];
    const previousStatus = item.status;

    if (previousStatus === newStatus) {
      return { plan, item, changed: false };
    }

    if (!this.validateTransition(previousStatus, newStatus)) {
      throw new Error(`Invalid status transition from '${previousStatus}' to '${newStatus}'.`);
    }

    const now = new Date().toISOString();
    const updatedItem = {
      ...item,
      status: newStatus,
    };

    let eventType = null;
    if (newStatus === ITEM_STATUSES.IN_PROGRESS) {
      if (!updatedItem.startedAt) updatedItem.startedAt = now;
      eventType = 'plan_item_started';
    } else if (newStatus === ITEM_STATUSES.COMPLETED) {
      updatedItem.completedAt = now;
      if (previousStatus === ITEM_STATUSES.REVIEW) {
        updatedItem.reviewMetadata = {
          reviewCount: (updatedItem.reviewMetadata?.reviewCount || 0) + 1,
          lastReviewedAt: now,
        };
        eventType = 'review_completed';
      } else {
        eventType = 'plan_item_completed';
      }
    } else if (newStatus === ITEM_STATUSES.REVIEW) {
      eventType = 'review_requested';
    }

    // Update sections structure synchronously
    const updatedSections = (plan.sections || []).map((sec) => ({
      ...sec,
      topics: (sec.topics || []).map((t) => (t.id === itemId ? updatedItem : t)),
    }));

    const updatedItems = (plan.items || []).map((t) => (t.id === itemId ? updatedItem : t));

    const updatedPlan = normalizeRoadmap({
      ...plan,
      sections: updatedSections,
      items: updatedItems,
      updatedAt: now,
      version: (plan.version || 1) + 1,
    });

    await this.planRepo.savePlan(updatedPlan);

    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: updatedPlan.id,
      operation: 'upsert',
      payload: updatedPlan,
    });

    if (eventType) {
      await this.eventRepo.recordEvent({
        eventId: generateEvtId(),
        userId,
        learningPlanId: plan.id,
        learningPlanItemId: item.id,
        type: eventType,
        topic: item.title,
        payload: { previousStatus, newStatus, timestamp: now },
      });
    }

    return { plan: updatedPlan, item: updatedItem, changed: true };
  }

  /**
   * Reorder items within a plan deterministically
   */
  async reorderItems({ userId = 'local-user', planId, itemIds }) {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error(`Learning plan with ID '${planId}' not found.`);
    }

    const itemMap = new Map((plan.items || []).map((item) => [item.id, item]));
    const reorderedItems = [];

    itemIds.forEach((id, index) => {
      const item = itemMap.get(id);
      if (item) {
        reorderedItems.push({
          ...item,
          order: index + 1,
        });
        itemMap.delete(id);
      }
    });

    itemMap.forEach((item) => {
      reorderedItems.push({
        ...item,
        order: reorderedItems.length + 1,
      });
    });

    const updatedPlan = normalizeRoadmap({
      ...plan,
      items: reorderedItems,
      updatedAt: new Date().toISOString(),
      version: (plan.version || 1) + 1,
    });

    await this.planRepo.savePlan(updatedPlan);
    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: updatedPlan.id,
      operation: 'upsert',
      payload: updatedPlan,
    });

    return updatedPlan;
  }

  /**
   * Pure deterministic next-step recommendation engine.
   * Prioritizes topics in review, in-progress tasks, and ready next steps.
   */
  getRecommendedNextStep(plan) {
    if (!plan || !Array.isArray(plan.items) || plan.items.length === 0) {
      return { topic: null, reason: 'No topics available', action: 'explore' };
    }

    // 1. Priority: Units marked for review
    const reviewItem = plan.items.find((i) => i.status === ITEM_STATUSES.REVIEW);
    if (reviewItem) {
      return {
        topic: reviewItem,
        reason: 'Marked for spaced repetition review to reinforce retention.',
        action: 'review',
      };
    }

    // 2. Priority: Currently in-progress topic
    const inProgressItem = plan.items.find((i) => i.status === ITEM_STATUSES.IN_PROGRESS);
    if (inProgressItem) {
      const remainingChecks = (inProgressItem.checklist || []).filter((c) => !c.completed).length;
      return {
        topic: inProgressItem,
        reason: `Currently in progress (${remainingChecks} subtasks remaining). Continue working to completion.`,
        action: 'continue',
      };
    }

    // 3. Priority: First not_started topic whose dependencies are met
    const completedSet = new Set(
      plan.items.filter((i) => i.status === ITEM_STATUSES.COMPLETED).map((i) => i.id)
    );

    const nextReady = plan.items.find((i) => {
      if (i.status !== ITEM_STATUSES.NOT_STARTED) return false;
      const deps = i.dependencies || [];
      return deps.every((d) => completedSet.has(d));
    });

    if (nextReady) {
      return {
        topic: nextReady,
        reason: 'Prerequisites met. Ready to begin studying.',
        action: 'start',
      };
    }

    // 4. Default: first not started item
    const firstNotStarted = plan.items.find((i) => i.status === ITEM_STATUSES.NOT_STARTED);
    if (firstNotStarted) {
      return {
        topic: firstNotStarted,
        reason: 'Next upcoming module in the curriculum sequence.',
        action: 'start',
      };
    }

    // 5. All completed
    return {
      topic: null,
      reason: 'All topics completed! Consider a comprehensive practical project or refresher review.',
      action: 'complete',
    };
  }

  /**
   * Parse and validate an AI-generated roadmap from conversational text or raw JSON.
   * Recovers gracefully from markdown fences or partial formatting.
   */
  parseAndValidateAIRoadmap(rawText, userId = 'local-user', conversationId = null) {
    if (!rawText || typeof rawText !== 'string') {
      return { success: false, error: 'Empty AI response' };
    }

    let parsed = null;

    // 1. Try extracting from markdown ```json ... ``` block
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidateJson = jsonMatch ? jsonMatch[1].trim() : rawText.trim();

    try {
      parsed = JSON.parse(candidateJson);
    } catch {
      // Try searching for first '{' and last '}'
      const firstBrace = candidateJson.indexOf('{');
      const lastBrace = candidateJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(candidateJson.substring(firstBrace, lastBrace + 1));
        } catch {
          // JSON parse failed
        }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      const lower = rawText.toLowerCase();
      // MUST contain explicit roadmap/plan keywords to qualify as a textual curriculum
      const isRoadmapContext = /(?:roadmap|plan|curriculum|journey)/i.test(lower);

      if (!isRoadmapContext) {
        return {
          success: false,
          error: 'Content is not a learning roadmap document.',
        };
      }

      // Graceful text heuristic fallback for conversational bullet lists
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
      const extractedTopics = [];
      let detectedTitle = '';

      for (const line of lines) {
        if (!detectedTitle && (line.toLowerCase().includes('roadmap') || line.toLowerCase().includes('plan') || line.startsWith('#'))) {
          detectedTitle = line.replace(/^[#\s*_-]+/, '').replace(/[:*]+$/, '').trim();
        }
        const bulletMatch = line.match(/^(?:[-*•]|\d+[\.)])\s*(?:Topic\s*\d*:\s*|Module\s*\d*:\s*|Week\s*\d*:\s*)?(.+)/i);
        if (bulletMatch && bulletMatch[1].trim().length > 3) {
          extractedTopics.push({
            title: bulletMatch[1].trim(),
            summary: 'Core curriculum topic',
          });
        }
      }

      if (extractedTopics.length >= 2) {
        parsed = {
          title: detectedTitle || 'AI Learning Roadmap',
          goal: 'Master curriculum concepts and practical skills',
          topics: extractedTopics,
        };
      } else {
        return {
          success: false,
          error: 'Could not extract valid JSON structure or bulleted topics from AI response.',
        };
      }
    }

    // 2. Validate essential fields
    const title = parsed.title || parsed.roadmapTitle || parsed.name || 'AI Learning Roadmap';
    const goal = parsed.goal || parsed.learningGoal || parsed.summary || parsed.description || 'Master core subject fundamentals';

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return { success: false, error: 'AI Roadmap is missing a valid title.' };
    }

    // 3. Assemble normalized sections and topics
    const sectionsInput = parsed.sections || parsed.modules || [];
    const topicsInput = parsed.topics || parsed.items || [];

    const builtSections = [];

    if (Array.isArray(sectionsInput) && sectionsInput.length > 0) {
      sectionsInput.forEach((sec, sIdx) => {
        const secId = `sec_${Date.now()}_${sIdx + 1}`;
        const secTopics = (sec.topics || sec.items || []).map((top, tIdx) => ({
          id: `top_${Date.now()}_${sIdx + 1}_${tIdx + 1}`,
          title: top.title || `Topic ${tIdx + 1}`,
          summary: top.summary || top.description || '',
          explanation: top.explanation || top.description || '',
          learningObjectives: Array.isArray(top.learningObjectives) ? top.learningObjectives : [],
          prerequisites: Array.isArray(top.prerequisites) ? top.prerequisites : [],
          checklist: Array.isArray(top.checklist)
            ? top.checklist.map((c, cIdx) => ({
                id: `chk_${Date.now()}_${sIdx + 1}_${tIdx + 1}_${cIdx + 1}`,
                text: typeof c === 'string' ? c : c.text || '',
                completed: false,
              }))
            : [],
          practiceExercises: Array.isArray(top.practiceExercises) ? top.practiceExercises : [],
          resources: Array.isArray(top.resources) ? top.resources : [],
          status: ITEM_STATUSES.NOT_STARTED,
          startedAt: null,
          completedAt: null,
          reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
          notes: '',
          order: tIdx + 1,
          dependencies: [],
        }));

        builtSections.push({
          id: secId,
          title: sec.title || `Section ${sIdx + 1}`,
          description: sec.description || '',
          order: sIdx + 1,
          topics: secTopics,
        });
      });
    } else if (Array.isArray(topicsInput) && topicsInput.length > 0) {
      const defaultSecTopics = topicsInput.map((top, tIdx) => ({
        id: `top_${Date.now()}_1_${tIdx + 1}`,
        title: top.title || `Topic ${tIdx + 1}`,
        summary: top.summary || top.description || '',
        explanation: top.explanation || top.description || '',
        learningObjectives: Array.isArray(top.learningObjectives) ? top.learningObjectives : [],
        checklist: Array.isArray(top.checklist)
          ? top.checklist.map((c, cIdx) => ({
              id: `chk_${Date.now()}_1_${tIdx + 1}_${cIdx + 1}`,
              text: typeof c === 'string' ? c : c.text || '',
              completed: false,
            }))
          : [],
        practiceExercises: Array.isArray(top.practiceExercises) ? top.practiceExercises : [],
        status: ITEM_STATUSES.NOT_STARTED,
        order: tIdx + 1,
      }));

      builtSections.push({
        id: `sec_${Date.now()}_1`,
        title: 'Core Curriculum',
        description: parsed.description || 'Generated structured roadmap',
        order: 1,
        topics: defaultSecTopics,
      });
    }

    if (builtSections.length === 0 || builtSections.every((s) => s.topics.length === 0)) {
      return { success: false, error: 'AI Roadmap does not contain any valid sections or topics.' };
    }

    const normalized = normalizeRoadmap({
      id: generatePlanId(),
      userId,
      title: title.trim(),
      goal: goal.trim(),
      summary: parsed.summary || parsed.description || goal.trim(),
      description: parsed.description || parsed.summary || '',
      learningObjectives: Array.isArray(parsed.learningObjectives) ? parsed.learningObjectives : [],
      prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites : [],
      targetAudience: parsed.targetAudience || 'All Levels',
      estimatedDuration: parsed.estimatedDuration || '4-8 Weeks',
      source: 'ai_generated',
      conversationId,
      status: PLAN_STATUSES.ACTIVE,
      sections: builtSections,
    });

    return {
      success: true,
      roadmap: normalized,
      ...normalized,
    };
  }

  /**
   * Generate a complete structured learning roadmap using AI with offline template fallback.
   */
  async generateAIRoadmap({
    userId = 'local-user',
    prompt,
    targetAudience = 'All Levels',
    estimatedDuration = '4 Weeks',
    conversationId = null,
  }) {
    const cleanTopic = (prompt || 'Unix & Linux Systems Mastery').trim();
    let roadmapData = null;

    // 1. Attempt AI generation if network / chat endpoint is available
    try {
      if (typeof fetch === 'function') {
        const res = await fetch('/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `Generate a comprehensive structured learning roadmap for: "${cleanTopic}".
Target Audience: ${targetAudience}. Duration: ${estimatedDuration}.
Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Roadmap Title",
  "goal": "Core learning objective",
  "summary": "Brief curriculum overview",
  "targetAudience": "${targetAudience}",
  "estimatedDuration": "${estimatedDuration}",
  "learningObjectives": ["Objective 1", "Objective 2"],
  "prerequisites": ["Prereq 1"],
  "sections": [
    {
      "title": "Module 1: Title",
      "description": "Module description",
      "topics": [
        {
          "title": "Topic Title",
          "summary": "Topic summary",
          "explanation": "Detailed explanation",
          "checklist": ["Subtask 1", "Subtask 2"],
          "practiceExercises": [{ "instruction": "Task", "command": "cmd" }]
        }
      ]
    }
  ]
}`,
              },
            ],
            mode: 'auto',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data?.data?.content || data?.content || '';
          const parsed = this.parseAndValidateAIRoadmap(content, userId, conversationId);
          if (parsed.success) {
            roadmapData = parsed.roadmap;
          }
        }
      }
    } catch {
      // Offline or network error: proceed with resilient generator template
    }

    // 2. Deterministic high-quality offline fallback template
    if (!roadmapData) {
      roadmapData = {
        title: cleanTopic,
        goal: `Master comprehensive foundations, architectures, and practical skills in ${cleanTopic}`,
        summary: `A complete, hands-on learning roadmap for ${cleanTopic}, designed for ${targetAudience}.`,
        targetAudience,
        estimatedDuration,
        learningObjectives: [
          `Understand fundamental architectural paradigms of ${cleanTopic}`,
          `Execute hands-on exercises and implement reliable configurations`,
          `Troubleshoot, debug, and optimize systems in production`,
        ],
        prerequisites: ['Basic command-line familiarity', 'Text editor usage'],
        sections: [
          {
            id: `sec_${Date.now()}_1`,
            title: `1. Foundations & Core Concepts of ${cleanTopic}`,
            description: 'Essential theory, terminology, and development environment setup.',
            order: 1,
            topics: [
              {
                id: `top_${Date.now()}_1_1`,
                title: 'Architecture & Mental Model',
                summary: `Overview of key architectural principles in ${cleanTopic}.`,
                explanation: `Detailed breakdown of how ${cleanTopic} components interact with the operating system and user applications.`,
                checklist: [
                  { id: `chk_${Date.now()}_1`, text: 'Review core terminology and documentation', completed: false },
                  { id: `chk_${Date.now()}_2`, text: 'Set up local lab environment', completed: false },
                ],
                practiceExercises: [
                  { instruction: 'Verify environment prerequisites', command: 'uname -a && which bash' },
                ],
                status: ITEM_STATUSES.NOT_STARTED,
                order: 1,
              },
              {
                id: `top_${Date.now()}_1_2`,
                title: 'Core Operations & Fundamentals',
                summary: 'Basic operations, primitives, and standard commands.',
                explanation: 'Hands-on exploration of primary commands and data flow.',
                checklist: [
                  { id: `chk_${Date.now()}_3`, text: 'Execute basic workflows', completed: false },
                  { id: `chk_${Date.now()}_4`, text: 'Verify output and inspect error logs', completed: false },
                ],
                status: ITEM_STATUSES.NOT_STARTED,
                order: 2,
              },
            ],
          },
          {
            id: `sec_${Date.now()}_2`,
            title: `2. Intermediate Practice & Practical Workflows`,
            description: 'Building practical proficiency and automating real-world tasks.',
            order: 2,
            topics: [
              {
                id: `top_${Date.now()}_2_1`,
                title: 'Practical Workflows & Best Practices',
                summary: 'Industry patterns and robust implementation techniques.',
                explanation: 'Step-by-step guidance on constructing resilient solutions.',
                checklist: [
                  { id: `chk_${Date.now()}_5`, text: 'Implement sample exercise', completed: false },
                  { id: `chk_${Date.now()}_6`, text: 'Test edge cases and error handling', completed: false },
                ],
                practiceExercises: [
                  { instruction: 'Check system resource usage', command: 'ps aux | head -n 10' },
                ],
                status: ITEM_STATUSES.NOT_STARTED,
                order: 1,
              },
            ],
          },
          {
            id: `sec_${Date.now()}_3`,
            title: `3. Production Readiness & Advanced Techniques`,
            description: 'Performance tuning, reliability, and security considerations.',
            order: 3,
            topics: [
              {
                id: `top_${Date.now()}_3_1`,
                title: 'Observability, Debugging, and Optimization',
                summary: 'Troubleshooting bottlenecks and deploying robust configurations.',
                explanation: 'Techniques for tracing, profiling, and debugging under load.',
                checklist: [
                  { id: `chk_${Date.now()}_7`, text: 'Audit logs and identify anomalies', completed: false },
                  { id: `chk_${Date.now()}_8`, text: 'Formulate remediation plan', completed: false },
                ],
                status: ITEM_STATUSES.NOT_STARTED,
                order: 1,
              },
            ],
          },
        ],
      };
    }

    return this.createRoadmap({
      ...roadmapData,
      userId,
      source: 'ai_generated',
    });
  }
}

export default new LearningPlanService();

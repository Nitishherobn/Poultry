const STORAGE_KEY = 'daymark-state-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const OBSERVATION_DAYS = 0;

const DEMO_MEMBERS = [
    { id: 'taylor', name: 'Taylor', focus: 8, level: 'Undergraduate', subjects: ['Biology', 'Psychology'], hours: { daily: 2.4, weekly: 14.2, monthly: 51, all: 186 } },
    { id: 'jordan', name: 'Jordan', focus: 6, level: 'Graduate student', subjects: ['Statistics', 'Technology'], hours: { daily: 1.8, weekly: 11.6, monthly: 43, all: 214 } },
    { id: 'riley', name: 'Riley', focus: 9, level: 'Undergraduate', subjects: ['Design', 'Creativity'], hours: { daily: 3.1, weekly: 18.4, monthly: 67, all: 302 } },
    { id: 'casey', name: 'Casey', focus: 5, level: 'High school', subjects: ['History', 'People & culture'], hours: { daily: 1.2, weekly: 8.1, monthly: 30, all: 91 } },
    { id: 'avery', name: 'Avery', focus: 7, level: 'Undergraduate', subjects: ['Chemistry', 'Nature'], hours: { daily: 2.0, weekly: 13.5, monthly: 48, all: 175 } }
];

function makeProfilePrivacy() {
    return { discoverable: true, focus: true, level: true, hours: true, interests: true };
}

function makeObservation() {
    return {
        startedAt: Date.now(),
        focusSeconds: 0,
        awaySeconds: 0,
        interruptionCount: 0,
        startedSessions: 0,
        completedSessions: 0,
        completedTaskIds: [],
        awayStartedAt: 0,
        matchedAt: 0,
        matchedPeer: null,
        finalRating: null,
        chatMessages: []
    };
}

function dateAfter(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDateString(date);
}

function dateBefore(isoDate, days) {
    const date = new Date(`${isoDate}T00:00:00`);
    date.setDate(date.getDate() - days);
    return localDateString(date);
}

function formatShortDate(isoDate) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${isoDate}T00:00:00`));
}

const ASSIGNMENT_OR_TEST_REGEX = /\b(assignment|exam|test|quiz|midterm|final|homework|hw|problem\s*set|pset|paper|project|deliverable|lab\s*practical|presentation|essay|assessment)\b/i;

function isAssignmentOrTest(taskOrTitle) {
    if (!taskOrTitle) return false;
    if (typeof taskOrTitle === 'string') return ASSIGNMENT_OR_TEST_REGEX.test(taskOrTitle);
    if (taskOrTitle.source === 'canvas') return true;
    const text = `${taskOrTitle.title || ''} ${taskOrTitle.subject || ''}`;
    return ASSIGNMENT_OR_TEST_REGEX.test(text);
}

function getTaskPriority(task) {
    if (isAssignmentOrTest(task)) return 'high';
    if (task.priority === 'high' || task.priority === 'medium' || task.priority === 'low') {
        return task.priority;
    }
    return 'medium';
}

function getPriorityRank(priority) {
    if (priority === 'high') return 1;
    if (priority === 'medium') return 2;
    return 3;
}

function makeStarterTasks() {
    return [
        { id: 'starter-stats', title: 'Finish problem set 4', subject: 'Statistics', due: dateAfter(1), targetDate: dateAfter(0), minutes: 45, priority: 'high', done: false },
        { id: 'starter-chem', title: 'Make a midterm review sheet', subject: 'Chemistry', due: dateAfter(3), targetDate: dateAfter(2), minutes: 40, priority: 'high', done: false },
        { id: 'starter-design', title: 'Gather references for studio project', subject: 'Design', due: dateAfter(5), targetDate: dateAfter(3), minutes: 30, priority: 'high', done: false },
        { id: 'starter-bio', title: 'Review cell membranes & transport', subject: 'Biology', due: dateAfter(2), targetDate: dateAfter(1), minutes: 35, priority: 'medium', done: false }
    ];
}

function initialState() {
    return {
        onboarded: true,
        name: 'Sam',
        studyLevel: 'Undergraduate',
        interests: [],
        subjects: [],
        profilePrivacy: makeProfilePrivacy(),
        focusSecondsByDay: {},
        mode: 'casual',
        tasks: makeStarterTasks(),
        points: 0,
        streak: 0,
        lastActiveDate: '',
        attention: 5,
        observation: makeObservation(),
        currentSessionStarted: false,
        workMinutes: 25,
        breakMinutes: 5,
        timerKind: 'work',
        timerRemaining: 25 * 60,
        sessionCount: 1,
        completedSessions: 0,
        unlockedUntil: 0,
        rewardDate: ''
    };
}

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!saved || typeof saved !== 'object') return initialState();
        const base = initialState();
        const loadedTasks = Array.isArray(saved.tasks) ? saved.tasks : base.tasks;
        const tasks = loadedTasks.map((task) => ({
            ...task,
            priority: getTaskPriority(task)
        }));
        return {
            ...base,
            ...saved,
            tasks,
            interests: Array.isArray(saved.interests) ? saved.interests : [],
            subjects: Array.isArray(saved.subjects) ? saved.subjects : [],
            profilePrivacy: { ...base.profilePrivacy, ...(saved.profilePrivacy || {}) },
            focusSecondsByDay: saved.focusSecondsByDay && typeof saved.focusSecondsByDay === 'object' ? saved.focusSecondsByDay : {},
            observation: saved.observation && typeof saved.observation === 'object'
                ? {
                    ...base.observation,
                    ...saved.observation,
                    completedTaskIds: Array.isArray(saved.observation.completedTaskIds) ? saved.observation.completedTaskIds : [],
                    chatMessages: Array.isArray(saved.observation.chatMessages) ? saved.observation.chatMessages : [],
                    matchedPeer: saved.observation.matchedPeer
                        ? { ...(DEMO_MEMBERS.find((member) => member.name === saved.observation.matchedPeer.name) || {}), ...saved.observation.matchedPeer, focus: saved.observation.matchedPeer.focus ?? saved.observation.matchedPeer.rating ?? DEMO_MEMBERS.find((member) => member.name === saved.observation.matchedPeer.name)?.focus ?? 5, id: saved.observation.matchedPeer.id || DEMO_MEMBERS.find((member) => member.name === saved.observation.matchedPeer.name)?.id || 'casey' }
                        : null
                }
                : base.observation
        };
    } catch {
        return initialState();
    }
}

let state = loadState();
let timerHandle = null;
let toastHandle = null;
let onboardingStep = 1;

const $ = (selector) => document.querySelector(selector);
const taskList = $('#task-list');

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function observationDeadline() {
    return state.observation.startedAt + OBSERVATION_DAYS * DAY_MS;
}

function calculateAttentionRating() {
    const observation = state.observation;
    const sessionScore = observation.startedSessions
        ? (observation.completedSessions / observation.startedSessions) * 10
        : 5;
    const observedStartDate = localDateString(new Date(observation.startedAt));
    const observedEndDate = localDateString(new Date(observationDeadline()));
    const eligibleTasks = state.tasks.filter((task) => {
        const targetDate = task.targetDate || task.due;
        const observedCompletion = observation.completedTaskIds.includes(task.id);
        return targetDate >= observedStartDate && targetDate <= observedEndDate && (!task.done || observedCompletion);
    });
    const completedEligibleTasks = eligibleTasks.filter((task) => observation.completedTaskIds.includes(task.id));
    const assignmentScore = eligibleTasks.length
        ? (completedEligibleTasks.length / eligibleTasks.length) * 10
        : observation.completedTaskIds.length ? 10 : 5;
    const observedFocusTime = observation.focusSeconds + observation.awaySeconds;
    const presenceScore = observedFocusTime
        ? (1 - observation.awaySeconds / observedFocusTime) * 10
        : 5;
    const score = sessionScore * 0.4 + assignmentScore * 0.3 + presenceScore * 0.3;
    return Math.max(1, Math.min(10, Math.round(score)));
}

function bestDemoPeer(rating) {
    const interests = [...state.interests, ...state.subjects].map((item) => item.toLowerCase());
    return [...DEMO_MEMBERS].sort((first, second) => {
        const firstOverlap = first.subjects.filter((item) => interests.includes(item.toLowerCase())).length;
        const secondOverlap = second.subjects.filter((item) => interests.includes(item.toLowerCase())).length;
        return Math.abs(first.focus - rating) - Math.abs(second.focus - rating) || secondOverlap - firstOverlap;
    })[0];
}

function finishObservationIfReady() {
    const observation = state.observation;
    if (Date.now() < observationDeadline()) return false;
    if (!observation.matchedAt) {
        observation.finalRating = calculateAttentionRating();
        state.attention = observation.finalRating;
        observation.matchedPeer = bestDemoPeer(observation.finalRating);
        observation.matchedAt = Date.now();
        saveState();
    }
    return true;
}

function closeObservedAwayPeriod() {
    const observation = state.observation;
    if (!observation.awayStartedAt) return;
    observation.awaySeconds += Math.max(0, Math.floor((Date.now() - observation.awayStartedAt) / 1000));
    observation.interruptionCount += 1;
    observation.awayStartedAt = 0;
}

function localDateString(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function dayDifference(isoDate) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(`${isoDate}T00:00:00`);
    return Math.round((due - today) / DAY_MS);
}

function dueLabel(isoDate) {
    const difference = dayDifference(isoDate);
    if (difference < 0) return `Overdue ${Math.abs(difference)}d`;
    if (difference === 0) return 'Due today';
    if (difference === 1) return 'Due tomorrow';
    if (difference < 7) return `Due in ${difference} days`;
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${isoDate}T00:00:00`));
}

function isUrgent(task) {
    return dayDifference(task.due) <= 1;
}

function interestMatches(task) {
    const haystack = `${task.title} ${task.subject}`.toLowerCase();
    return [...state.interests, ...state.subjects].some((interest) => {
        const term = interest.toLowerCase();
        return term.length > 1 && (haystack.includes(term) || term.includes(task.subject.toLowerCase()));
    });
}

let currentFocusIndex = 0;

function prioritizedTasks() {
    return [...state.tasks].sort((first, second) => {
        if (first.done !== second.done) return first.done ? 1 : -1;
        if (first.done) return first.due.localeCompare(second.due);
        
        const firstPri = getPriorityRank(getTaskPriority(first));
        const secondPri = getPriorityRank(getTaskPriority(second));
        if (firstPri !== secondPri) return firstPri - secondPri;

        const firstUrgent = isUrgent(first);
        const secondUrgent = isUrgent(second);
        if (firstUrgent !== secondUrgent) return firstUrgent ? -1 : 1;

        const firstMatches = interestMatches(first);
        const secondMatches = interestMatches(second);
        if (firstMatches !== secondMatches) return firstMatches ? -1 : 1;

        return first.due.localeCompare(second.due);
    });
}

function renderSingleFocusTask(activeTasks) {
    const container = $('#single-focus-view');
    if (!container) return;
    container.replaceChildren();

    if (!activeTasks || activeTasks.length === 0) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'single-task-empty';
        emptyCard.innerHTML = `
            <span class="empty-icon">✓</span>
            <h3>All caught up!</h3>
            <p>You cleared all high, medium, and low priority activities for today.</p>
            <button class="outline-button" id="focus-empty-schedule-btn" type="button" style="width: auto; padding: 0 16px;">View full schedule</button>
        `;
        emptyCard.querySelector('#focus-empty-schedule-btn')?.addEventListener('click', () => {
            window.location.hash = '#schedule';
            setActiveView('schedule');
        });
        container.append(emptyCard);

        const queueDetails = $('#focus-queue-details');
        if (queueDetails) queueDetails.hidden = true;

        $('#next-task-title').textContent = 'Your list is clear. Take a breath.';
        $('#next-task-description').textContent = 'You made space for the things that matter.';
        $('#start-focus').disabled = true;
        $('#start-focus').classList.add('is-disabled');
        return;
    }

    if (currentFocusIndex >= activeTasks.length || currentFocusIndex < 0) {
        currentFocusIndex = 0;
    }

    const task = activeTasks[currentFocusIndex];
    const priority = getTaskPriority(task);
    const isTestOrAssignment = task.source === 'canvas' || isAssignmentOrTest(task);

    const card = document.createElement('article');
    card.className = `single-task-card priority-${priority}`;

    const topbar = document.createElement('div');
    topbar.className = 'single-task-topbar';

    const stepIndicator = document.createElement('span');
    stepIndicator.className = 'single-task-step';
    stepIndicator.textContent = `Activity ${currentFocusIndex + 1} of ${activeTasks.length} remaining`;

    const priorityTag = document.createElement('span');
    priorityTag.className = `priority-tag priority-${priority}`;
    if (priority === 'high') {
        priorityTag.textContent = `🔴 High${isTestOrAssignment ? ' · Assignment / Test' : ''}`;
    } else if (priority === 'medium') {
        priorityTag.textContent = '🟡 Medium · Core Study';
    } else {
        priorityTag.textContent = '🟢 Low · Gentle';
    }

    topbar.append(stepIndicator, priorityTag);

    const main = document.createElement('div');
    main.className = 'single-task-main';

    const title = document.createElement('h3');
    title.className = 'single-task-title';
    title.textContent = task.title;

    const meta = document.createElement('div');
    meta.className = 'single-task-meta';

    const subject = document.createElement('span');
    subject.textContent = task.subject || 'Study';

    const due = document.createElement('span');
    const targetDate = task.targetDate || task.due;
    due.textContent = !isUrgent(task) && targetDate < task.due
        ? `Aim for ${formatShortDate(targetDate)} · actual due ${formatShortDate(task.due)}`
        : dueLabel(task.due);

    const duration = document.createElement('span');
    duration.textContent = `${task.minutes || 30} min`;

    meta.append(subject, due, duration);
    main.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'single-task-actions';

    const completeBtn = document.createElement('button');
    completeBtn.className = 'single-task-complete-btn';
    completeBtn.type = 'button';
    completeBtn.textContent = '✓ Mark complete & advance';
    completeBtn.addEventListener('click', () => {
        toggleTask(task.id);
        if (currentFocusIndex >= activeTasks.length - 1) {
            currentFocusIndex = 0;
        }
    });

    actions.append(completeBtn);

    if (activeTasks.length > 1) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'single-task-skip-btn';
        nextBtn.type = 'button';
        nextBtn.textContent = 'Next in queue →';
        nextBtn.addEventListener('click', () => {
            currentFocusIndex = (currentFocusIndex + 1) % activeTasks.length;
            renderTasks();
        });
        actions.append(nextBtn);
    }

    card.append(topbar, main, actions);
    container.append(card);

    $('#next-task-title').textContent = task.title;
    $('#next-task-description').textContent = `${task.subject} · ${dueLabel(task.due)} · ${task.minutes || 30} min`;
    $('#start-focus').disabled = false;
    $('#start-focus').classList.remove('is-disabled');

    const queueDetails = $('#focus-queue-details');
    const queueLabel = $('#focus-queue-label');
    const queueList = $('#focus-task-list');
    if (queueDetails && queueList) {
        const upcomingTasks = activeTasks.filter((_, idx) => idx !== currentFocusIndex);
        if (upcomingTasks.length > 0) {
            queueDetails.hidden = false;
            if (queueLabel) queueLabel.textContent = `Upcoming queue (${upcomingTasks.length})`;
            renderTaskRows(queueList, upcomingTasks);
        } else {
            queueDetails.hidden = true;
        }
    }
}

function renderSchedulePriorityGroups() {
    const container = $('#schedule-priority-container');
    if (!container) return;
    container.replaceChildren();

    const tasks = prioritizedTasks();
    const incomplete = tasks.filter((t) => !t.done);
    const highTasks = incomplete.filter((t) => getTaskPriority(t) === 'high');
    const medTasks = incomplete.filter((t) => getTaskPriority(t) === 'medium');
    const lowTasks = incomplete.filter((t) => getTaskPriority(t) === 'low');

    const groups = [
        {
            key: 'high',
            label: 'High Priority (Assignments & Tests)',
            emoji: '🔴',
            tasks: highTasks
        },
        {
            key: 'medium',
            label: 'Medium Priority (Core Study)',
            emoji: '🟡',
            tasks: medTasks
        },
        {
            key: 'low',
            label: 'Low Priority (Gentle & Extra)',
            emoji: '🟢',
            tasks: lowTasks
        }
    ];

    for (const group of groups) {
        const groupEl = document.createElement('section');
        groupEl.className = `schedule-group schedule-group-${group.key}`;

        const header = document.createElement('div');
        header.className = 'schedule-group-header';

        const title = document.createElement('div');
        title.className = 'schedule-group-title';
        title.innerHTML = `<span>${group.emoji}</span> <span>${group.label}</span>`;

        const count = document.createElement('span');
        count.className = 'schedule-group-count';
        count.textContent = `${group.tasks.length}`;

        header.append(title, count);
        groupEl.append(header);

        const list = document.createElement('div');
        list.className = 'task-list';
        if (group.tasks.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'prototype-note';
            empty.style.margin = '4px 0 8px';
            empty.style.color = '#a8a29e';
            empty.textContent = `No ${group.key} priority activities right now.`;
            list.append(empty);
        } else {
            renderTaskRows(list, group.tasks);
        }
        groupEl.append(list);
        container.append(groupEl);
    }

    const completedTasks = tasks.filter((t) => t.done);
    const completedDetails = $('#more-tasks');
    const completedList = $('#later-task-list');
    if (completedDetails && completedList) {
        completedDetails.hidden = completedTasks.length === 0;
        $('#more-tasks-label').textContent = `Completed work (${completedTasks.length})`;
        renderTaskRows(completedList, completedTasks);
    }
}

function renderTasks() {
    const tasks = prioritizedTasks();
    const activeTasks = tasks.filter((task) => !task.done);
    renderSingleFocusTask(activeTasks);
    renderSchedulePriorityGroups();
}

function renderTaskRows(container, tasks) {
    if (!container) return;
    container.replaceChildren();
    for (const [index, task] of tasks.entries()) {
        const row = document.createElement('article');
        row.className = `task-row${task.done ? ' done' : ''}`;
        row.style.animationDelay = `${index * 35}ms`;

        const check = document.createElement('button');
        check.className = 'task-check';
        check.type = 'button';
        check.setAttribute('aria-label', task.done ? `Mark ${task.title} incomplete` : `Complete ${task.title}`);
        check.textContent = '✓';
        check.addEventListener('click', () => toggleTask(task.id));

        const info = document.createElement('div');
        info.className = 'task-info';
        const title = document.createElement('div');
        title.className = 'task-title';
        title.textContent = task.title;
        const meta = document.createElement('div');
        meta.className = 'task-meta';
        const subject = document.createElement('span');
        subject.className = 'task-subject';
        subject.textContent = task.subject || 'Study';
        const due = document.createElement('span');
        const targetDate = task.targetDate || task.due;
        due.textContent = !isUrgent(task) && targetDate < task.due
            ? `Aim for ${formatShortDate(targetDate)} · actual due ${formatShortDate(task.due)}`
            : dueLabel(task.due);
        meta.append(subject, document.createTextNode('·'), due);
        info.append(title, meta);

        const priority = getTaskPriority(task);
        const badge = document.createElement('span');
        const urgent = isUrgent(task);
        badge.className = `task-badge priority-${priority}${urgent ? ' urgent' : ''}`;
        badge.textContent = priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low';
        row.append(check, info, badge);
        container.append(row);
    }
}

function renderNextTask() {
    const activeTasks = prioritizedTasks().filter((t) => !t.done);
    renderSingleFocusTask(activeTasks);
}

function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastHandle);
    toastHandle = setTimeout(() => toast.classList.remove('show'), 3200);
}

function markActivity() {
    const today = localDateString(new Date());
    if (state.lastActiveDate !== today) {
        const yesterday = localDateString(new Date(Date.now() - DAY_MS));
        state.streak = state.lastActiveDate === yesterday ? state.streak + 1 : 1;
        state.lastActiveDate = today;
    }
}

function toggleTask(id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    task.done = !task.done;
    if (task.done) {
        if (!state.observation.completedTaskIds.includes(task.id)) state.observation.completedTaskIds.push(task.id);
        if (state.mode === 'locked') {
            state.points += 10;
            markActivity();
            showToast('Task complete. +10 focus points for showing up.');
        } else {
            showToast('Task complete. Nice work showing up.');
        }
    } else {
        state.observation.completedTaskIds = state.observation.completedTaskIds.filter((taskId) => taskId !== task.id);
    }
    saveState();
    renderAll();
}

function setMode(mode) {
    state.mode = mode;
    if (mode !== 'locked') state.unlockedUntil = 0;
    saveState();
    renderAll();
}

function isTemporarilyUnlocked() {
    const rewardActive = state.rewardDate === localDateString(new Date()) && state.tasks.length > 0 && state.tasks.every((task) => task.done);
    return state.mode === 'locked' && !isOnBreak() && (state.unlockedUntil > Date.now() || rewardActive);
}

function isOnBreak() {
    return state.timerKind === 'break' && state.timerRemaining > 0;
}

function renderLock() {
    const locked = state.mode === 'locked';
    const temporary = isTemporarilyUnlocked();
    const quickUnlockActive = state.unlockedUntil > Date.now() && !isOnBreak();
    const rewardActive = state.rewardDate === localDateString(new Date()) && state.tasks.length > 0 && state.tasks.every((task) => task.done) && !isOnBreak();
    const indicator = $('#mode-indicator');
    indicator.classList.toggle('locked', locked);
    indicator.innerHTML = `<i></i> ${locked ? 'Locked In mode' : 'Casual mode'}`;
    $('#reward-lock-note').textContent = locked ? 'Locked In rewards: tasks +10 · focus session +15.' : 'Rewards are part of Locked In mode.';
    $('#lock-state-dot').className = `lock-state-dot${locked && !temporary ? ' on' : temporary ? ' temp' : ''}`;
    $('#lock-state-text').textContent = locked ? rewardActive ? 'Daily reward active' : quickUnlockActive ? 'Quick unlock active' : 'Locked In preview is on' : 'Casual mode · no app blocking';
    const lockAction = $('#lock-action');
    lockAction.textContent = locked ? 'Disable Locked In' : 'Set up Locked In';
    lockAction.setAttribute('aria-pressed', String(locked));
    const quickUnlock = $('#unlock-duration');
    quickUnlock.disabled = !locked || isOnBreak();
    $('#quick-unlock-button').disabled = !locked || isOnBreak();
    const dayRewardButton = $('#day-reward-button');
    const allTasksDone = state.tasks.length > 0 && state.tasks.every((task) => task.done);
    dayRewardButton.hidden = !locked;
    dayRewardButton.disabled = !allTasksDone || isOnBreak();
    dayRewardButton.textContent = state.rewardDate === localDateString(new Date()) && allTasksDone
        ? 'Today’s reward is active'
        : allTasksDone ? 'Unlock apps for today' : 'Finish today’s plan to unlock apps';
    if (!locked) {
        $('#unlock-status').textContent = 'Choose Locked In to preview temporary unlocks.';
    } else if (isOnBreak()) {
        $('#unlock-status').textContent = 'Quick unlock is unavailable during a break.';
    } else if (state.rewardDate === localDateString(new Date()) && allTasksDone) {
        $('#unlock-status').textContent = 'Your daily reward is active. Breaks still keep distractions locked.';
    } else if (temporary) {
        const seconds = Math.ceil((state.unlockedUntil - Date.now()) / 1000);
        $('#unlock-status').textContent = `Preview unlock ends in ${Math.ceil(seconds / 60)} min. It will relock automatically.`;
    } else {
        $('#unlock-status').textContent = 'Apps remain locked during work. This preview does not control other apps.';
    }
}

function renderRewards() {
    $('#points-total').textContent = state.mode === 'locked' ? state.points : '—';
    $('#reward-streak').textContent = state.mode === 'locked' ? state.streak : '—';
    $('#sidebar-streak').textContent = `${state.mode === 'locked' ? state.streak : 0} day streak`;
    const progress = state.mode === 'locked' ? state.points % 60 : 0;
    $('#reward-progress-fill').style.width = `${(progress / 60) * 100}%`;
    $('#reward-progress-label').textContent = state.mode !== 'locked' ? 'Locked In to earn focus points' : state.points >= 60 ? (progress === 0 ? 'A reward is ready to claim' : `${60 - progress} points to your next reward`) : `${state.points} / 60 to your first reward`;
}

function renderTimer() {
    const minutes = Math.floor(state.timerRemaining / 60).toString().padStart(2, '0');
    const seconds = (state.timerRemaining % 60).toString().padStart(2, '0');
    const onBreak = state.timerKind === 'break';
    $('#timer-display').textContent = `${minutes}:${seconds}`;
    $('#timer-caption').textContent = onBreak ? 'BREAK' : 'FOCUS';
    $('#timer-ring')?.classList.toggle('break', onBreak);
    $('.timer-ring').classList.toggle('break', onBreak);
    $('#timer-mode-label').textContent = `${onBreak ? state.breakMinutes : state.workMinutes} min ${onBreak ? 'break' : 'focus'}`;
    $('#timer-cycle').textContent = `SESSION ${state.sessionCount} OF 4`;
    $('#timer-toggle').textContent = timerHandle ? 'Ⅱ Pause' : onBreak ? '▶ Resume break' : '▶ Start focus';
    $('#timer-message').textContent = onBreak ? 'Step away. You have earned a few quiet minutes.' : 'A small, protected pocket of time.';
    $('#break-lock-note').hidden = !onBreak || state.timerRemaining <= 0;
    document.querySelectorAll('.preset').forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.work) === state.workMinutes);
    });
    renderLock();
}

function renderProfile() {
    const name = state.name?.trim() || 'Student';
    $('#profile-name').textContent = name;
    $('#welcome-title').innerHTML = `Good morning, <span class="welcome-name"></span><span>.</span>`;
    $('.welcome-name').textContent = name;
    document.querySelectorAll('.avatar').forEach((el) => { el.textContent = name.charAt(0).toUpperCase(); });
    const now = new Date();
    const format = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now).toUpperCase();
    $('.breadcrumb').innerHTML = `${format}<span class="top-dot"> · </span>YOUR STUDY SPACE`;
    $('.date-stamp .date-day').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(now).toUpperCase();
    $('.date-stamp strong').textContent = now.getDate().toString().padStart(2, '0');
    $('.date-stamp>span:last-child').textContent = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(now).toUpperCase();
}

function lockedInHours(period) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayLimits = { daily: 1, weekly: 7, monthly: 30 };
    const limit = dayLimits[period];
    const totalSeconds = Object.entries(state.focusSecondsByDay).reduce((total, [day, seconds]) => {
        if (limit) {
            const recorded = new Date(`${day}T00:00:00`);
            const age = Math.floor((today - recorded) / DAY_MS);
            if (age < 0 || age >= limit) return total;
        }
        return total + Math.max(0, Number(seconds) || 0);
    }, 0);
    return totalSeconds / 3600;
}

function buildProfileMetrics(profile, period, privacy = {}) {
    return [
        { label: 'Focus level', value: privacy.focus === false ? 'Private' : `${profile.focus}/10`, hidden: privacy.focus === false },
        { label: 'Study level', value: privacy.level === false ? 'Private' : profile.level, hidden: privacy.level === false },
        { label: `${period === 'all' ? 'All-time' : period[0].toUpperCase() + period.slice(1)} locked-in hours`, value: privacy.hours === false ? 'Private' : `${profile.hours.toFixed(1)}h`, hidden: privacy.hours === false },
        { label: 'Interests & subjects', value: privacy.interests === false ? 'Private' : profile.subjects.join(', ') || 'Not added', hidden: privacy.interests === false }
    ];
}

function makeMetric(label, value, className = '') {
    const item = document.createElement('div');
    item.className = `profile-metric${className ? ` ${className}` : ''}`;
    const title = document.createElement('span');
    title.textContent = label;
    const detail = document.createElement('strong');
    detail.textContent = value;
    item.append(title, detail);
    return item;
}

function profileForId(id) {
    if (!id || id === 'me') {
        return {
            id: 'me', name: state.name || 'Student', focus: state.attention,
            level: state.studyLevel || 'Undergraduate', subjects: [...state.interests, ...state.subjects],
            hours: lockedInHours('all'), privacy: state.profilePrivacy, isSelf: true
        };
    }
    const member = DEMO_MEMBERS.find((person) => person.id === id);
    return member ? { ...member, hours: member.hours.all, privacy: {}, isSelf: false } : null;
}

function renderMemberProfile(id) {
    const profile = profileForId(id);
    const card = $('#member-profile-card');
    card.replaceChildren();
    if (!profile) {
        $('#profile-page-title').textContent = 'Profile not found';
        $('#profile-page-subtitle').textContent = 'That member profile is unavailable.';
        $('#profile-settings').hidden = true;
        return;
    }
    $('#profile-page-title').textContent = profile.isSelf ? 'My profile' : `${profile.name}'s profile`;
    $('#profile-page-subtitle').textContent = profile.isSelf ? 'Only the information you choose is shared in people search.' : 'Member profile · sample data';
    $('#profile-settings').hidden = !profile.isSelf;

    const header = document.createElement('header');
    header.className = 'member-profile-header';
    const avatar = document.createElement('span');
    avatar.className = 'member-profile-avatar';
    avatar.textContent = profile.name.charAt(0).toUpperCase();
    const identity = document.createElement('div');
    identity.className = 'member-profile-identity';
    const name = document.createElement('h2');
    name.textContent = profile.name;
    const profilePrivacy = profile.isSelf ? {} : profile.privacy;
    const level = document.createElement('p');
    level.textContent = profilePrivacy.level === false ? 'Study level private' : profile.level;
    identity.append(name, level);
    header.append(avatar, identity);
    card.append(header);

    const metricGrid = document.createElement('div');
    metricGrid.className = 'profile-metrics-grid';
    for (const metric of buildProfileMetrics(profile, 'all', profilePrivacy)) {
        metricGrid.append(makeMetric(metric.label, metric.value, metric.hidden ? 'is-private' : ''));
    }
    card.append(metricGrid);

    if (profile.isSelf) {
        for (const field of ['discoverable', 'focus', 'level', 'hours', 'interests']) {
            $(`#privacy-${field}`).checked = Boolean(state.profilePrivacy[field]);
        }
        $('#profile-study-level').value = state.studyLevel || 'Undergraduate';
    }
}

let leaderboardPeriod = 'daily';

function leaderboardMembers() {
    const people = DEMO_MEMBERS.map((member) => ({
        ...member,
        privacy: { focus: true, level: true, hours: true, interests: true },
        isSelf: false,
        hours: member.hours[leaderboardPeriod]
    }));
    if (state.profilePrivacy.discoverable) {
        people.push({
            id: 'me', name: state.name || 'Student', focus: state.attention,
            level: state.studyLevel || 'Undergraduate', subjects: [...state.interests, ...state.subjects],
            hours: lockedInHours(leaderboardPeriod), privacy: state.profilePrivacy, isSelf: true
        });
    }
    return people;
}

function renderLeaderboard() {
    const list = $('#leaderboard-list');
    if (!list) return;
    const query = $('#people-search').value.trim().toLowerCase();
    const sortBy = $('#leaderboard-sort').value;
    const sortPrivacyField = sortBy === 'focus' ? 'focus' : 'hours';
    $('#leaderboard-caption').textContent = `Ranked by ${sortBy === 'focus' ? 'focus level' : 'locked-in hours'} · ${leaderboardPeriod === 'all' ? 'all time' : leaderboardPeriod}`;
    const people = leaderboardMembers().filter((person) => {
        const searchable = [person.name, person.privacy.level === false ? '' : person.level, ...(person.privacy.interests === false ? [] : person.subjects)].join(' ').toLowerCase();
        return searchable.includes(query);
    }).sort((first, second) => {
        const firstHidden = first.privacy[sortPrivacyField] === false;
        const secondHidden = second.privacy[sortPrivacyField] === false;
        if (firstHidden !== secondHidden) return firstHidden ? 1 : -1;
        const firstValue = sortBy === 'focus' ? first.focus : first.hours;
        const secondValue = sortBy === 'focus' ? second.focus : second.hours;
        return secondValue - firstValue || first.name.localeCompare(second.name);
    });
    list.replaceChildren();
    if (!people.length) {
        const empty = document.createElement('p');
        empty.className = 'people-empty';
        empty.textContent = 'No visible profiles match that search.';
        list.append(empty);
        return;
    }
    people.forEach((person, index) => {
        const link = document.createElement('a');
        link.className = `leaderboard-row${person.isSelf ? ' own-leaderboard-row' : ''}`;
        link.href = `#profile/${person.id}`;
        const rank = document.createElement('span');
        rank.className = 'leaderboard-rank';
        rank.textContent = String(index + 1).padStart(2, '0');
        const avatar = document.createElement('span');
        avatar.className = 'leaderboard-avatar';
        avatar.textContent = person.name.charAt(0).toUpperCase();
        const identity = document.createElement('span');
        identity.className = 'leaderboard-identity';
        const personName = document.createElement('strong');
        personName.textContent = person.isSelf ? `${person.name} · You` : person.name;
        const personInfo = document.createElement('small');
        personInfo.textContent = person.privacy.level === false ? 'Study level private' : person.level;
        identity.append(personName, personInfo);
        const focus = document.createElement('span');
        focus.className = 'leaderboard-stat';
        focus.innerHTML = '<small>FOCUS</small>';
        const focusValue = document.createElement('strong');
        focusValue.textContent = person.privacy.focus === false ? 'Private' : `${person.focus}/10`;
        focus.append(focusValue);
        const hours = document.createElement('span');
        hours.className = 'leaderboard-stat hours-stat';
        hours.innerHTML = `<small>${leaderboardPeriod === 'all' ? 'ALL TIME' : leaderboardPeriod.toUpperCase()}</small>`;
        const hoursValue = document.createElement('strong');
        hoursValue.textContent = person.privacy.hours === false ? 'Private' : `${person.hours.toFixed(1)}h`;
        hours.append(hoursValue);
        link.append(rank, avatar, identity, focus, hours);
        list.append(link);
    });
}

function renderSelectedProfile() {
    const route = window.location.hash.slice(1);
    const id = route.startsWith('profile/') ? decodeURIComponent(route.slice('profile/'.length)) : 'me';
    renderMemberProfile(id);
}

function renderAttention() {
    const observation = state.observation;
    const ready = finishObservationIfReady();
    if (!ready) state.attention = calculateAttentionRating();
    $('#attention-value').textContent = state.attention;
    const moods = ['A gentle start', 'Finding your way', 'Getting settled', 'Warming up', 'Building focus', 'In the zone', 'Pretty tuned in', 'Really present', 'Deep focus', 'Fully absorbed'];
    $('#attention-mood').textContent = moods[state.attention - 1] || moods[6];
    const elapsed = Math.max(0, Math.min(1, (Date.now() - observation.startedAt) / (OBSERVATION_DAYS * DAY_MS || 1)));
    const progress = OBSERVATION_DAYS === 0 ? 100 : Math.round(elapsed * 100);
    $('.observation-progress').setAttribute('aria-valuenow', progress);
    $('#observation-progress-fill').style.width = `${progress}%`;
    $('#observed-minutes').textContent = Math.floor(observation.focusSeconds / 60);
    $('#observed-sessions').textContent = observation.completedSessions;
    $('#observed-tasks').textContent = observation.completedTaskIds.length;
    $('#observed-away').textContent = observation.interruptionCount;
    if (ready && observation.matchedPeer) {
        $('#observation-status').textContent = 'Observation complete. Your focus profile is ready.';
        $('#match-result').textContent = `Demo match: ${observation.matchedPeer.name} · ${observation.matchedPeer.focus}/10 focus · Live matching requires a connected service.`;
        $('#matched-member-link-row').hidden = false;
        $('#matched-member-name-link').textContent = `View ${observation.matchedPeer.name}'s profile`;
        $('#matched-member-name-link').href = `#profile/${observation.matchedPeer.id}`;
        $('#matched-buddy-profile-link').href = `#profile/${observation.matchedPeer.id}`;
        $('#matched-buddy-profile-link').textContent = 'View profile →';
        $('#open-partner-chat').hidden = false;
        $('#matched-buddy-summary').textContent = `${observation.matchedPeer.name} · ${observation.matchedPeer.focus}/10 focus · ${observation.matchedPeer.level}`;
    } else {
        const remainingMs = Math.max(0, observationDeadline() - Date.now());
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        $('#observation-status').textContent = `Learning your rhythm · ${remainingHours}h until matching is available.`;
        $('#match-result').textContent = 'Your match appears automatically when observation is complete.';
        $('#matched-member-link-row').hidden = true;
        $('#open-partner-chat').hidden = true;
        $('#matched-buddy-summary').textContent = 'Your match appears after observation is complete.';
        $('#matched-buddy-profile-link').href = '#people';
        $('#matched-buddy-profile-link').textContent = 'Browse profiles →';
    }
    renderPartnerChat();
}

function renderPartnerChat() {
    const peer = state.observation.matchedPeer;
    const available = Boolean(peer && state.observation.matchedAt);
    $('#partner-chat-label').textContent = available ? 'DEMO PARTNER' : 'MATCH PENDING';
    $('#partner-avatar-link').textContent = peer?.name?.charAt(0) || '?';
    $('#partner-name').textContent = available ? peer.name : 'Waiting for your focus match';
    $('#partner-presence').textContent = available ? `${peer.focus}/10 focus · ${peer.level} · shared study rhythm` : 'Your conversation will appear here when matching is ready.';
    const profileHref = available ? `#profile/${peer.id}` : '#people';
    $('#partner-avatar-link').href = profileHref;
    $('#partner-name-link').href = profileHref;
    $('#partner-connection-label').textContent = available ? 'Demo match' : 'Not connected';
    $('.demo-connection').classList.toggle('connected', available);
    $('#partner-chat-input').disabled = !available;
    $('#partner-chat-form button').disabled = !available;

    const messages = $('#partner-chat-messages');
    messages.replaceChildren();
    if (!available) {
        const empty = document.createElement('div');
        empty.className = 'partner-chat-empty';
        empty.textContent = 'Once your observation period ends, your matched study partner will show up here.';
        messages.append(empty);
        return;
    }
    if (!state.observation.chatMessages.length) {
        state.observation.chatMessages.push({
            id: 'demo-greeting',
            from: 'partner',
            text: `Hey ${state.name || 'there'}! We got matched for a study session. What are you working on today?`,
            createdAt: state.observation.matchedAt
        });
        saveState();
    }
    for (const message of state.observation.chatMessages) appendPartnerMessage(message);
    messages.scrollTop = messages.scrollHeight;
}

function appendPartnerMessage(message) {
    const peer = state.observation.matchedPeer;
    const row = document.createElement('article');
    row.className = `partner-message${message.from === 'you' ? ' own-message' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = 'partner-message-avatar';
    avatar.textContent = message.from === 'you' ? (state.name || 'Y').charAt(0).toUpperCase() : peer?.name?.charAt(0) || '?';
    const body = document.createElement('div');
    body.className = 'partner-message-body';
    const sender = document.createElement('strong');
    sender.textContent = message.from === 'you' ? 'You' : `${peer?.name || 'Partner'} · demo`;
    const text = document.createElement('p');
    text.textContent = message.text;
    const time = document.createElement('time');
    time.dateTime = new Date(message.createdAt).toISOString();
    time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt));
    body.append(sender, text, time);
    row.append(avatar, body);
    $('#partner-chat-messages').append(row);
}

function sendPartnerMessage(event) {
    event.preventDefault();
    const input = $('#partner-chat-input');
    const text = input.value.trim();
    if (!text || !state.observation.matchedPeer) return;
    state.observation.chatMessages.push({ id: `message-${Date.now()}`, from: 'you', text, createdAt: Date.now() });
    input.value = '';
    saveState();
    renderPartnerChat();
    setTimeout(() => {
        const replies = [
            'That sounds like a good plan. What is the first small step you want to tackle?',
            'I am working on something similar. Want to check in again after one focus session?',
            'Nice, I am cheering you on. Let us both get one thing done.'
        ];
        state.observation.chatMessages.push({
            id: `reply-${Date.now()}`,
            from: 'partner',
            text: replies[state.observation.chatMessages.filter((message) => message.from === 'you').length % replies.length],
            createdAt: Date.now()
        });
        saveState();
        renderPartnerChat();
    }, 650);
}

function renderAll() {
    renderProfile();
    renderTasks();
    renderTimer();
    renderRewards();
    renderAttention();
}

function openOnboarding(step = 1) {
    onboardingStep = step;
    $('#onboarding').hidden = false;
    $('#name-input').value = state.name === 'Sam' && !state.onboarded ? '' : state.name;
    $('#subjects-input').value = state.subjects.join(', ');
    document.querySelectorAll('#interest-options input').forEach((input) => {
        input.checked = state.interests.includes(input.value);
    });
    document.querySelector(`input[name="mode"][value="${state.mode}"]`).checked = true;
    showOnboardingStep(step);
    if (step === 1) $('#name-input').focus();
}

function showOnboardingStep(step) {
    onboardingStep = step;
    document.querySelectorAll('.onboarding-step').forEach((section) => {
        section.hidden = Number(section.dataset.step) !== step;
    });
    $('#step-count').textContent = `0${step} / 02`;
    $('#onboarding-progress').style.width = step === 1 ? '50%' : '100%';
    if (step === 2) document.querySelector('input[name="mode"]:checked')?.focus();
}

function openTaskModal() {
    const modal = $('#task-modal');
    if (!modal) return;
    modal.hidden = false;
    $('#task-title-input').value = '';
    $('#task-subject-input').value = 'Study';
    $('#task-due-input').value = dateAfter(3);
    const highRadio = document.querySelector('input[name="task-priority"][value="high"]');
    if (highRadio) highRadio.checked = true;
    updatePriorityLock(false);
    $('#task-title-input').focus();
}

function closeTaskModal() {
    const modal = $('#task-modal');
    if (modal) modal.hidden = true;
}

function updatePriorityLock(isAutoHigh) {
    const medRadio = document.querySelector('input[name="task-priority"][value="medium"]');
    const lowRadio = document.querySelector('input[name="task-priority"][value="low"]');
    const highRadio = document.querySelector('input[name="task-priority"][value="high"]');
    const autoNote = $('#priority-auto-note');

    if (isAutoHigh) {
        if (highRadio) highRadio.checked = true;
        if (medRadio) medRadio.disabled = true;
        if (lowRadio) lowRadio.disabled = true;
        if (autoNote) {
            autoNote.textContent = '⚡ Detected assignment or test — automatically locked to High priority.';
            autoNote.style.color = 'var(--orange-dark)';
        }
    } else {
        if (medRadio) medRadio.disabled = false;
        if (lowRadio) lowRadio.disabled = false;
        if (autoNote) {
            autoNote.textContent = '⚡ All assignments and tests are always automatically placed in High priority.';
            autoNote.style.color = '#78716c';
        }
    }
}

function addTask() {
    openTaskModal();
}

function startTimer() {
    if (timerHandle) {
        clearInterval(timerHandle);
        timerHandle = null;
        renderTimer();
        return;
    }
    if (!isOnBreak() && state.mode === 'locked') {
        $('#unlock-status').textContent = 'Locked In preview is ready. Real blocking needs a supported app and permissions.';
    }
    if (!isOnBreak()) {
        if (!state.currentSessionStarted) {
            state.observation.startedSessions += 1;
            state.currentSessionStarted = true;
        }
        markActivity();
    }
    timerHandle = setInterval(() => {
        if (state.timerKind === 'work' && document.visibilityState === 'visible') {
            state.observation.focusSeconds += 1;
            if (state.mode === 'locked') {
                const today = localDateString(new Date());
                state.focusSecondsByDay[today] = (Number(state.focusSecondsByDay[today]) || 0) + 1;
            }
        }
        if (state.timerRemaining > 0) state.timerRemaining -= 1;
        if (state.timerRemaining <= 0) finishTimerPhase();
        saveState();
        renderTimer();
        renderAttention();
    }, 1000);
    renderTimer();
}

function finishTimerPhase() {
    clearInterval(timerHandle);
    timerHandle = null;
    if (state.timerKind === 'work') {
        state.observation.completedSessions += 1;
        state.currentSessionStarted = false;
        state.completedSessions += 1;
        state.sessionCount = ((state.sessionCount) % 4) + 1;
        if (state.mode === 'locked') {
            state.points += 15;
            markActivity();
        }
        state.timerKind = 'break';
        state.timerRemaining = state.breakMinutes * 60;
        state.unlockedUntil = 0;
        showToast(state.mode === 'locked' ? 'Focus session complete. +15 points. Break time.' : 'Focus session complete. Break time.');
    } else {
        state.timerKind = 'work';
        state.timerRemaining = state.workMinutes * 60;
        showToast('Break complete. Ready when you are.');
    }
    saveState();
}

function resetTimer() {
    clearInterval(timerHandle);
    timerHandle = null;
    state.currentSessionStarted = false;
    state.timerKind = 'work';
    state.timerRemaining = state.workMinutes * 60;
    saveState();
    renderTimer();
}

function choosePreset(button) {
    clearInterval(timerHandle);
    timerHandle = null;
    state.currentSessionStarted = false;
    state.workMinutes = Number(button.dataset.work);
    state.breakMinutes = Number(button.dataset.break);
    state.timerKind = 'work';
    state.timerRemaining = state.workMinutes * 60;
    saveState();
    renderTimer();
}

function toggleLockedMode() {
    if (state.mode === 'locked') {
        state.unlockedUntil = 0;
        setMode('casual');
        showToast('Locked In is off. Rewards pause in Casual mode.');
    } else {
        setMode('locked');
        showToast('Locked In preview is on. Device-level app blocking is not connected.');
    }
}

function quickUnlock() {
    if (state.mode !== 'locked') {
        showToast('Choose Locked In to preview temporary app unlocks.');
        return;
    }
    if (isOnBreak()) {
        showToast('Distraction apps stay locked during breaks.');
        return;
    }
    const minutes = Number($('#unlock-duration').value);
    state.unlockedUntil = Date.now() + minutes * 60 * 1000;
    saveState();
    renderLock();
    showToast(`Temporary unlock preview for ${minutes} minutes. It will relock automatically.`);
    setTimeout(() => {
        if (state.unlockedUntil <= Date.now()) {
            state.unlockedUntil = 0;
            saveState();
            renderLock();
            showToast('Temporary unlock ended. Locked In preview is back on.');
        }
    }, minutes * 60 * 1000 + 50);
}

function addChatMessage(text, fromUser) {
    const message = document.createElement('div');
    message.className = `chat-message${fromUser ? ' user-message' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = 'chat-avatar';
    avatar.textContent = fromUser ? 'S' : '✳';
    const content = document.createElement('p');
    content.textContent = text;
    message.append(avatar, content);
    $('#chat-window').append(message);
    message.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return message;
}

async function apiRequest(path, options = {}) {
    let response;
    try {
        response = await fetch(path, options);
    } catch {
        throw new Error('Daymark server is not running. Start the local server and open its localhost URL.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status}).`);
    return data;
}

async function refreshGeminiStatus() {
    const label = $('#ai-service-label');
    const note = $('#ai-service-note');
    try {
        const status = await apiRequest('/api/integrations/status');
        label.textContent = status.gemini_configured ? 'GEMINI CONFIGURED' : 'GEMINI SETUP NEEDED';
        note.textContent = status.gemini_configured
            ? `Study questions are sent to Google Gemini (${status.gemini_model}) through the local backend.`
            : 'Gemini is not configured on this local server.';
    } catch (error) {
        label.textContent = 'SERVER OFFLINE';
        note.textContent = error.message;
    }
}

function parseCanvasIcs(text) {
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    const assignmentTerms = /assignment|homework|quiz|exam|test|project|paper|due|discussion|lab|midterm|final|problem|set|reading|milestone|presentation|submission|deliverable|draft|review|case study|module/i;
    const events = [];
    const allEvents = [];
    let current = null;
    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
            current = {};
            continue;
        }
        if (line === 'END:VEVENT') {
            if (current && (current.start || current.end || current.due)) {
                const dateRaw = current.start || current.end || current.due;
                const summary = current.summary || 'Canvas assignment';
                const due = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
                if (/^\d{4}-\d{2}-\d{2}$/.test(due) && dayDifference(due) >= -30) {
                    const title = summary.replace(/^(assignment|quiz|event|calendar event)\s*:\s*/i, '').trim();
                    const item = { uid: current.uid || `${summary}-${due}`, title: title || summary, due };
                    allEvents.push(item);
                    if (assignmentTerms.test(summary)) {
                        events.push(item);
                    }
                }
            }
            current = null;
            continue;
        }
        if (!current) continue;
        const separator = line.indexOf(':');
        if (separator < 0) continue;
        const property = line.slice(0, separator).split(';')[0].toUpperCase();
        const value = line.slice(separator + 1);
        const decoded = value.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
        if (property === 'SUMMARY') current.summary = decoded;
        else if (property === 'UID') current.uid = decoded;
        else if (property === 'DTSTART') current.start = value.replace(/[^0-9T]/g, '').slice(0, 8);
        else if (property === 'DTEND') current.end = value.replace(/[^0-9T]/g, '').slice(0, 8);
        else if (property === 'DUE') current.due = value.replace(/[^0-9T]/g, '').slice(0, 8);
    }
    const result = events.length > 0 ? events : allEvents;
    return result.sort((first, second) => first.due.localeCompare(second.due));
}

function importCanvasEvents(events, note = $('#calendar-note')) {
    let imported = 0;
    for (const event of events) {
        const id = `canvas-${encodeURIComponent(event.uid)}`;
        const existing = state.tasks.find((task) => task.id === id);
        const leadDays = Math.min(3, Math.max(1, Math.ceil(Math.max(0, dayDifference(event.due)) / 3)));
        const task = {
            id,
            source: 'canvas',
            title: event.title,
            subject: 'Canvas',
            due: event.due,
            targetDate: dateBefore(event.due, leadDays),
            minutes: existing?.minutes || 30,
            priority: 'high',
            done: existing?.done || false
        };
        if (existing) Object.assign(existing, task);
        else state.tasks.push(task);
        imported += 1;
    }
    saveState();
    renderAll();
    if (note) {
        note.hidden = false;
        note.textContent = `Canvas import complete: ${imported} assignment${imported === 1 ? '' : 's'} found.`;
    }
    const focusNote = $('#focus-calendar-note');
    if (focusNote) {
        focusNote.hidden = false;
        focusNote.textContent = `Canvas synced: ${imported} assignment${imported === 1 ? '' : 's'} found.`;
    }
    showToast(`Canvas import complete: ${imported} assignment${imported === 1 ? '' : 's'} imported.`);
}

async function importCanvasFile(file) {
    const note = $('#calendar-note');
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
        if (note) {
            note.hidden = false;
            note.textContent = 'That calendar file is larger than the 4 MB import limit.';
        }
        showToast('That calendar file is larger than the 4 MB limit.');
        return;
    }
    if (!file.name.toLowerCase().endsWith('.ics') && file.type !== 'text/calendar' && file.type !== 'application/ics') {
        if (note) {
            note.hidden = false;
            note.textContent = 'Choose a Canvas calendar file ending in .ics.';
        }
        showToast('Please select a file ending in .ics');
        return;
    }
    try {
        const text = await file.text();
        const events = parseCanvasIcs(text);
        if (!events.length) {
            if (note) {
                note.hidden = false;
                note.textContent = 'No upcoming assignment events were found in that calendar file.';
            }
            showToast('No upcoming assignments found in calendar file.');
            return;
        }
        importCanvasEvents(events, note);
    } catch {
        if (note) {
            note.hidden = false;
            note.textContent = 'Could not read that calendar file. Download the Canvas feed again and retry.';
        }
        showToast('Could not read calendar file. Try downloading again.');
    }
}

$('#to-mode').addEventListener('click', () => showOnboardingStep(2));
$('#back-survey').addEventListener('click', () => showOnboardingStep(1));
$('#onboarding-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (onboardingStep === 1) {
        showOnboardingStep(2);
        return;
    }
    state.name = $('#name-input').value.trim() || 'Student';
    state.interests = [...document.querySelectorAll('#interest-options input:checked')].map((input) => input.value);
    state.subjects = $('#subjects-input').value.split(',').map((subject) => subject.trim()).filter(Boolean);
    state.mode = document.querySelector('input[name="mode"]:checked').value === 'locked' ? 'locked' : 'casual';
    state.onboarded = true;
    saveState();
    $('#onboarding').hidden = true;
    renderAll();
    showToast(state.mode === 'locked' ? 'Your plan is ready. Locked In rewards are on.' : 'Your plan is ready. Take it one step at a time.');
});
$('#close-onboarding')?.addEventListener('click', () => {
    state.onboarded = true;
    saveState();
    $('#onboarding').hidden = true;
});
$('#onboarding')?.addEventListener('click', (event) => {
    if (event.target === $('#onboarding')) {
        state.onboarded = true;
        saveState();
        $('#onboarding').hidden = true;
    }
});

$('#add-task')?.addEventListener('click', openTaskModal);
$('#focus-add-task')?.addEventListener('click', openTaskModal);
$('#close-task-modal')?.addEventListener('click', closeTaskModal);
$('#cancel-task-button')?.addEventListener('click', closeTaskModal);
$('#task-modal')?.addEventListener('click', (event) => {
    if (event.target === $('#task-modal')) closeTaskModal();
});
$('#task-title-input')?.addEventListener('input', (event) => {
    const isAuto = isAssignmentOrTest(event.target.value);
    updatePriorityLock(isAuto);
});
$('#task-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = $('#task-title-input').value.trim();
    if (!title) return;
    const subject = $('#task-subject-input').value.trim() || 'Study';
    const due = $('#task-due-input').value;
    if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
        showToast('Please select a valid due date.');
        return;
    }
    const chosenPriority = document.querySelector('input[name="task-priority"]:checked')?.value || 'medium';
    // All assignments and tests are always High priority
    const priority = (isAssignmentOrTest(title) || isAssignmentOrTest(subject)) ? 'high' : chosenPriority;

    const dueDays = Math.max(0, dayDifference(due));
    const targetLead = Math.min(3, Math.max(1, Math.ceil(dueDays / 3)));

    state.tasks.push({
        id: crypto.randomUUID?.() || `task-${Date.now()}`,
        title,
        subject,
        due,
        targetDate: dateBefore(due, targetLead),
        minutes: 30,
        priority,
        done: false
    });

    saveState();
    renderAll();
    closeTaskModal();
    const priorityLabel = priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low';
    showToast(`Added "${title}" as ${priorityLabel} priority.`);
});
$('#import-canvas-file-button').addEventListener('click', () => $('#canvas-ics-file').click());
$('#canvas-ics-file').addEventListener('change', async (event) => {
    await importCanvasFile(event.target.files?.[0]);
    event.target.value = '';
});

function openPasteModal() {
    $('#paste-modal').hidden = false;
    $('#paste-feedback').textContent = '';
    $('#paste-calendar-input').value = '';
    $('#paste-calendar-input').focus();
}

function closePasteModal() {
    $('#paste-modal').hidden = true;
    $('#paste-feedback').textContent = '';
}

async function handlePasteImport() {
    const raw = $('#paste-calendar-input').value.trim();
    const feedback = $('#paste-feedback');
    if (!raw) {
        feedback.textContent = 'Please paste a Canvas URL or .ics calendar text above.';
        return;
    }

    if (raw.includes('BEGIN:VCALENDAR') || raw.includes('BEGIN:VEVENT')) {
        const events = parseCanvasIcs(raw);
        if (events.length > 0) {
            importCanvasEvents(events);
            closePasteModal();
            showToast(`Imported ${events.length} assignments from Canvas!`);
        } else {
            feedback.textContent = 'No upcoming assignments found in that calendar text.';
        }
        return;
    }

    let url = raw.replace(/^webcal:\/\//i, 'https://');
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
        feedback.textContent = 'Please paste a valid Canvas calendar link (https://...) or raw .ics text.';
        return;
    }

    feedback.textContent = 'Fetching Canvas calendar…';
    try {
        let imported = false;
        try {
            const result = await apiRequest('/api/canvas/fetch-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            if (result && result.events && result.events.length > 0) {
                importCanvasEvents(result.events);
                closePasteModal();
                showToast(`Imported ${result.events.length} assignments from Canvas!`);
                imported = true;
                return;
            }
        } catch {
            // Local backend not reachable or running on static hosting (GitHub Pages)
        }

        if (imported) return;

        let directEvents = null;
        try {
            const response = await fetch(url);
            if (response.ok) {
                const text = await response.text();
                directEvents = parseCanvasIcs(text);
            }
        } catch {
            // Canvas blocked by browser CORS policy
        }

        if (directEvents && directEvents.length > 0) {
            importCanvasEvents(directEvents);
            closePasteModal();
            showToast(`Imported ${directEvents.length} assignments from Canvas!`);
            return;
        }

        feedback.textContent = 'Canvas blocked direct browser download due to CORS security. Follow the tutorial above: download the .ics file on your phone, then tap "↑ Choose .ics file" below!';
    } catch {
        feedback.textContent = 'Canvas download blocked by browser security. Please download the .ics file on your phone and tap "Choose .ics file".';
    }
}

$('#paste-canvas-button')?.addEventListener('click', openPasteModal);
$('#close-paste-modal')?.addEventListener('click', closePasteModal);
$('#paste-submit-button')?.addEventListener('click', handlePasteImport);
$('#paste-clipboard-button')?.addEventListener('click', async () => {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const clip = await navigator.clipboard.readText();
            if (clip) {
                $('#paste-calendar-input').value = clip;
                $('#paste-feedback').textContent = 'Pasted from clipboard! Tap "Import assignments" to finish.';
            }
        } else {
            $('#paste-calendar-input').focus();
        }
    } catch {
        $('#paste-calendar-input').focus();
    }
});
$('#paste-file-picker-button')?.addEventListener('click', () => {
    closePasteModal();
    $('#canvas-ics-file').click();
});
$('#timer-toggle').addEventListener('click', startTimer);
$('#timer-reset').addEventListener('click', resetTimer);
document.querySelectorAll('.preset').forEach((button) => button.addEventListener('click', () => choosePreset(button)));
$('#start-focus').addEventListener('click', () => {
    $('#focus-banner').scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!timerHandle && state.timerKind === 'break') {
        state.timerKind = 'work';
        state.timerRemaining = state.workMinutes * 60;
    }
    renderTimer();
    if (!timerHandle) startTimer();
});
$('#lock-action').addEventListener('click', toggleLockedMode);
$('#unlock-duration').addEventListener('change', saveState);
$('#unlock-duration').addEventListener('click', (event) => event.stopPropagation());
$('#unlock-duration').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') quickUnlock();
});
$('#quick-unlock-button').addEventListener('click', quickUnlock);
$('#day-reward-button').addEventListener('click', () => {
    if (state.mode !== 'locked' || !state.tasks.length || !state.tasks.every((task) => task.done) || isOnBreak()) return;
    state.rewardDate = localDateString(new Date());
    state.unlockedUntil = 0;
    saveState();
    renderLock();
    showToast('Daily plan complete. Your distraction-app reward is unlocked for today.');
});
$('#edit-preferences').addEventListener('click', () => openOnboarding(1));
$('#top-settings').addEventListener('click', () => openOnboarding(1));
$('#chat-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#chat-input');
    const question = input.value.trim();
    if (!question) return;
    addChatMessage(question, true);
    input.value = '';
    const submitButton = $('#chat-form button');
    submitButton.disabled = true;
    const pending = addChatMessage('Thinking…', false);
    const tasks = prioritizedTasks().filter((task) => !task.done).slice(0, 8)
        .map((task) => `${task.subject}: ${task.title} · target ${task.targetDate || task.due}`);
    apiRequest('/api/study/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, tasks })
    }).then((result) => {
        pending.querySelector('p').textContent = result.answer;
    }).catch((error) => {
        pending.querySelector('p').textContent = error.message;
    }).finally(() => {
        submitButton.disabled = false;
        input.focus();
    });
});
$('#partner-chat-form').addEventListener('submit', sendPartnerMessage);

const viewLabels = {
    focus: 'FOCUS TIME',
    schedule: 'MY SCHEDULE',
    study: 'STUDY BUDDY',
    people: 'PEOPLE',
    chat: 'PARTNER CHAT',
    profile: 'MY PROFILE',
    rewards: 'YOUR REWARDS'
};

function setActiveView(view) {
    const activeView = viewLabels[view] ? view : 'focus';
    document.querySelectorAll('.app-view').forEach((section) => {
        section.hidden = section.dataset.view !== activeView;
    });
    document.querySelectorAll('.nav-link').forEach((link) => {
        const active = link.dataset.view === activeView;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
    $('.breadcrumb').innerHTML = `${today}<span class="top-dot"> · </span>${viewLabels[activeView]}`;
    if (activeView === 'people') renderLeaderboard();
    if (activeView === 'profile') renderSelectedProfile();
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function viewFromHash() {
    const route = window.location.hash.slice(1);
    if (route === 'schedule') return 'schedule';
    if (['study', 'assistant'].includes(route)) return 'study';
    if (route === 'chat' || route === 'partner-chat') return 'chat';
    if (route === 'people') return 'people';
    if (route === 'profile' || route.startsWith('profile/')) return 'profile';
    if (route === 'rewards') return 'rewards';
    return 'focus';
}

document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        const view = link.dataset.view;
        window.location.hash = `#${view}`;
        setActiveView(view);
    });
});
window.addEventListener('hashchange', () => setActiveView(viewFromHash()));

document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.classList.contains('nav-link')) return;
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const targetRoute = href.slice(1);
    const viewName = targetRoute.split('/')[0];
    if (['focus', 'schedule', 'study', 'people', 'chat', 'profile', 'rewards'].includes(viewName)) {
        event.preventDefault();
        window.location.hash = href;
        setActiveView(viewFromHash());
    }
});

$('#people-search').addEventListener('input', renderLeaderboard);
$('#leaderboard-sort').addEventListener('change', renderLeaderboard);
document.querySelectorAll('.period-tab').forEach((button) => {
    button.addEventListener('click', () => {
        leaderboardPeriod = button.dataset.period;
        document.querySelectorAll('.period-tab').forEach((tab) => {
            const selected = tab === button;
            tab.classList.toggle('active', selected);
            tab.setAttribute('aria-selected', String(selected));
        });
        renderLeaderboard();
    });
});

document.querySelectorAll('[id^="privacy-"]').forEach((input) => {
    input.addEventListener('change', () => {
        const field = input.id.slice('privacy-'.length);
        state.profilePrivacy[field] = input.checked;
        saveState();
        renderSelectedProfile();
        renderLeaderboard();
    });
});
$('#profile-study-level').addEventListener('change', () => {
    state.studyLevel = $('#profile-study-level').value;
    saveState();
    renderSelectedProfile();
    renderLeaderboard();
});

function initialize() {
    closeObservedAwayPeriod();
    renderAll();

    document.addEventListener('visibilitychange', () => {
        if (!timerHandle || state.timerKind !== 'work') return;
        if (document.hidden && !state.observation.awayStartedAt) {
            state.observation.awayStartedAt = Date.now();
        } else if (!document.hidden) {
            closeObservedAwayPeriod();
        }
        saveState();
        renderAttention();
    });

    window.addEventListener('pagehide', () => {
        if (timerHandle && state.timerKind === 'work' && !state.observation.awayStartedAt) {
            state.observation.awayStartedAt = Date.now();
            saveState();
        }
    });
    if (state.timerKind === 'break' && state.timerRemaining === 0) state.timerKind = 'work';
    if (state.unlockedUntil && state.unlockedUntil <= Date.now()) state.unlockedUntil = 0;
    if (state.unlockedUntil > Date.now()) {
        setTimeout(() => {
            state.unlockedUntil = 0;
            saveState();
            renderLock();
        }, state.unlockedUntil - Date.now());
    }
    setActiveView(viewFromHash());
    const observationDelay = Math.max(0, observationDeadline() - Date.now());
    setTimeout(() => {
        finishObservationIfReady();
        renderAttention();
    }, observationDelay);
    refreshGeminiStatus();
}

initialize();
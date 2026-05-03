import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://jkslezmcnoivlmlrqbiv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprc2xlem1jbm9pdmxtbHJxYml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MDQwODEsImV4cCI6MjA5MzI4MDA4MX0.LFs2jqfxXP-OKI4nQKuaqXkcQxWaQiv4MWElT5XEk_I';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

let currentUser = null;

// In-memory cache for performance — avoids redundant network calls
const cache = {
    tasks: null,
    subjects: null,
    topics: null,
    events: null,
    invalidate(key) { if (key) { this[key] = null; } else { this.tasks = this.subjects = this.topics = this.events = null; } }
};


// Auth UI Elements
const authScreen = document.getElementById('auth-screen');
const appLayout = document.getElementById('app-layout');
const authNameGroup = document.getElementById('auth-name-group');
const authName = document.getElementById('auth-name');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleText = document.getElementById('auth-toggle-text');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');
const logoutBtn = document.getElementById('logout-btn');

let isSignUpMode = false;

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        showApp();
    } else {
        showAuthScreen();
    }

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            showApp();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showAuthScreen();
        }
    });

    setupAuthListeners();
}

function showAuthScreen() {
    authScreen.style.display = 'flex';
    appLayout.style.display = 'none';
    clearAuthFields();
}

function showApp() {
    authScreen.style.display = 'none';
    appLayout.style.display = 'flex';
    bootstrap();
}

function clearAuthFields() {
    authName.value = '';
    authEmail.value = '';
    authPassword.value = '';
    authError.style.display = 'none';
    authSuccess.style.display = 'none';
}

function setupAuthListeners() {
    authToggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUpMode = !isSignUpMode;
        authError.style.display = 'none';
        authSuccess.style.display = 'none';

        if (isSignUpMode) {
            authNameGroup.style.display = 'block';
            authSubmitBtn.textContent = 'Sign Up';
            authToggleText.textContent = 'Already have an account?';
            authToggleLink.textContent = 'Sign In';
        } else {
            authNameGroup.style.display = 'none';
            authSubmitBtn.textContent = 'Sign In';
            authToggleText.textContent = "Don't have an account?";
            authToggleLink.textContent = 'Sign Up';
        }
    });

    authSubmitBtn.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        const password = authPassword.value;
        const name = authName.value.trim();

        authError.style.display = 'none';
        authSuccess.style.display = 'none';

        if (!email || !password || (isSignUpMode && !name)) {
            authError.textContent = 'Please fill in all fields';
            authError.style.display = 'block';
            return;
        }

        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = 'Please wait...';

        try {
            if (isSignUpMode) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { name } }
                });
                if (error) throw error;
                authSuccess.textContent = 'Check your email to confirm your account!';
                authSuccess.style.display = 'block';
                authSubmitBtn.textContent = 'Sign Up';
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
                authSubmitBtn.textContent = 'Sign In';
            }
        } catch (error) {
            authError.textContent = error.message;
            authError.style.display = 'block';
            authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        }

        authSubmitBtn.disabled = false;
    });

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
    });
}

async function bootstrap() {
    // Apply persisted UI preferences immediately
    if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');
    if (localStorage.getItem('compact') === 'true') document.body.classList.add('compact-mode');

    updateUserProfile();
    updateCurrentDate();
    setupPomodoro();
    setupNavigation();
    setupModals();
    setupFilterTabs();

    // Parallel data load — much faster than sequential awaits
    await preloadAllData();

    renderTodaySchedule();
    renderTasks();
    renderCalendar();
    renderSubjects();
}

async function preloadAllData() {
    const uid = currentUser.id;
    const [tasksRes, subjectsRes, topicsRes, eventsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        supabase.from('topics').select('*').eq('user_id', uid),
        supabase.from('events').select('*').eq('user_id', uid),
    ]);
    cache.tasks    = tasksRes.data    || [];
    cache.subjects = subjectsRes.data || [];
    cache.topics   = topicsRes.data   || [];
    cache.events   = eventsRes.data   || [];
}

async function refreshCache(keys = []) {
    const uid = currentUser.id;
    const fetches = [];
    if (!keys.length || keys.includes('tasks'))    fetches.push(supabase.from('tasks').select('*').eq('user_id', uid).order('created_at', { ascending: false }).then(r => { cache.tasks = r.data || []; }));
    if (!keys.length || keys.includes('subjects')) fetches.push(supabase.from('subjects').select('*').eq('user_id', uid).order('created_at', { ascending: true }).then(r => { cache.subjects = r.data || []; }));
    if (!keys.length || keys.includes('topics'))   fetches.push(supabase.from('topics').select('*').eq('user_id', uid).then(r => { cache.topics = r.data || []; }));
    if (!keys.length || keys.includes('events'))   fetches.push(supabase.from('events').select('*').eq('user_id', uid).then(r => { cache.events = r.data || []; }));
    await Promise.all(fetches);
}

async function updateUserProfile() {
    const name = currentUser.user_metadata?.name || currentUser.email.split('@')[0];
    const encodedName = encodeURIComponent(name);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodedName}&background=7c3aed&color=fff&rounded=true`;
    
    // Update Sidebar
    const sidebarName = document.getElementById('sidebar-user-name');
    if (sidebarName) sidebarName.textContent = name;
    
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
    
    // Update Dashboard Welcome
    const welcomeName = document.getElementById('welcome-name');
    if (welcomeName) welcomeName.textContent = name;

    // Update Settings Page
    const settingsName = document.getElementById('settings-name');
    if (settingsName) settingsName.textContent = name;
    
    const settingsEmail = document.getElementById('settings-email');
    if (settingsEmail) settingsEmail.textContent = currentUser.email;
    
    const settingsAvatar = document.getElementById('settings-avatar');
    if (settingsAvatar) settingsAvatar.src = avatarUrl;
    
    refreshStudyTime();
}

function updateCurrentDate() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', options);
}

/* ================== TASKS ================== */
function renderTasks(statusFilter = 'all') {
    const taskList = document.getElementById('task-list');
    const fullTaskList = document.getElementById('full-task-list');
    const tasks = cache.tasks || [];

    // Apply status filter
    let filtered = tasks;
    if (statusFilter === 'urgent') filtered = tasks.filter(t => !t.completed && t.urgency === 'urgent');
    else if (statusFilter === 'pending') filtered = tasks.filter(t => !t.completed);
    else if (statusFilter === 'done') filtered = tasks.filter(t => t.completed);

    const urgentIncomplete = tasks.filter(t => !t.completed && t.urgency === 'urgent');

    if (taskList) {
        taskList.innerHTML = urgentIncomplete.length ? '' : '<p class="placeholder-text">No urgent tasks! 🎉</p>';
        urgentIncomplete.slice(0, 5).forEach(task => taskList.appendChild(createTaskElement(task)));
    }

    if (fullTaskList) {
        fullTaskList.innerHTML = filtered.length ? '' : '<p class="placeholder-text">No tasks here.</p>';
        filtered.forEach(task => fullTaskList.appendChild(createTaskElement(task)));
    }

    const completedCount = tasks.filter(t => t.completed).length;
    const incompleteCount = tasks.filter(t => !t.completed).length;
    const el1 = document.getElementById('tasks-completed-count');
    const el2 = document.getElementById('nav-tasks-badge');
    if (el1) el1.textContent = completedCount;
    if (el2) el2.textContent = incompleteCount;
}


function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-item ${task.urgency}`;
    if (task.completed) div.classList.add('is-done');

    const urgencyClass = task.urgency === 'urgent' ? 'text-red' : (task.urgency === 'warning' ? 'text-orange' : 'text-green');
    const urgencyIcon = task.urgency === 'urgent' ? 'ph-warning' : (task.urgency === 'warning' ? 'ph-warning-circle' : 'ph-calendar-blank');

    div.innerHTML = `
        <input type="checkbox" class="task-check" id="task-${task.id}" ${task.completed ? 'checked' : ''}>
        <div class="task-info">
            <label for="task-${task.id}">${escapeHtml(task.name)}</label>
            <span class="task-due ${urgencyClass}"><i class="ph ${urgencyIcon}"></i> Due: ${escapeHtml(task.due)}</span>
        </div>
        <button class="task-action del-task" data-id="${task.id}"><i class="ph ph-trash"></i></button>
    `;

    const label = div.querySelector('label');
    if (task.completed) { label.style.textDecoration = 'line-through'; label.style.opacity = '0.5'; }

    // OPTIMISTIC UPDATE — no full re-render, just flip the UI immediately
    div.querySelector('.task-check').addEventListener('change', async (e) => {
        const completed = e.target.checked;
        // Update cache instantly
        const cached = cache.tasks?.find(t => t.id === task.id);
        if (cached) cached.completed = completed;
        // Update label visually
        label.style.textDecoration = completed ? 'line-through' : 'none';
        label.style.opacity = completed ? '0.5' : '1';
        div.classList.toggle('is-done', completed);
        // Update badge counts
        const incompleteCount = (cache.tasks || []).filter(t => !t.completed).length;
        const completedCount = (cache.tasks || []).filter(t => t.completed).length;
        const el1 = document.getElementById('tasks-completed-count');
        const el2 = document.getElementById('nav-tasks-badge');
        if (el1) el1.textContent = completedCount;
        if (el2) el2.textContent = incompleteCount;
        // Sync to database in background
        supabase.from('tasks').update({ completed }).eq('id', task.id).then(({ error }) => {
            if (error) console.error('Failed to update task:', error);
        });
    });

    // Delete with optimistic removal
    div.querySelector('.del-task').addEventListener('click', async () => {
        div.style.transition = 'all 0.2s ease';
        div.style.opacity = '0';
        div.style.transform = 'translateX(20px)';
        setTimeout(() => div.remove(), 200);
        // Update cache
        if (cache.tasks) cache.tasks = cache.tasks.filter(t => t.id !== task.id);
        // Sync badge
        const incompleteCount = (cache.tasks || []).filter(t => !t.completed).length;
        const el = document.getElementById('nav-tasks-badge');
        if (el) el.textContent = incompleteCount;
        // Sync to DB
        supabase.from('tasks').delete().eq('id', task.id);
    });

    return div;
}


async function renderTodaySchedule() {
    const list = document.getElementById('today-schedule-list');
    if (!list) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const allEvents = cache.events || [];
    const events = allEvents
        .filter(e => e.date === todayStr)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (!events.length) {
        list.innerHTML = '<p class="placeholder-text">No events scheduled for today.</p>';
        return;
    }

    list.innerHTML = '';
    events.forEach((ev, index) => {
        let timeDisplay = '--:--';
        let meridiem = '';
        if (ev.time) {
            const [hh, mm] = ev.time.split(':');
            const h = parseInt(hh, 10);
            meridiem = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 || 12;
            timeDisplay = `${String(displayH).padStart(2, '0')}:${mm}`;
        }
        
        // Alternate colors
        const colors = ['card-blue', 'card-orange', 'card-green', 'card-purple'];
        const cardColor = colors[index % colors.length];

        const item = document.createElement('div');
        item.className = 'schedule-item';
        item.innerHTML = `
            <div class="time">
                <span class="start">${timeDisplay}</span>
                <span class="meridiem">${meridiem}</span>
            </div>
            <div class="timeline-indicator"></div>
            <div class="details ${cardColor}">
                <h4>${escapeHtml(ev.title)}</h4>
                <p><i class="ph ph-clock"></i> ${ev.time || 'All Day'}</p>
            </div>
        `;
        list.appendChild(item);
    });
}

/* ================== SUBJECTS / MATERIALS ================== */
async function renderSubjects() {
    const subjectsList = document.getElementById('subjects-list');

    // Use cache if available, else fetch
    if (!cache.subjects || !cache.topics) {
        await refreshCache(['subjects', 'topics']);
    }
    const subjects = cache.subjects || [];
    const topics   = cache.topics   || [];

    const totalSubjects = subjects.length;
    let totalTopicsCompleted = 0;
    let totalTopicsCount = 0;

    subjectsList.innerHTML = subjects.length ? '' : '<p class="placeholder-text">No subjects added yet.</p>';


    subjects.forEach(subject => {
        const subjectTopics = (topics || []).filter(t => t.subject_id === subject.id);
        const subTotal = subjectTopics.length;
        const subCompleted = subjectTopics.filter(t => t.completed).length;

        totalTopicsCount += subTotal;
        totalTopicsCompleted += subCompleted;

        const progressPercent = subTotal > 0 ? Math.round((subCompleted / subTotal) * 100) : 0;

        const div = document.createElement('div');
        div.className = 'subject-card glass-panel';
        div.innerHTML = `
            <div class="subject-icon ${subject.icon || 'default'}">
                <i class="ph-fill ph-book-open"></i>
            </div>
            <div class="subject-details" style="flex: 1;">
                <h3>${escapeHtml(subject.name)}</h3>
                <div class="subject-meta">
                    <span>${subCompleted}/${subTotal} Topics</span> • 
                    <span>${progressPercent}% Complete</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                </div>
                <div class="topics-list" style="margin-top: 12px;">
                    ${subjectTopics.length === 0 
                        ? '<p style="color:var(--text-muted); margin:0; font-size:0.85em;">No topics yet. Click + to add one.</p>' 
                        : subjectTopics.map(t => `
                        <details class="topic-item" ${t.completed ? 'open' : ''}>
                            <summary>
                                <div class="topic-summary-left">
                                    <input type="checkbox" class="task-check topic-checkbox" data-id="${t.id}" ${t.completed ? 'checked' : ''} onclick="event.stopPropagation()">
                                    <span style="font-size:0.9rem; font-weight:500; ${t.completed ? 'text-decoration:line-through; opacity:0.5;' : ''}">${escapeHtml(t.name)}</span>
                                </div>
                                ${t.description ? '<i class="ph ph-caret-down"></i>' : '<span></span>'}
                            </summary>
                            ${t.description ? `<p class="topic-description">${escapeHtml(t.description)}</p>` : ''}
                        </details>
                        `).join('')
                    }
                </div>
            </div>
            <div class="subject-actions" title="Add Topic">
                <i class="ph ph-plus-circle open-topic-modal" data-id="${subject.id}"></i>
            </div>
        `;

        // OPTIMISTIC topic checkbox — no full re-render
        div.querySelectorAll('.topic-checkbox').forEach(chk => {
            chk.addEventListener('change', async (e) => {
                e.stopPropagation();
                const topicId = e.target.dataset.id;
                const completed = e.target.checked;
                // Update cache
                const cached = cache.topics?.find(t => t.id === topicId);
                if (cached) cached.completed = completed;
                // Update visual immediately
                const nameSpan = chk.closest('summary').querySelector('span');
                if (nameSpan) { nameSpan.style.textDecoration = completed ? 'line-through' : 'none'; nameSpan.style.opacity = completed ? '0.5' : '1'; }
                // Update subject progress bar
                const subjectCard = chk.closest('.subject-card');
                if (subjectCard) {
                    const allChecks = subjectCard.querySelectorAll('.topic-checkbox');
                    const totalT = allChecks.length;
                    const doneT = [...allChecks].filter(c => c.checked).length;
                    const pct = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;
                    const fill = subjectCard.querySelector('.progress-fill');
                    const meta = subjectCard.querySelectorAll('.subject-meta span');
                    if (fill) fill.style.width = pct + '%';
                    if (meta[0]) meta[0].textContent = `${doneT}/${totalT} Topics`;
                    if (meta[1]) meta[1].textContent = `${pct}% Complete`;
                }
                // Sync to DB
                supabase.from('topics').update({ completed }).eq('id', topicId).then(({ error }) => {
                    if (error) console.error('Failed to update topic:', error);
                });
            });
        });


        // Add Topic listener
        const plusBtn = div.querySelector('.open-topic-modal');
        plusBtn.addEventListener('click', () => {
            document.getElementById('topic-subject-id').value = subject.id;
            document.getElementById('topic-modal').classList.add('active');
        });

        subjectsList.appendChild(div);
    });

    document.getElementById('total-chapters').textContent = totalSubjects;
    document.getElementById('total-chapters-completed').textContent = totalSubjects; // just show total
    
    document.getElementById('total-topics').textContent = totalTopicsCount;
    document.getElementById('total-topics-completed').textContent = totalTopicsCompleted;

    // Add subject handler
    const addBtn = document.getElementById('add-subject-btn');
    addBtn.replaceWith(addBtn.cloneNode(true));
    document.getElementById('add-subject-btn').addEventListener('click', () => {
        document.getElementById('subject-modal').classList.add('active');
    });
}

/* ================== CALENDAR ================== */
async function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('calendar-month-year');

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    monthYear.textContent = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        grid.appendChild(emptyDay);
    }

    const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', currentUser.id);

    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        if (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
            dayDiv.classList.add('today');
        }

        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dayDiv.innerHTML = `<div class="day-num">${i}</div>`;

        // Add events
        if (events && !error) {
            const dayEvents = events.filter(e => e.date === dateStr);
            dayEvents.forEach(e => {
                const evDiv = document.createElement('div');
                evDiv.className = 'day-event';
                evDiv.innerHTML = `<span>${e.time ? e.time+' ' : ''}${escapeHtml(e.title)}</span> <span class="event-del" data-id="${e.id}">&times;</span>`;

                evDiv.querySelector('.event-del').addEventListener('click', async (evt) => {
                    evt.stopPropagation();
                    await supabase.from('events').delete().eq('id', e.id);
                    renderCalendar();
                    renderTodaySchedule();
                });

                dayDiv.appendChild(evDiv);
            });
        }

        dayDiv.addEventListener('click', () => {
            document.getElementById('event-modal-date').textContent = dateStr;
            document.getElementById('event-modal-date').dataset.date = dateStr;
            document.getElementById('event-modal').classList.add('active');
        });

        grid.appendChild(dayDiv);
    }
}

/* ================== POMODORO ================== */
let pomodoroTimer = null;
let pomodoroTimeLeft = 0; // in seconds
let isPomodoroRunning = false;
let secondsSinceSync = 0;

function setupPomodoro() {
    const timeDisplay = document.getElementById('pomodoro-time');
    const startBtn = document.getElementById('pomodoro-start');
    const resetBtn = document.getElementById('pomodoro-reset');
    const presetBtns = document.querySelectorAll('.preset-btn[data-time]');

    function updateDisplay() {
        const h = Math.floor(pomodoroTimeLeft / 3600);
        const m = Math.floor((pomodoroTimeLeft % 3600) / 60);
        const s = pomodoroTimeLeft % 60;
        timeDisplay.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    async function syncStudyTime(seconds) {
        if (seconds > 0) {
            await supabase.rpc('increment_study_seconds', { uid: currentUser.id, secs: seconds });
            refreshStudyTime();
        }
    }

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isPomodoroRunning) return;
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const minutes = parseInt(btn.dataset.time, 10);
            pomodoroTimeLeft = minutes * 60;
            updateDisplay();
        });
    });

    startBtn.addEventListener('click', () => {
        if (isPomodoroRunning) {
            // Pause
            clearInterval(pomodoroTimer);
            isPomodoroRunning = false;
            startBtn.innerHTML = '<i class="ph-fill ph-play"></i>';
            syncStudyTime(secondsSinceSync);
            secondsSinceSync = 0;
        } else {
            // Start
            if (pomodoroTimeLeft <= 0) return;
            isPomodoroRunning = true;
            startBtn.innerHTML = '<i class="ph-fill ph-pause"></i>';

            pomodoroTimer = setInterval(() => {
                pomodoroTimeLeft--;
                secondsSinceSync++;
                updateDisplay();

                // Sync every 30 seconds
                if (secondsSinceSync >= 30) {
                    syncStudyTime(secondsSinceSync);
                    secondsSinceSync = 0;
                }

                if (pomodoroTimeLeft <= 0) {
                    clearInterval(pomodoroTimer);
                    isPomodoroRunning = false;
                    startBtn.innerHTML = '<i class="ph-fill ph-play"></i>';
                    syncStudyTime(secondsSinceSync);
                    secondsSinceSync = 0;
                    alert('Session completed!');
                }
            }, 1000);
        }
    });

    resetBtn.addEventListener('click', () => {
        clearInterval(pomodoroTimer);
        isPomodoroRunning = false;
        startBtn.innerHTML = '<i class="ph-fill ph-play"></i>';
        if (secondsSinceSync > 0) {
            syncStudyTime(secondsSinceSync);
            secondsSinceSync = 0;
        }

        const activePreset = document.querySelector('.preset-btn.active');
        if (activePreset) {
            pomodoroTimeLeft = parseInt(activePreset.dataset.time, 10) * 60;
        } else {
            pomodoroTimeLeft = 0;
        }
        updateDisplay();
    });

    updateDisplay();
}

async function refreshStudyTime() {
    const { data, error } = await supabase
        .from('profiles')
        .select('study_seconds')
        .eq('id', currentUser.id)
        .single();

    if (data && !error) {
        const totalSecs = data.study_seconds || 0;
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        document.getElementById('study-time-count').textContent = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
}

/* ================== NAVIGATION & SPA ================== */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const views = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.dataset.target;
            switchView(target);
        });
    });

    // View all tasks click
    const viewAllTasks = document.querySelector('.tasks-widget .view-all');
    if (viewAllTasks) {
        viewAllTasks.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('tasks');
        });
    }

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
}

function switchView(target) {
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const views = document.querySelectorAll('.view-section');

    navItems.forEach(nav => nav.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));

    const targetNav = document.querySelector(`.nav-item[data-target="${target}"]`);
    const targetView = document.getElementById(`view-${target}`);

    if (targetNav) targetNav.classList.add('active');
    if (targetView) targetView.classList.add('active');

    // Sync topbar title
    const titles = { dashboard: 'Dashboard', schedule: 'Schedule', tasks: 'Tasks', materials: 'Syllabus', progress: 'Progress', pomodoro: 'Focus Timer', settings: 'Settings' };
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = titles[target] || '';
}

/* ================== MODALS ================== */
function setupModals() {
    // Shared logic for closing modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // --- Task Modal ---
    const taskModal = document.getElementById('task-modal');
    document.getElementById('new-task-btn').addEventListener('click', () => taskModal.classList.add('active'));
    document.getElementById('save-task-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const nameInput = document.getElementById('task-name-input');
        const dueInput = document.getElementById('task-due-input');
        const urgencyInput = document.getElementById('task-urgency-input');

        const name = nameInput.value.trim();
        const due = dueInput.value.trim();
        const urgency = urgencyInput.value;

        if (!name || !due) return alert('Please fill in all fields');

        btn.disabled = true;
        btn.textContent = 'Saving...';
        await supabase.from('tasks').insert({ user_id: currentUser.id, name, due, urgency, completed: false });
        btn.disabled = false;
        btn.textContent = 'Save Task';
        
        nameInput.value = '';
        dueInput.value = '';
        taskModal.classList.remove('active');
        await refreshCache(['tasks']);
        renderTasks();
    });

    // --- Subject Modal ---
    const subjectModal = document.getElementById('subject-modal');
    document.getElementById('save-subject-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const nameInput = document.getElementById('subject-name-input');
        const iconInput = document.getElementById('subject-icon-input');

        const name = nameInput.value.trim();
        const icon = iconInput.value;

        if (!name) return alert('Please enter a subject name');

        btn.disabled = true;
        btn.textContent = 'Saving...';
        await supabase.from('subjects').insert({
            user_id: currentUser.id, name, icon, chapters_completed: 0, total_chapters: 0, topics_completed: 0, total_topics: 0
        });
        btn.disabled = false;
        btn.textContent = 'Save Subject';

        nameInput.value = '';
        subjectModal.classList.remove('active');
        await refreshCache(['subjects']);
        renderSubjects();
    });

    // --- Event Modal ---
    const eventModal = document.getElementById('event-modal');
    document.getElementById('save-event-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const dateSpan = document.getElementById('event-modal-date');
        const titleInput = document.getElementById('event-title-input');
        const timeInput = document.getElementById('event-time-input');

        const title = titleInput.value.trim();
        const time = timeInput.value;
        const dateStr = dateSpan.dataset.date;

        if (!title) return alert('Please enter an event title');

        btn.disabled = true;
        btn.textContent = 'Saving...';
        await supabase.from('events').insert({
            user_id: currentUser.id, date: dateStr, time: time || null, title
        });
        btn.disabled = false;
        btn.textContent = 'Save Event';

        titleInput.value = '';
        timeInput.value = '';
        eventModal.classList.remove('active');
        await refreshCache(['events']);
        renderCalendar();
        renderTodaySchedule();
    });

    // --- Topic Modal ---
    const topicModal = document.getElementById('topic-modal');
    document.getElementById('save-topic-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const nameInput = document.getElementById('topic-name-input');
        const descInput = document.getElementById('topic-desc-input');
        const subjectId = document.getElementById('topic-subject-id').value;

        const name = nameInput.value.trim();
        const description = descInput.value.trim();

        if (!name) return alert('Please enter a topic name');

        btn.disabled = true;
        btn.textContent = 'Saving...';
        await supabase.from('topics').insert({
            user_id: currentUser.id, subject_id: subjectId, name, description, completed: false
        });
        btn.disabled = false;
        btn.textContent = 'Save Topic';

        nameInput.value = '';
        descInput.value = '';
        topicModal.classList.remove('active');
        await refreshCache(['topics']);
        renderSubjects();
    });

    // --- Settings Logic ---
    function setupSettingsLogic() {
        // Logout
        const settingsLogoutBtn = document.getElementById('settings-logout-btn');
        if (settingsLogoutBtn) {
            settingsLogoutBtn.addEventListener('click', async () => {
                settingsLogoutBtn.textContent = 'Signing out...';
                settingsLogoutBtn.disabled = true;
                await supabase.auth.signOut();
            });
        }

        // Theme Toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            // Restore saved preference
            if (localStorage.getItem('theme') === 'light') {
                themeToggle.checked = true;
                document.body.classList.add('light-mode');
            }
            themeToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.body.classList.add('light-mode');
                    localStorage.setItem('theme', 'light');
                } else {
                    document.body.classList.remove('light-mode');
                    localStorage.setItem('theme', 'dark');
                }
            });
        }

        // Compact Mode Toggle
        const compactToggle = document.getElementById('compact-toggle');
        if (compactToggle) {
            if (localStorage.getItem('compact') === 'true') {
                compactToggle.checked = true;
                document.body.classList.add('compact-mode');
            }
            compactToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.body.classList.add('compact-mode');
                    localStorage.setItem('compact', 'true');
                } else {
                    document.body.classList.remove('compact-mode');
                    localStorage.setItem('compact', 'false');
                }
            });
        }

        // Change Password
        const changePwBtn = document.getElementById('settings-change-password');
        if (changePwBtn) {
            changePwBtn.addEventListener('click', async () => {
                const newPassword = window.prompt('Enter your new password (min 6 characters):');
                if (!newPassword || newPassword.length < 6) return;
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) {
                    alert('Error: ' + error.message);
                } else {
                    alert('Password updated successfully!');
                }
            });
        }

        // Export Data
        const exportBtn = document.getElementById('settings-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                exportBtn.disabled = true;
                const [{ data: tasks }, { data: subjects }, { data: topics }] = await Promise.all([
                    supabase.from('tasks').select('*').eq('user_id', currentUser.id),
                    supabase.from('subjects').select('*').eq('user_id', currentUser.id),
                    supabase.from('topics').select('*').eq('user_id', currentUser.id),
                ]);
                const exportData = { exportedAt: new Date().toISOString(), tasks, subjects, topics };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'studyspace-export.json';
                a.click();
                URL.revokeObjectURL(url);
                exportBtn.disabled = false;
            });
        }
    }

    setupSettingsLogic();
}


/* ================== SEARCH ================== */
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            renderTasks(query);

            if (query && document.getElementById('view-tasks')) {
                // If searching, switch to tasks view to show results
                switchView('tasks');
            }
        });
    }
}

function setupFilterTabs() {
    const tabs = document.querySelectorAll('.filter-tab[data-filter]');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filter = tab.dataset.filter;
            renderTasks(undefined, filter);
        });
    });
}

// Utility
function escapeHtml(unsafe) {
    return (unsafe || '').replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

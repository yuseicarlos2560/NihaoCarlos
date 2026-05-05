// --- CONFIG & STATE ---
// --- ZONE 1: CONFIG & STATE ---
const VIDEO_DATA = {
    '1fqsNZ9HGU8': { title: '小lin说：RMB tendency', category: 'Economics' },
    'Q73s8v_d46M': { title: '小lin说：Exchange rate going up', category: 'Economics' },
    'Lb60mjM5B1U': { title: '小lin说：Recap of last 6 years', category: 'Economics' },
    'HeVuAKDtWX8': { title: '小lin说：Iran war', category: 'Economics' },
    'vP45wBOQLS8': { title: '小lin说：SVB bank', category: 'Economics' },
    'hhtMlRZLJ0g': { title: '小lin说：Sports Betting', category: 'Economics' },
    'ERK34RQq9YU': { title: '小lin说：Ads', category: 'Economics' },
    'Euc0HS-0XUs': { title: '小lin说：Marketing Tactics', category: 'Economics' },
    'AJLe1AEgz5M': { title: '小lin说：Vietnam Fraud', category: 'Economics' },
    'ssssR1hxiTw': { title: '小lin说：Middle East Oil', category: 'Economics' },
    'yP3lKQF-nb4': { title: '小lin说：Economics of Museums', category: 'Economics' },
    'zsOYK-sb3Qo': { title: '二爷故事：Xi and Bo Xilai', category: 'Politics' },
    'aWrqBWs_HJ8': { title: '大问题dialectic：Chinese vs Western Philosophy', category: 'Philosophy' },
    'bQ-tobjv92k': { title: '有点在李：Concerts prices', category: 'Tech' },
    'tPtHJ2FvtdM': { title: '有点在李：SpaceX IPO', category: 'Tech' },
    'tHv-FSgtcnc': { title: '有点在李：Palantir', category: 'Tech' },
    'uzx5xWNOSws': { title: '有点在李：Claude', category: 'Tech' },
    '8eAJ9PDgUyI': { title: '有点在李：Fight for AI Hegemony', category: 'Tech' },
    'bili:BV1LYoGBBEsF': { title: 'Self-care: Why do we feel we are not enough', category: 'General' },
    '__Borrador_UNAM_en_Chino': { title: 'Historia de la UNAM', category: 'General' },
    'documents/HSK41002.pdf': { title: 'HSK4 test 2', category: 'HSK' }
};

let appState = {
    currentVideoId: '1fqsNZ9HGU8',
    currentCategory: 'All',
    isPinyinVisible: true,
    isSidebarCollapsed: false,
    player: null,
    captions: [],
    lastActiveIndex: -1
};

// --- SPEECH MANAGER ---
const speechManager = {
    synth: window.speechSynthesis,
    speak(text) {
        this.stop();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.4; // Slightly faster for natural feel
        this.synth.speak(utterance);
    },
    stop() {
        this.synth.cancel();
    }
};

// --- CORE ENGINE ---
async function init() {
    renderVideoList();
    await loadCaptions();
    loadNotes();
}

function renderVideoList() {
    const list = document.getElementById('video-list');

    // 1. Group data by category
    const groupedData = Object.entries(VIDEO_DATA).reduce((acc, [id, info]) => {
        if (!acc[info.category]) acc[info.category] = [];
        acc[info.category].push({ id, ...info });
        return acc;
    }, {});

    // 2. Build the HTML with <details> for each category
    list.innerHTML = Object.entries(groupedData).map(([category, videos]) => `
        <details class="category-section" open>
            <summary class="category-header">${category}</summary>
            <div class="category-content">
                ${videos.map(video => `
                    <button class="nav-item ${video.id === appState.currentVideoId ? 'active' : ''}"
                            onclick="switchVideo('${video.id}')">
                        ${video.title}
                    </button>
                `).join('')}
            </div>
        </details>
    `).join('');
}

async function loadCaptions() {
    try {
        // Construct the path: captions/videoId.json
        // Note: We encodeURIComponent in case your IDs have special characters
        const filePath = `captions/${encodeURIComponent(appState.currentVideoId)}.json`;

        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(`Could not find caption file: ${filePath}`);
        }

        const data = await response.json();

        // Since the file is now specific to one video,
        // the JSON can just be the array itself
        appState.captions = Array.isArray(data) ? data : (data[appState.currentVideoId] || []);

        if (appState.captions.length === 0) {
            console.warn(`No transcripts found for ID: ${appState.currentVideoId}`);
        }

        renderTranscript();
    } catch (err) {
        console.error("Error loading transcript JSON:", err);
        // Clear transcript if file is missing to avoid showing old data
        appState.captions = [];
        renderTranscript();
    }
}

function renderTranscript() {
    const container = document.getElementById('transcript');
    // Check if we are in a mode that doesn't support seeking (BiliBili or Transcript-only)[cite: 3]
    const isBili = appState.currentVideoId.startsWith('bili:');
    const isOnlyTranscript = appState.currentVideoId.startsWith('__');
    const useTTS = isBili || isOnlyTranscript;

    container.innerHTML = appState.captions.map((cap, i) => {
        // Escape single quotes for the speech synthesis string[cite: 2]
        const cleanText = cap.text.replace(/'/g, "\\'");

        return `
            <div class="caption-line" id="cap-${i}" 
                 onclick="${useTTS ? `speechManager.speak('${cleanText}')` : `player.seekTo(${cap.start})`}">
                <div class="caption-text-group">
                    <span class="timestamp">${formatTime(cap.start)}</span>
                    <span class="text-content">${cap.text}</span>
                </div>
                <button class="btn-speak-small" 
                        onclick="event.stopPropagation(); speechManager.speak('${cleanText}')">
                    🔊
                </button>
            </div>
        `;
    }).join('');
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function onYouTubeIframeAPIReady() {
    // Check if the placeholder div exists in the DOM before trying to attach[cite: 2]
    if (!document.getElementById('player')) return;

    appState.player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: appState.currentVideoId,
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': (event) => {
                // Ensure sync loop starts[cite: 2]
                requestAnimationFrame(syncLoop);
            },
            'onStateChange': (event) => {
                // Optional: Handle video end/pause logic here
            }
        }
    });
}

function syncLoop() {
    if (appState.player && appState.player.getCurrentTime && appState.captions.length > 0) {
        const time = appState.player.getCurrentTime();
        const index = appState.captions.findIndex((c, i) => time >= c.start && time < (appState.captions[i+1]?.start || Infinity));

        if (index !== appState.lastActiveIndex) {
            document.querySelectorAll('.caption-line').forEach(el => el.classList.remove('active'));
            const activeEl = document.getElementById(`cap-${index}`);
            if (activeEl) {
                activeEl.classList.add('active');
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            appState.lastActiveIndex = index;
        }
    }
    requestAnimationFrame(syncLoop);
}

async function switchVideo(id) {
    appState.currentVideoId = id;
    const isPDF = id.endsWith('.pdf');
    const isOnlyTranscript = id.startsWith('__');
    const isBili = id.startsWith('bili:'); // New Detection
    const studyGrid = document.querySelector('.study-grid');

    // 1. Clean up state
    studyGrid.classList.remove('pdf-mode', 'transcript-only-mode');
    speechManager.stop(); // Stop any ongoing voice

    if (isPDF) {
        studyGrid.classList.add('pdf-mode');
        studyGrid.innerHTML = `
            <div class="pdf-container">
                <object data="${id}" type="application/pdf" width="100%" height="100%">
                    <embed src="${id}" type="application/pdf" />
                </object>
            </div>`;
    } else if (isOnlyTranscript) {
        studyGrid.classList.add('transcript-only-mode');
        studyGrid.innerHTML = `
            <div class="transcript-column" style="width: 100%;">
                <div id="caption-box"><div id="transcript"></div></div>
            </div>`;
        await loadCaptions(); // Load JSON for the __ key
    } else if (isBili) {
        // BiliBili Embed Mode[cite: 3]
        const bvid = id.replace('bili:', '');
        studyGrid.innerHTML = `
            <div class="video-column">
                <div class="video-wrapper">
                    <iframe src="//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0" 
                            style="width:100%; height:100%;" 
                            frameborder="no" scrolling="no" allowfullscreen="true">
                    </iframe>
                </div>
            </div>
            <div class="transcript-column">
                <div id="caption-box"><div id="transcript"></div></div>
            </div>`;

        if (appState.player && appState.player.destroy) appState.player.destroy(); // Clean up YT
        await loadCaptions();
    } else {
        // 2. IMPORTANT: Re-inject the video/transcript skeleton[cite: 1]
        studyGrid.innerHTML = `
            <div class="video-column"><div class="video-wrapper"><div id="player"></div></div></div>
            <div class="transcript-column"><div id="caption-box"><div id="transcript"></div></div></div>`;

        // 3. Force re-initialization of the Player
        // If the player exists, destroy the old instance to avoid memory leaks
        if (appState.player && typeof appState.player.destroy === 'function') {
            appState.player.destroy();
        }

        // Re-run the API constructor
        onYouTubeIframeAPIReady();
        await loadCaptions();
    }

    appState.lastActiveIndex = -1;
    renderVideoList(); // Update active sidebar button
    loadNotes(); // Load notes for this specific id
}

/* */
function updatePinyinFromDiv(el, pyId) {
    const text = el.innerText; // Use innerText for contenteditable
    document.getElementById(pyId).innerText = pinyinPro.pinyin(text);
}

// Update your saveNotes function to use innerText as well[cite: 2]
function saveNotes() {
    const master = JSON.parse(localStorage.getItem('yt_notebook_master')) || {};
    const data = Array.from(document.querySelectorAll('.parent-bar')).map(p => ({
        title: p.querySelector('.parent-input').innerText, // Changed to innerText[cite: 2]
        subNotes: Array.from(p.querySelectorAll('.child-input')).map(c => c.innerText) // Changed to innerText[cite: 2]
    }));
    master[appState.currentVideoId] = data;
    localStorage.setItem('yt_notebook_master', JSON.stringify(master));
}

function loadNotes() {
    const board = document.getElementById('notes-board');
    board.innerHTML = '';
    const master = JSON.parse(localStorage.getItem('yt_notebook_master')) || {};
    const currentData = master[appState.currentVideoId] || [];

    currentData.forEach(item => {
        const parent = createParentUI(item.title);
        board.appendChild(parent);
        item.subNotes.forEach(sub => addChild(parent.id, sub));
    });
}

function createParentUI(val = "") {
    const id = 'p-' + Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.className = 'parent-bar';
    div.id = id;
    div.draggable = true;
    div.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px;">
            <button class="btn-speak-small" onclick="speechManager.speak(document.getElementById('${id}-in').innerText)">🔊</button>
            <div style="flex-grow:1">
                <div id="${id}-in" class="parent-input" contenteditable="true" oninput="updatePinyinFromDiv(this, '${id}-py'); saveNotes()">${val}</div>
                <div id="${id}-py" class="pinyin-display">${val ? pinyinPro.pinyin(val) : ''}</div>
            </div>
            <button class="btn-primary" style="background:#30363d" onclick="addChild('${id}')">+ Sub</button>
            <button class="nav-item" style="color:var(--danger); width:auto" onclick="this.closest('.parent-bar').remove(); saveNotes()">Delete</button>
        </div>
        <div class="child-pile" id="pile-${id}"></div>
    `;
    div.addEventListener('dragstart', (e) => {
        dragTarget = div;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => div.style.opacity = "0.9", 0);
    });

    div.addEventListener('dragover', (e) => {
        e.preventDefault(); // REQUIRED to allow a drop
    });

    div.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragTarget !== div) {
            const board = document.getElementById('notes-board');
            const allNodes = Array.from(board.children);
            if (allNodes.indexOf(dragTarget) < allNodes.indexOf(div)) {
                div.after(dragTarget);
            } else {
                div.before(dragTarget);
            }
            saveNotes(); // Save the new order
        }
    });
    return div;
}

// Update the internal HTML inside the addChild function in script.js
function addChild(parentId, val = "") {
    const id = 'c-' + Math.random().toString(36).substr(2, 9);
    const pile = document.getElementById(`pile-${parentId}`);
    const div = document.createElement('div');
    div.className = 'child-bar';
    div.innerHTML = `
        <div class="child-content-wrapper">
            <button class="btn-speak-small" onclick="speechManager.speak(document.getElementById('${id}-in').innerText)">🔊</button>
            <div class="child-text-group">
                <div class="child-input" id="${id}-in"  contenteditable="true" oninput="updatePinyinFromDiv(this, '${id}-py'); saveNotes()">${val}</div>
                <div id="${id}-py" class="pinyin-display">${val ? pinyinPro.pinyin(val) : ''}</div>
            </div>
        </div>
        <button class="nav-item btn-del-child" onclick="this.parentElement.remove(); saveNotes()">×</button>
    `;
    pile.appendChild(div);
}


function addParent() {
    const p = createParentUI();
    document.getElementById('notes-board').prepend(p);
    saveNotes();
}

function switchMode(mode) {
    const views = {
        'sessions': document.getElementById('video-list'),
        'flashcards': document.getElementById('flashcard-list'),
        'stats': document.getElementById('stats-view')
    };
    const searchInput = document.getElementById('session-search');

    // 1. Toggle visibility of all sections
    Object.keys(views).forEach(key => {
        views[key].style.display = (key === mode) ? 'block' : 'none';
    });

    // 2. Hide search input if we are in stats
    searchInput.style.display = (mode === 'sessions') ? 'block' : 'none';

    // 3. Update button active states
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase().includes(mode.substring(0, 4)));
    });

    // 4. If switching to stats, trigger the bar animation
    if (mode === 'stats') {
        updateStatsGraphs();
    }
}

function updateStatsGraphs() {
    // Example logic: calculate percentages based on a total
    // Replace these with your actual data variables
    const data = {
        new: parseInt(document.getElementById('stat-new').innerText) || 5,
        learning: parseInt(document.getElementById('stat-learning').innerText) || 12,
        mastered: parseInt(document.getElementById('stat-mastered').innerText) || 25
    };

    const total = data.new + data.learning + data.mastered || 1;

    document.getElementById('bar-new').style.width = `${(data.new / total) * 100}%`;
    document.getElementById('bar-learning').style.width = `${(data.learning / total) * 100}%`;
    document.getElementById('bar-mastered').style.width = `${(data.mastered / total) * 100}%`;
}

function filterSessions() {
    const query = document.getElementById('session-search').value.toLowerCase();

    document.querySelectorAll('.category-section').forEach(section => {
        let hasMatch = false;
        const items = section.querySelectorAll('.nav-item');

        items.forEach(item => {
            const matches = item.innerText.toLowerCase().includes(query);
            item.style.display = matches ? 'block' : 'none';
            if (matches) hasMatch = true;
        });

        // Show category only if it contains a matching item
        section.style.display = hasMatch ? 'block' : 'none';

        // Optionally auto-expand sections during search
        if (query.length > 0 && hasMatch) {
            section.open = true;
        }
    });
}

const StudyManager = {
    deck: [],
    currentIndex: 0,

    /**
     * STAGE 1: SYNC & DECOUPLE
     * Pulls notes from all sessions and clones them into 'flashcards_master'
     */
    syncToGlobal: function() {
        const masterNotes = JSON.parse(localStorage.getItem('yt_notebook_master')) || {};
        let globalCards = JSON.parse(localStorage.getItem('flashcards_master')) || [];

        let newAddedCount = 0;

        // Iterate through all stored sessions (YouTube, BiliBili, __transcript, PDF)
        Object.keys(masterNotes).forEach(sessionId => {
            masterNotes[sessionId].forEach(note => {
                // Prevent duplicates based on the title (Chinese term)
                const exists = globalCards.some(card => card.front === note.title);

                if (!exists && note.title.trim() !== "") {
                    globalCards.push({
                        id: 'card-' + Date.now() + Math.random().toString(36).substr(2, 5),
                        front: note.title,
                        back: note.subNotes.join('<br>'),
                        mastery: note.mastery || 0,
                        source: sessionId,
                        lastSeen: 0,
                        timesSeen: 0
                    });
                    newAddedCount++;
                }
            });
        });

        localStorage.setItem('flashcards_master', JSON.stringify(globalCards));
        console.log(`Synced ${newAddedCount} new cards to Global Deck.`);
    },

    /**
     * STAGE 2: SESSION INITIALIZATION
     */
    startGlobalReview: function() {
        this.syncToGlobal();
        const globalCards = JSON.parse(localStorage.getItem('flashcards_master')) || [];
        const mode = document.getElementById('review-mode-select').value;
        const now = Date.now();
        const threeDays = 3 * 24 * 60 * 60 * 1000;

        let filteredDeck = [];

        switch(mode) {
            case 'learning': // Mastery level 1 (Study Again)
                filteredDeck = globalCards.filter(c => c.mastery === 1);
                break;
            case 'new': // Never seen before (timesSeen is 0)
                filteredDeck = globalCards.filter(c => c.timesSeen === 0);
                break;
            case 'spaced': // Last seen > 3 days ago
                filteredDeck = globalCards.filter(c => (now - (c.lastSeen || 0)) > threeDays);
                break;
            case 'confidence': // Mastery level 2 (Learned)
                filteredDeck = globalCards.filter(c => c.mastery === 2);
                break;
            default: // Random mode
                filteredDeck = [...globalCards];
        }

        if (filteredDeck.length === 0) {
            alert(`No cards found for ${mode} mode!`);
            return;
        }

        this.deck = filteredDeck.sort(() => Math.random() - 0.5);
        this.currentIndex = 0;
        this.showModal();
        this.renderCard();
    },

    /**
     * STAGE 3: UI RENDERING & INTERACTION
     */
    renderCard: function() {
        const card = this.deck[this.currentIndex];
        const cardInner = document.querySelector('.card-inner');

        // Reset flip state for new card
        cardInner.classList.remove('is-flipped');

        // Front remains read-only for Zhongwen hovering; Back is editable[cite: 3]
        document.getElementById('card-front-text').innerText = card.front;
        document.getElementById('card-back-text').innerHTML = card.back;
        document.getElementById('card-progress').innerText =
            `Reviewing: ${this.currentIndex + 1} / ${this.deck.length}`;
    },

    flip: function() {
        document.querySelector('.card-inner').classList.toggle('is-flipped');
    },

    handleGrade: function(isMastered) {
        const card = this.deck[this.currentIndex];
        this.updateGlobalMastery(card.id, isMastered ? 2 : 1);

        this.currentIndex++;
        if (this.currentIndex < this.deck.length) {
            this.renderCard();
        } else {
            alert("Review complete!");
            this.closeView();
        }
    },

    /**
     * STAGE 4: INDEPENDENT DATA MANAGEMENT
     */
    saveEdit: function(element) {
        const cardId = this.deck[this.currentIndex].id;
        let globalCards = JSON.parse(localStorage.getItem('flashcards_master')) || [];

        const cardIndex = globalCards.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            globalCards[cardIndex].back = element.innerHTML;
            localStorage.setItem('flashcards_master', JSON.stringify(globalCards));
            // Update current deck reference too
            this.deck[this.currentIndex].back = element.innerHTML;
        }
    },

    updateGlobalMastery: function(cardId, level) {
        let globalCards = JSON.parse(localStorage.getItem('flashcards_master')) || [];
        const idx = globalCards.findIndex(c => c.id === cardId);
        if (idx !== -1) {
            globalCards[idx].mastery = level;
            globalCards[idx].lastSeen = Date.now();
            globalCards[idx].timesSeen = (globalCards[idx].timesSeen || 0) + 1;
            localStorage.setItem('flashcards_master', JSON.stringify(globalCards));
            this.updateStats(); // Refresh stats board
        }
    },

    deleteCurrentCard: function() {
        if (!confirm("Delete permanently?")) return;
        const cardId = this.deck[this.currentIndex].id;
        let globalCards = JSON.parse(localStorage.getItem('flashcards_master')) || [];
        globalCards = globalCards.filter(c => c.id !== cardId);
        localStorage.setItem('flashcards_master', JSON.stringify(globalCards));
        this.deck.splice(this.currentIndex, 1);

        if (this.currentIndex >= this.deck.length) {
            this.closeView();
        } else {
            this.renderCard();
        }
    },

    showModal: function() {
        // Hide setup, show card UI
        document.getElementById('study-setup').style.display = 'none';
        document.getElementById('study-ui').style.display = 'block';
    },

    closeView: function() {
        document.getElementById('study-setup').style.display = 'block';
        document.getElementById('study-ui').style.display = 'none';
        this.updateStats(); // Refresh the stats bars
    },

    updateStats: function() {
        const cards = JSON.parse(localStorage.getItem('flashcards_master')) || [];
        document.getElementById('stat-new').innerText = cards.filter(c => c.timesSeen === 0).length;
        document.getElementById('stat-learning').innerText = cards.filter(c => c.mastery === 1).length;
        document.getElementById('stat-mastered').innerText = cards.filter(c => c.mastery === 2).length;
    }
};

// Global variable to keep track of selected mode
let selectedReviewMode = 'random';

function setMode(btn) {
    // 1. Update UI
    document.querySelectorAll('.mode-opt').forEach(opt => opt.classList.remove('active'));
    btn.classList.add('active');

    // 2. Set the mode
    selectedReviewMode = btn.getAttribute('data-mode');
}

// Update StudyManager.startGlobalReview to use the limit
StudyManager.startGlobalReview = function() {
    this.syncToGlobal();
    const globalCards = JSON.parse(localStorage.getItem('flashcards_master')) || [];
    const limit = parseInt(document.getElementById('card-limit').value) || 20;
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    let filteredDeck = [];

    // Use the global variable selectedReviewMode instead of the dropdown
    switch(selectedReviewMode) {
        case 'learning': filteredDeck = globalCards.filter(c => c.mastery === 1); break;
        case 'new': filteredDeck = globalCards.filter(c => c.timesSeen === 0); break;
        case 'spaced': filteredDeck = globalCards.filter(c => (now - (c.lastSeen || 0)) > threeDays); break;
        default: filteredDeck = [...globalCards];
    }

    if (filteredDeck.length === 0) {
        alert(`No cards found for ${selectedReviewMode} mode!`);
        return;
    }

    // Shuffle and then APPLY THE LIMIT
    this.deck = filteredDeck.sort(() => Math.random() - 0.5).slice(0, limit);

    this.currentIndex = 0;
    this.showModal(); // This now shows the sidebar UI
    this.renderCard();
};

init();

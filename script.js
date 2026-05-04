// --- CONFIG & STATE ---
const VIDEO_DATA = {
    '1fqsNZ9HGU8': '小lin说：RMB tendency',
    'Q73s8v_d46M': '小lin说：Exchange rate going up',
    'Lb60mjM5B1U': '小lin说：Recap of last 6 years',
    'HeVuAKDtWX8': '小lin说：Iran war',
    'vP45wBOQLS8': '小lin说：SVB bank',
    'hhtMlRZLJ0g': '小lin说：Sports Betting',
    'ERK34RQq9YU': '小lin说：Ads',
    'Euc0HS-0XUs': '小lin说：Marketing Tactics',
    'AJLe1AEgz5M': '小lin说：Vietnam Fraud',
    'ssssR1hxiTw': '小lin说：Middle East Oil',
    'zsOYK-sb3Qo': '二爷故事：Xi and Bo Xilai',
    'aWrqBWs_HJ8': '大问题dialectic：Chinese vs Western Philosophy',
    'bQ-tobjv92k': '有点在李：Concerts prices',
    'tPtHJ2FvtdM': '有点在李：SpaceX IPO',
    'tHv-FSgtcnc': '有点在李：Palantir',
    'uzx5xWNOSws': '有点在李：Claude',
    '8eAJ9PDgUyI': '有点在李：Fight for AI Hegemony',
    'yP3lKQF-nb4': '有点在李：Economics of Museums',
    'bili:BV1LYoGBBEsF': 'Self-care: Why do we feel we are not enough',
    '__Borrador_UNAM_en_Chino': 'Historia de la UNAM',
    'documents/HSK41002.pdf': 'HSK4 test 2',
};

let currentVideoId = '1fqsNZ9HGU8';
let player;
let captions = [];
let lastActiveIndex = -1;

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
    list.innerHTML = Object.entries(VIDEO_DATA).map(([id, title]) => `
        <button class="nav-item ${id === currentVideoId ? 'active' : ''}"
                onclick="switchVideo('${id}')">
            ${title}
        </button>
    `).join('');
}

async function loadCaptions() {
    try {
        // Ensure this path matches your folder structure
        const response = await fetch('captions.json');
        const data = await response.json();

        // IMPORTANT: The key in your JSON must match the ID in VIDEO_DATA exactly
        captions = data[currentVideoId] || [];

        if (captions.length === 0) {
            console.warn(`No transcripts found for ID: ${currentVideoId}`);
        }

        renderTranscript();
    } catch (err) {
        console.error("Error loading transcript JSON:", err);
    }
}

function renderTranscript() {
    const container = document.getElementById('transcript');
    // Check if we are in a mode that doesn't support seeking (BiliBili or Transcript-only)[cite: 3]
    const isBili = currentVideoId.startsWith('bili:');
    const isOnlyTranscript = currentVideoId.startsWith('__');
    const useTTS = isBili || isOnlyTranscript;

    container.innerHTML = captions.map((cap, i) => {
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

    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: currentVideoId,
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
    if (player && player.getCurrentTime && captions.length > 0) {
        const time = player.getCurrentTime();
        const index = captions.findIndex((c, i) => time >= c.start && time < (captions[i+1]?.start || Infinity));

        if (index !== lastActiveIndex) {
            document.querySelectorAll('.caption-line').forEach(el => el.classList.remove('active'));
            const activeEl = document.getElementById(`cap-${index}`);
            if (activeEl) {
                activeEl.classList.add('active');
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            lastActiveIndex = index;
        }
    }
    requestAnimationFrame(syncLoop);
}

async function switchVideo(id) {
    currentVideoId = id;
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

        if (player && player.destroy) player.destroy(); // Clean up YT
        await loadCaptions();
    } else {
        // 2. IMPORTANT: Re-inject the video/transcript skeleton[cite: 1]
        studyGrid.innerHTML = `
            <div class="video-column"><div class="video-wrapper"><div id="player"></div></div></div>
            <div class="transcript-column"><div id="caption-box"><div id="transcript"></div></div></div>`;

        // 3. Force re-initialization of the Player
        // If the player exists, destroy the old instance to avoid memory leaks
        if (player && typeof player.destroy === 'function') {
            player.destroy();
        }

        // Re-run the API constructor
        onYouTubeIframeAPIReady();
        await loadCaptions();
    }

    lastActiveIndex = -1;
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
    master[currentVideoId] = data;
    localStorage.setItem('yt_notebook_master', JSON.stringify(master));
}

function loadNotes() {
    const board = document.getElementById('notes-board');
    board.innerHTML = '';
    const master = JSON.parse(localStorage.getItem('yt_notebook_master')) || {};
    const currentData = master[currentVideoId] || [];

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

function filterSessions() {
    const query = document.getElementById('session-search').value.toLowerCase();
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.style.display = btn.innerText.toLowerCase().includes(query) ? 'block' : 'none';
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

        // Update mastery level in the independent storage[cite: 3]
        this.updateGlobalMastery(card.id, isMastered ? 2 : 1);

        this.currentIndex++;
        if (this.currentIndex < this.deck.length) {
            this.renderCard();
        } else {
            alert("Global review complete!");
            this.closeModal();
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
        if (!confirm("Remove this card permanently from the Global Deck?")) return;

        const cardId = this.deck[this.currentIndex].id;
        let globalCards = JSON.parse(localStorage.getItem('flashcards_master')) || [];

        // Remove from independent storage[cite: 2]
        globalCards = globalCards.filter(c => c.id !== cardId);
        localStorage.setItem('flashcards_master', JSON.stringify(globalCards));

        this.deck.splice(this.currentIndex, 1);
        if (this.currentIndex >= this.deck.length) {
            this.closeModal();
        } else {
            this.renderCard();
        }
    },

    showModal: function() {
        document.getElementById('flashcard-modal').style.display = 'flex';
    },

    closeModal: function() {
        document.getElementById('flashcard-modal').style.display = 'none';
    },

    updateStats: function() {
        const cards = JSON.parse(localStorage.getItem('flashcards_master')) || [];
        document.getElementById('stat-new').innerText = cards.filter(c => c.timesSeen === 0).length;
        document.getElementById('stat-learning').innerText = cards.filter(c => c.mastery === 1).length;
        document.getElementById('stat-mastered').innerText = cards.filter(c => c.mastery === 2).length;
    }
};

init();

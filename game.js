console.log("%c Welcome to the Lyric Vault Dev Console! Crafted by Kisa (2026). Found a bug? Send feedback via GitHub!", "color: #6d5f7c; font-family: sans-serif; font-size: 14px; font-weight: bold;");
// Hardcoded ordered array ensures clean, consistent timeline setups
const CHRONOLOGICAL_ALBUMS = [
    "Taylor Swift",
    "Fearless",
    "Speak Now",
    "Red",
    "1989",
    "Reputation",
    "Lover",
    "folklore",
    "evermore",
    "Midnights",
    "The tortured Poets department"
];

let gameQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let wrongSongs = [];
let filteredPool = [];
let totalHintsUsedInGame = 0;

let currentGameMode = 'casual';
let currentPlayerName = "Anonymous";

let timerInterval = null;
const TOTAL_COMP_TIME = 30 * 60; // 30 minutes in seconds
let secondsRemaining = TOTAL_COMP_TIME;

// Individual tracking values per turn
let hintsUsedThisTurn = 0;

// Tracks whether the pre-game leaderboard dashboard is open on Screen 1
let isSetupLeaderboardOpen = false;

// Text Sanitation Function (Matches Python functionality)
function pure(text) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// =========================================================
// Global Pool Update Logic
// =========================================================
function updateAvailablePool() {
    const numInput = document.getElementById("num-questions");
    const label = document.getElementById("question-label");

    if (!numInput || !label) return;

    // Maps user selections and maps spaces to underscores to match your raw database array values
    const activeDisplayNames = Array.from(document.querySelectorAll('.album-picker:checked')).map(cb => cb.value);
    const activeDatabaseTokens = activeDisplayNames.map(name => name.toLowerCase().replace(/ /g, "_"));

    // Ensure database exists before running filter operation
    const safeDatabase = (typeof songDatabase !== 'undefined') ? songDatabase : [];

    filteredPool = safeDatabase.filter(song => {
        const songAlbumToken = (song.album || "unknown_album").toLowerCase().trim();
        return activeDatabaseTokens.includes(songAlbumToken);
    });

    if (filteredPool.length === 0) {
        label.innerText = "Please select at least one album to enter the vault!";
        numInput.max = 0;
        numInput.value = 0;
        numInput.disabled = true;
    } else {
        numInput.disabled = false;
        numInput.max = filteredPool.length;
        if (parseInt(numInput.value) > filteredPool.length || numInput.value == 0) {
            numInput.value = Math.min(10, filteredPool.length);
        }
        label.innerText = `How many questions would you like? (Max available: ${filteredPool.length})`;
    }
}

// =========================================================
// MASTER CONFIGURATION ENGINE
// =========================================================
function initGameSetup() {
    const numInput = document.getElementById("num-questions");
    const checkboxContainer = document.getElementById("album-checkboxes");

    if (!checkboxContainer) return;

    // Renders boxes mapping directly to your specified sequence ordering rules
    checkboxContainer.innerHTML = CHRONOLOGICAL_ALBUMS.map(album => `
        <label>
            <input type="checkbox" class="album-picker" value="${album}" checked>
            ${album}
        </label>
    `).join('');

    // Bind event change listeners safely
    document.querySelectorAll('.album-picker').forEach(checkbox => {
        checkbox.addEventListener('change', updateAvailablePool);
    });

    // Run pool calculation pass globally
    updateAvailablePool();

    // NEW PASSTHROUGH: Fetch ranking ledger on initial load so it is instantly buffered
    renderLeaderboardView();

    if (numInput) numInput.focus();
}

function setMode(mode) {
    currentGameMode = mode;
    document.getElementById('tab-casual').classList.toggle('active', mode === 'casual');
    document.getElementById('tab-comp').classList.toggle('active', mode === 'comp');

    document.getElementById('casual-fields').classList.toggle('hidden', mode !== 'casual');
    document.getElementById('comp-fields').classList.toggle('hidden', mode !== 'comp');

    if (mode === 'casual') {
        document.getElementById("num-questions").focus();
    } else {
        document.getElementById("player-name").focus();
    }
}

// Balanced Shuffling Engine (Eliminates system clustering biases)
function fisherYatesShuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startGame() {
    wrongSongs = [];
    score = 0;
    currentQuestionIndex = 0;
    totalHintsUsedInGame = 0;

    let quizNum = 5;
    let selectedPoolSource = [];

    if (currentGameMode === 'casual') {
        quizNum = parseInt(document.getElementById("num-questions").value) || 5;
        if (filteredPool.length < quizNum || quizNum <= 0) {
            alert("Please select a valid question tally within active pool limits!");
            return;
        }
        selectedPoolSource = [...filteredPool];
        document.getElementById("game-timer").style.display = "none";
    } else {
        const nameInput = document.getElementById("player-name").value.trim();
        if (!nameInput) {
            alert("Please enter your name/initials to register for competition rankings!");
            return;
        }
        currentPlayerName = nameInput;
        selectedPoolSource = (typeof songDatabase !== 'undefined') ? [...songDatabase] : [];
        quizNum = selectedPoolSource.length;

        // Initializes background countdown loops
        secondsRemaining = TOTAL_COMP_TIME;
        document.getElementById("game-timer").style.display = "block";
        updateTimerDisplay();
        clearInterval(timerInterval);
        timerInterval = setInterval(tickTimer, 1000);
    }

    // Shuffles full stack and slices out target deck requirements
    const shuffledDeck = fisherYatesShuffle(selectedPoolSource);
    const chosenRoundSongs = shuffledDeck.slice(0, quizNum);

    // Dynamic Tracking Structure handles mid-array lookahead steps safely
    gameQuestions = chosenRoundSongs.map(song => {
        const startingIndex = Math.floor(Math.random() * song.snippets.length);
        return {
            title: song.title,
            allLyrics: song.snippets,
            currentLyricIndex: startingIndex,
            viewedIndices: [startingIndex]
        };
    });

    document.getElementById("last-result").className = "last-result-banner";
    document.getElementById("last-result").innerHTML = "";

    showScreen("game-screen");
    loadQuestion();
}

function tickTimer() {
    secondsRemaining--;
    updateTimerDisplay();

    if (secondsRemaining <= 0) {
        clearInterval(timerInterval);
        alert("Time's up! The lyric vault doors have locked down!");
        showResults(true);
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
    document.getElementById("game-timer").innerText =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function loadQuestion() {
    const answerInput = document.getElementById("answer-input");
    answerInput.value = "";
    setTimeout(() => { answerInput.focus(); }, 5);

    const currentQuestion = gameQuestions[currentQuestionIndex];

    // Reset individual turn limits
    hintsUsedThisTurn = 0;
    const hintBtn = document.getElementById("hint-btn");
    hintBtn.style.display = "block";
    hintBtn.disabled = false;
    hintBtn.innerText = "More Lyrics (5 Left)";

    const primarySnippetText = currentQuestion.allLyrics[currentQuestion.currentLyricIndex];

    document.getElementById("lyric-display").innerHTML = `<span class="lyric-line">"${sanitizeSpoiler(primarySnippetText, currentQuestion.title)}"</span>`;
    document.getElementById("question-tracker").innerText = `Question ${currentQuestionIndex + 1} of ${gameQuestions.length}`;

    const progressPercent = (currentQuestionIndex / gameQuestions.length) * 100;
    document.getElementById("progress-fill").style.width = `${progressPercent}%`;

    document.getElementById("action-btn").innerText = (currentQuestionIndex + 1 < gameQuestions.length) ? "Submit Guess" : "Finish Quiz";
}

function submitAnswer() {
    const answerInput = document.getElementById("answer-input");
    const currentQuestion = gameQuestions[currentQuestionIndex];
    const banner = document.getElementById("last-result");

    const playerGuess = pure(answerInput.value);
    const standardGoldenTarget = pure(currentQuestion.title);

    let isCorrect = (playerGuess === standardGoldenTarget);

    // Advanced Evaluation Pipeline (Interchange handles connective phrases and text open boundaries)
    if (!isCorrect) {
        const variantAndTarget = pure(currentQuestion.title.replace(/&/g, 'and'));
        const variantAmpTarget = pure(currentQuestion.title.replace(/\band\b/g, ''));
        if (playerGuess === variantAndTarget || playerGuess === variantAmpTarget) {
            isCorrect = true;
        }
    }

    // Drops parenthetical sections to match localized shorthand title variations
    if (!isCorrect && currentQuestion.title.includes('(')) {
        const baseTitlePart = currentQuestion.title.split('(')[0];
        if (playerGuess === pure(baseTitlePart)) {
            isCorrect = true;
        }
    }

    const firstShownLyric = currentQuestion.allLyrics[currentQuestion.viewedIndices[0]];

    if (isCorrect) {
        score++;
        // \u2705 translates cleanly to the visual green check icon at runtime
        banner.innerHTML = `\u2705 Correct: "${currentQuestion.title}"`;
        banner.className = "last-result-banner show correct";
    } else {
        wrongSongs.push({ title: currentQuestion.title, lyric: firstShownLyric });
        // \u274C translates cleanly to the visual red cross icon at runtime
        banner.innerHTML = `\u274C Last Answer: "${currentQuestion.title}"`;
        banner.className = "last-result-banner show incorrect";
    }

    currentQuestionIndex++;
    if (currentQuestionIndex < gameQuestions.length) {
        loadQuestion();
    } else {
        clearInterval(timerInterval);
        showResults(false);
    }
}

// Intercepts input entry field events to prevent generic browser reload actions
document.getElementById("answer-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        submitAnswer();
    }
});

// Multi-Line Fragment Traversal Core Architecture
function getMoreLyric() {
    const currentQuestion = gameQuestions[currentQuestionIndex];
    const totalLinesAvailable = currentQuestion.allLyrics.length;
    const hintBtn = document.getElementById("hint-btn");

    if (totalLinesAvailable <= 1) {
        hintBtn.innerText = "No more lines inside track";
        hintBtn.disabled = true;
        return;
    }

    // Step 1: Attempt dynamic chronological forward search
    let targetSnippetIndex = currentQuestion.currentLyricIndex + 1;

    // Step 2: Corner Case Check - If lookahead spills over array length, reverse into trace indexes
    if (targetSnippetIndex >= totalLinesAvailable) {
        targetSnippetIndex = Math.min(...currentQuestion.viewedIndices) - 1;
    }

    // Step 3: Absolute loop safety block protects bounds
    if (targetSnippetIndex < 0 || targetSnippetIndex >= totalLinesAvailable || currentQuestion.viewedIndices.includes(targetSnippetIndex)) {
        hintBtn.innerText = "Out of lyrics!";
        hintBtn.disabled = true;
        return;
    }

    // Commit tracked index changes to global state variables
    currentQuestion.currentLyricIndex = targetSnippetIndex;
    currentQuestion.viewedIndices.push(targetSnippetIndex);
    hintsUsedThisTurn++;
    totalHintsUsedInGame++;

    const freshHintText = currentQuestion.allLyrics[targetSnippetIndex];
    const displayFrame = document.getElementById("lyric-display");

    // Injects secondary lines inside custom styling tags at smaller dimensions (1rem)
    displayFrame.innerHTML += `<span class="lyric-line" style="border-top: 1px dashed rgba(201,180,166,0.25); padding-top: 8px; font-size: 1rem; font-family: -apple-system, sans-serif; opacity: 0.75;">"${sanitizeSpoiler(freshHintText, currentQuestion.title)}"</span>`;

    // Limits interaction threshold to exactly 5 clicks maximum
    if (hintsUsedThisTurn >= 5) {
        hintBtn.style.display = "none";
    } else {
        hintBtn.innerText = `More Lyrics (${5 - hintsUsedThisTurn} Left)`;
    }

    document.getElementById("answer-input").focus();
}

function sanitizeSpoiler(lyric, title) {
    const escapedTitle = title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return lyric.replace(new RegExp(escapedTitle, 'gi'), "[???]");
}

function showResults(forcedTimeout = false) {
    document.getElementById("progress-fill").style.width = "100%";
    showScreen("results-screen");

    const totalQuestions = gameQuestions.length;
    const accuracyPercent = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

    document.getElementById("score-display").innerText = `${score} / ${totalQuestions}`;
    document.getElementById("end-status-heading").innerText = forcedTimeout ? "Time's Up!" : "Quiz Complete";

    const feedbackCard = document.getElementById("tier-feedback-card");
    const timeDisplay = document.getElementById("time-spent-display");

    // Dynamic Tier Presentation Engine (Using pure safe strings)
    if (accuracyPercent === 100) {
        feedbackCard.className = "tier-card flawless";
        feedbackCard.innerHTML = "<strong>&#x1F389;FLAWLESS&#x1F389;</strong><br>This game is flawless, don't you let it go!";
    } else if (accuracyPercent >= 80) {
        feedbackCard.className = "tier-card congrats";
        feedbackCard.innerHTML = "<strong>VERY GOOD</strong><br>Incredible job! You know you're good when you can even do it with just a few mistakes!";
    } else if (accuracyPercent >= 50) {
        feedbackCard.className = "tier-card congrats";
        feedbackCard.innerHTML = "<strong>NOT BAD</strong><br>Good effort! A few more repeats of the albums and you'll be a Mastermind.";
    } else {
        feedbackCard.className = "tier-card oops";
        feedbackCard.innerHTML = "<strong>Shake It Off!</strong><br>This wasn't a good score but the players' gonna play play play!";
    }

    if (currentGameMode === 'comp') {
        const timeElapsedSeconds = TOTAL_COMP_TIME - secondsRemaining;
        const minutesUsed = Math.floor(timeElapsedSeconds / 60);
        const secondsUsed = timeElapsedSeconds % 60;
        timeDisplay.innerText = `Total Duration: ${minutesUsed}m ${secondsUsed}s | Total Hints Demanded: ${totalHintsUsedInGame}`;
        timeDisplay.style.display = "block";

        saveToStagedLeaderboard(currentPlayerName, score, totalQuestions, timeElapsedSeconds, totalHintsUsedInGame);
        renderLeaderboardView();
        document.getElementById("leaderboard-panel").classList.remove('hidden');
    } else {
        timeDisplay.style.display = "none";
        document.getElementById("leaderboard-panel").classList.add('hidden');
    }

    const summaryDiv = document.getElementById("incorrect-summary");
    if (wrongSongs.length > 0) {
        summaryDiv.style.display = "block";
        summaryDiv.innerHTML = "<strong>Review What You Missed:</strong><br><br>";
        wrongSongs.forEach(item => {
            // 1. Standard search keywords
            const baseQuery = "Taylor Swift " + item.title;

            // 2. Advanced operator that strictly forces YouTube to search within her official channel ID path
            const channelFilter = ' url:"/user/TaylorSwift"';

            // 3. Combine and convert to a clean, browser-safe ASCII string format
            const searchQuery = encodeURIComponent(baseQuery + channelFilter);
            const listenUrl = "https://www.youtube.com/results?search_query=" + searchQuery;

            summaryDiv.innerHTML += `
                <div class="incorrect-item">
                    Correct Answer: <strong>${item.title}</strong>
                    <a href="${listenUrl}" target="_blank" style="color:var(--primary-color); font-size:0.8rem; margin-left:8px; text-decoration:underline;">[Listen Now]</a>
                    <br>
                    <small style="color:#777;">Initial line shown: "${item.lyric}"</small>
                </div>
            `;
        });
    } else {
        summaryDiv.style.display = "none";
    }
}

// Mocked Sandbox Data Pipeline handles sorting structures inside local staging memory blocks
function saveToStagedLeaderboard(name, score, total, seconds, hints) {
    let leaderboard = JSON.parse(localStorage.getItem('ts_vault_global_mock')) || [];
    leaderboard.push({ name, score, total, seconds, hints, date: new Date().toLocaleDateString() });

    // Multi-tiered High Score Sorting Hierarchy Equation
    leaderboard.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score; // 1st Priority: Accuracy (Desc)
        if (a.seconds !== b.seconds) return a.seconds - b.seconds; // 2nd Priority: Duration (Asc)
        return a.hints - b.hints; // 3rd Priority: Hints (Asc)
    });

    localStorage.setItem('ts_vault_global_mock', JSON.stringify(leaderboard.slice(0, 10)));
}

function renderLeaderboardView() {
    const scores = JSON.parse(localStorage.getItem('ts_vault_global_mock')) || [];

    // Target both rendering slots simultaneously
    const postGameBody = document.getElementById("leaderboard-rows");
    const preGameBody = document.getElementById("setup-leaderboard-rows");

    // Generate clean template literal rows matching your ledger properties
    const tableHTMLContent = scores.length === 0
        ? `<tr><td colspan="5" style="text-align:center; color:#999;">Leaderboard is empty. Be the first to claim a rank!</td></tr>`
        : scores.map((entry, idx) => `
            <tr>
                <td><strong>#${idx + 1}</strong></td>
                <td>${entry.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>
                <td>${entry.score}/${entry.total}</td>
                <td>${Math.floor(entry.seconds / 60)}m ${entry.seconds % 60}s</td>
                <td>${entry.hints}</td>
            </tr>
          `).join('');

    // Safely inject the rows into whichever slots are active on the DOM layout
    if (postGameBody) postGameBody.innerHTML = tableHTMLContent;
    if (preGameBody) preGameBody.innerHTML = tableHTMLContent;
}

function restartGame() {
    clearInterval(timerInterval);
    showScreen("setup-screen");
    document.getElementById("num-questions").focus();
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// =========================================================
// OPTION A VIEW CONTROLLER: Toggles Pre-Game Leaderboard
// =========================================================
function toggleSetupLeaderboard(event) {
    if (event) event.preventDefault(); // Prevents the browser from reloading the page path

    const fieldsContainer = document.getElementById("setup-fields-container");
    const leaderboardView = document.getElementById("setup-leaderboard-view");
    const linkBtn = document.getElementById("view-board-link");

    if (!fieldsContainer || !leaderboardView || !linkBtn) return;

    // Flip the state flag back and forth
    isSetupLeaderboardOpen = !isSetupLeaderboardOpen;

    if (isSetupLeaderboardOpen) {
        // Hide config settings and reveal high scores
        fieldsContainer.classList.add("hidden");
        leaderboardView.classList.remove("hidden");
        linkBtn.innerText = "Back to Game Setup";

        // Refresh rows to guarantee player is seeing live cloud data snapshots
        renderLeaderboardView();
    } else {
        // Show config settings and hide high scores
        fieldsContainer.classList.remove("hidden");
        leaderboardView.classList.add("hidden");
        linkBtn.innerText = "View Global Rankings";
    }
}

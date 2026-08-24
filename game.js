console.log("%c Welcome to the Taylor Swift Lyrics Test Console! Crafted by Kisa (2026).", "color: #6d5f7c; font-family: sans-serif; font-size: 14px; font-weight: bold;");

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
    "The tortured Poets department",
    "The Life of a Showgirl"
];

const ALBUM_EMOJIS = {
    "Taylor Swift": "&#x1F49A;",
    "Fearless": "&#x1F49B;",
    "Speak Now": "&#x1F49C;",
    "Red": "&#x2764;&#xFE0F;",
    "1989": "&#x1F48E;",
    "Reputation": "&#x1F5A4;",
    "Lover": "&#x1F496;",
    "folklore": "&#x1faa9;",
    "evermore": "&#x1F90E;",
    "Midnights": "&#x1F499;",
    "The tortured Poets department": "&#x1F90D;",
    "The Life of a Showgirl": "&#x1F9E1;"
};

let gameQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let wrongSongs = [];
let filteredPool = [];
let totalHintsUsedInGame = 0;

let isRankedMode = true;
let currentPlayerName = "Anonymous";

let timerInterval = null;
const TOTAL_COMP_TIME = 40 * 60; // 40 minutes in seconds
let secondsRemaining = TOTAL_COMP_TIME;

let hintsUsedThisTurn = 0;
let isSetupLeaderboardOpen = false;

// Updated pure(): preserves $ for stylized titles, strips standard punctuation & spaces
function pure(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9$]/g, '');
}

// Central matching function (Single Source of Truth)
function checkGuessMatch(playerGuess, actualTitle) {
    const pGuess = pure(playerGuess);
    if (!pGuess) return false;

    // Generate valid target variations
    const targets = [];

    // 1. Spoken title ($ -> s)
    const spokenTitle = actualTitle.replace(/\$/g, 's');
    targets.push(pure(spokenTitle));

    // 2. Literal official title (keeps $)
    targets.push(pure(actualTitle));

    // 3. Base title without parenthetical/bracketed content
    if (actualTitle.includes('(') || actualTitle.includes('[')) {
        const baseTitle = actualTitle.split(/[\(\[]/)[0];
        targets.push(pure(baseTitle.replace(/\$/g, 's')));
        targets.push(pure(baseTitle));
    }

    // Evaluate guess against all targets under & / and interchangeability
    for (const target of targets) {
        if (!target) continue;

        // Direct match
        if (pGuess === target) return true;

        // & -> and
        const targetWithAnd = pure(target.replace(/&/g, 'and'));
        if (pGuess === targetWithAnd) return true;

        // and -> &
        const targetWithAmp = pure(target.replace(/\band\b/gi, '&'));
        if (pGuess === targetWithAmp) return true;
    }

    return false;
}

function updateAvailablePool() {
    const numInput = document.getElementById("num-questions");
    const label = document.getElementById("question-label");

    if (!numInput || !label) return;

    const safeDatabase = (typeof songDatabase !== 'undefined') ? songDatabase : [];

    if (isRankedMode) {
        filteredPool = [...safeDatabase];
        numInput.disabled = true;
        numInput.max = filteredPool.length;
        numInput.value = filteredPool.length;
        const subtitle = document.getElementById("ranked-subtitle-text");
        if (subtitle) {
            subtitle.innerHTML = `40 min limit &#8226; All ${filteredPool.length} songs &#8226; Global leaderboard`;
        }
        return;
    }

    const activeDisplayNames = Array.from(document.querySelectorAll('.album-picker:checked')).map(cb => cb.value);
    const activeDatabaseTokens = activeDisplayNames.map(name => name.toLowerCase().replace(/ /g, "_"));

    filteredPool = safeDatabase.filter(song => {
        const songAlbumToken = (song.album || "unknown_album").toLowerCase().trim();
        return activeDatabaseTokens.includes(songAlbumToken);
    });

    if (filteredPool.length === 0) {
        label.innerText = "Please select at least one album!";
        numInput.max = 0;
        numInput.value = 0;
        numInput.disabled = true;
    } else {
        numInput.disabled = false;
        numInput.max = filteredPool.length;
        if (parseInt(numInput.value) > filteredPool.length || numInput.value == 0) {
            numInput.value = Math.min(10, filteredPool.length);
        }
        label.innerText = `Number of questions (Max: ${filteredPool.length}):`;
    }
}

function toggleRankedMode() {
    const rankedCheckbox = document.getElementById("comp-checkbox");
    const customFields = document.getElementById("custom-fields");

    isRankedMode = rankedCheckbox.checked;

    if (isRankedMode) {
        customFields.classList.add("hidden");
    } else {
        customFields.classList.remove("hidden");
    }

    updateAvailablePool();
}

function initGameSetup() {
    const numInput = document.getElementById("num-questions");
    const checkboxContainer = document.getElementById("album-checkboxes");

    if (!checkboxContainer) return;

    const safeDatabase = (typeof songDatabase !== 'undefined') ? songDatabase : [];

    // 1. Extract all unique album tokens from songDatabase
    const dbAlbums = Array.from(new Set(safeDatabase.map(s => s.album).filter(Boolean)));

    // 2. Map database tokens back to canonical names
    const availableAlbums = dbAlbums.map(albumToken => {
        const canonical = CHRONOLOGICAL_ALBUMS.find(
            a => a.toLowerCase().replace(/ /g, "_") === albumToken.toLowerCase().trim()
        );
        if (canonical) return canonical;

        // Fallback formatting for unexpected album names
        return albumToken
            .replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    });

    // Sort available albums chronologically according to CHRONOLOGICAL_ALBUMS
    availableAlbums.sort((a, b) => {
        let indexA = CHRONOLOGICAL_ALBUMS.indexOf(a);
        let indexB = CHRONOLOGICAL_ALBUMS.indexOf(b);
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        return indexA - indexB;
    });

    // 3. Render checkboxes with album emoji entity on the left
    checkboxContainer.innerHTML = availableAlbums.map(album => {
        const emoji = ALBUM_EMOJIS[album] || "&#x1F3B5;";

        return `
            <label>
                <input type="checkbox" class="album-picker" value="${album}" checked>
                ${emoji} ${album}
            </label>
        `;
    }).join('');

    document.querySelectorAll('.album-picker').forEach(checkbox => {
        checkbox.addEventListener('change', updateAvailablePool);
    });

    const compCheckbox = document.getElementById("comp-checkbox");
    if (compCheckbox) {
        compCheckbox.addEventListener('change', toggleRankedMode);
    }

    toggleRankedMode(); // Ensure state starts correctly
    renderLeaderboardView();

    const nameInput = document.getElementById("player-name");
    if (nameInput) nameInput.focus();
}

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

    const nameInput = document.getElementById("player-name").value.trim();

    if (!isRankedMode) {
        quizNum = parseInt(document.getElementById("num-questions").value) || 5;
        if (filteredPool.length < quizNum || quizNum <= 0) {
            alert("Please select a valid question count within available limits!");
            return;
        }
        selectedPoolSource = [...filteredPool];
        document.getElementById("game-timer").style.display = "none";
    } else {
        if (!nameInput) {
            alert("Please enter your name to register on the global leaderboard!");
            return;
        }
        currentPlayerName = nameInput;
        selectedPoolSource = (typeof songDatabase !== 'undefined') ? [...songDatabase] : [];
        quizNum = selectedPoolSource.length;

        secondsRemaining = TOTAL_COMP_TIME;
        document.getElementById("game-timer").style.display = "block";
        updateTimerDisplay();
        clearInterval(timerInterval);
        timerInterval = setInterval(tickTimer, 1000);
    }

    const shuffledDeck = fisherYatesShuffle(selectedPoolSource);
    const chosenRoundSongs = shuffledDeck.slice(0, quizNum);

    gameQuestions = chosenRoundSongs.map(song => {
        let startingIndex = Math.floor(Math.random() * song.snippets.length);
        const pureTitle = pure(song.title);

        // Smart Lookahead: Attempts up to 5 times to pick an initial snippet that does NOT contain the song title
        let attempts = 0;
        while (pure(song.snippets[startingIndex]).includes(pureTitle) && attempts < 5) {
            startingIndex = Math.floor(Math.random() * song.snippets.length);
            attempts++;
        }

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
        alert("Time's up! The vault has locked!");
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

    const isCorrect = checkGuessMatch(answerInput.value, currentQuestion.title);
    const firstShownLyric = currentQuestion.allLyrics[currentQuestion.viewedIndices[0]];

    if (isCorrect) {
        score++;
        banner.innerHTML = `\u2705 Correct: "${currentQuestion.title}"`;
        banner.className = "last-result-banner show correct";
    } else {
        wrongSongs.push({ title: currentQuestion.title, lyric: firstShownLyric });
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

document.getElementById("answer-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        submitAnswer();
    }
});

function getMoreLyric() {
    const currentQuestion = gameQuestions[currentQuestionIndex];
    const totalLinesAvailable = currentQuestion.allLyrics.length;
    const hintBtn = document.getElementById("hint-btn");

    if (totalLinesAvailable <= 1) {
        hintBtn.innerText = "No more lines available";
        hintBtn.disabled = true;
        return;
    }

    let targetSnippetIndex = currentQuestion.currentLyricIndex + 1;

    if (targetSnippetIndex >= totalLinesAvailable) {
        targetSnippetIndex = Math.min(...currentQuestion.viewedIndices) - 1;
    }

    if (targetSnippetIndex < 0 || targetSnippetIndex >= totalLinesAvailable || currentQuestion.viewedIndices.includes(targetSnippetIndex)) {
        hintBtn.innerText = "Out of lyrics!";
        hintBtn.disabled = true;
        return;
    }

    currentQuestion.currentLyricIndex = targetSnippetIndex;
    currentQuestion.viewedIndices.push(targetSnippetIndex);
    hintsUsedThisTurn++;
    totalHintsUsedInGame++;

    const freshHintText = currentQuestion.allLyrics[targetSnippetIndex];
    const displayFrame = document.getElementById("lyric-display");

    displayFrame.innerHTML += `<span class="lyric-line" style="border-top: 1px dashed rgba(201,180,166,0.25); padding-top: 8px; font-size: 0.95rem; opacity: 0.75;">"${sanitizeSpoiler(freshHintText, currentQuestion.title)}"</span>`;

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

    const rawName = document.getElementById("player-name").value.trim();
    const displayName = rawName ? rawName : "Swiftie";

    if (accuracyPercent === 100) {
        feedbackCard.className = "tier-card flawless";
        feedbackCard.innerHTML = `<strong>&#x1F389; FLAWLESS, ${displayName}! &#x1F389;</strong><br>This game is flawless, don't you let it go!`;
    } else if (accuracyPercent >= 80) {
        feedbackCard.className = "tier-card congrats";
        feedbackCard.innerHTML = `<strong>INCREDIBLE, ${displayName}!</strong><br>Long story short, you survived! You're a true Mastermind.`;
    } else if (accuracyPercent >= 50) {
        feedbackCard.className = "tier-card congrats";
        feedbackCard.innerHTML = `<strong>NOT BAD, ${displayName}!</strong><br>You know you're good when you can even do it with a few mistakes.`;
    } else {
        feedbackCard.className = "tier-card oops";
        feedbackCard.innerHTML = `<strong>Shake It Off, ${displayName}!</strong><br>This wasn't your best run, but the players gonna play, play, play!`;
    }

    if (isRankedMode) {
        const timeElapsedSeconds = TOTAL_COMP_TIME - secondsRemaining;
        const minutesUsed = Math.floor(timeElapsedSeconds / 60);
        const secondsUsed = timeElapsedSeconds % 60;
        timeDisplay.innerText = `Total Duration: ${minutesUsed}m ${secondsUsed}s | Hints Used: ${totalHintsUsedInGame}`;
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
            const baseQuery = "Taylor Swift " + item.title;
            const channelFilter = ' url:"/user/TaylorSwift"';
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

function saveToStagedLeaderboard(name, score, total, seconds, hints) {
    let leaderboard = JSON.parse(localStorage.getItem('ts_vault_global_mock')) || [];
    leaderboard.push({ name, score, total, seconds, hints, date: new Date().toLocaleDateString() });

    leaderboard.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.seconds !== b.seconds) return a.seconds - b.seconds;
        return a.hints - b.hints;
    });

    localStorage.setItem('ts_vault_global_mock', JSON.stringify(leaderboard.slice(0, 10)));
}

function renderLeaderboardView() {
    const scores = JSON.parse(localStorage.getItem('ts_vault_global_mock')) || [];

    const postGameBody = document.getElementById("leaderboard-rows");
    const preGameBody = document.getElementById("setup-leaderboard-rows");

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

    if (postGameBody) postGameBody.innerHTML = tableHTMLContent;
    if (preGameBody) preGameBody.innerHTML = tableHTMLContent;
}

function restartGame() {
    clearInterval(timerInterval);
    showScreen("setup-screen");
    document.getElementById("player-name").focus();
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function toggleSetupLeaderboard(event) {
    if (event) event.preventDefault();

    const fieldsContainer = document.getElementById("setup-fields-container");
    const leaderboardView = document.getElementById("setup-leaderboard-view");
    const linkBtn = document.getElementById("view-board-link");

    if (!fieldsContainer || !leaderboardView || !linkBtn) return;

    isSetupLeaderboardOpen = !isSetupLeaderboardOpen;

    if (isSetupLeaderboardOpen) {
        fieldsContainer.classList.add("hidden");
        leaderboardView.classList.remove("hidden");
        linkBtn.innerText = "Back to Setup";
        renderLeaderboardView();
    } else {
        fieldsContainer.classList.remove("hidden");
        leaderboardView.classList.add("hidden");
        linkBtn.innerText = "View Global Rankings";
    }
}

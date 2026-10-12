/**
 * PRO FOOTBALL CHAMPIONSHIP - APP CONTROLLER & UI BINDINGS
 */

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate game
    const game = new FootballGame();
    window.footballGame = game;

    // Temporary selections in settings
    let selectedHomeKey = 'real_madrid';
    let selectedAwayKey = 'barcelona';
    let selectedDifficulty = 'medium';
    let selectedMatchDuration = 180;
    let isTwoPlayer = false;

    // UI Element References
    const btnSoundToggle = document.getElementById('btnSoundToggle');
    const btnWeatherToggle = document.getElementById('btnWeatherToggle');
    const btnHelp = document.getElementById('btnHelp');
    const btnSettings = document.getElementById('btnSettings');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const btnApplySettings = document.getElementById('btnApplySettings');
    const btnCloseHelp = document.getElementById('btnCloseHelp');
    const btnUnderstandHelp = document.getElementById('btnUnderstandHelp');
    const btnResume = document.getElementById('btnResume');
    const btnRestartMatch = document.getElementById('btnRestartMatch');
    const btnOpenSettingsFromPause = document.getElementById('btnOpenSettingsFromPause');
    const btnPlayAgain = document.getElementById('btnPlayAgain');

    // Modals
    const settingsModal = document.getElementById('settingsModal');
    const helpModal = document.getElementById('helpModal');
    const pauseModal = document.getElementById('pauseModal');
    const gameOverModal = document.getElementById('gameOverModal');

    // Modes
    const btnModeMatch = document.getElementById('btnModeMatch');
    const btnModePenalty = document.getElementById('btnModePenalty');
    const btnModeFreeKick = document.getElementById('btnModeFreeKick');

    // Populate Teams in Settings Grid
    const homeGrid = document.getElementById('homeTeamGrid');
    const awayGrid = document.getElementById('awayTeamGrid');

    function populateTeamGrids() {
        homeGrid.innerHTML = '';
        awayGrid.innerHTML = '';

        Object.keys(window.TEAMS_DATA).forEach(key => {
            const team = window.TEAMS_DATA[key];

            // Home Card
            const homeCard = document.createElement('div');
            homeCard.className = `team-card ${key === selectedHomeKey ? 'selected' : ''}`;
            homeCard.innerHTML = `
                <div class="team-swatch" style="background-color: ${team.primaryColor}; border-color: ${team.secondaryColor}"></div>
                <div class="team-title">${team.name}</div>
                <div class="team-stars">★ ${team.rating}</div>
            `;
            homeCard.addEventListener('click', () => {
                selectedHomeKey = key;
                populateTeamGrids();
                if (window.soundSystem) window.soundSystem.playClick();
            });
            homeGrid.appendChild(homeCard);

            // Away Card
            const awayCard = document.createElement('div');
            awayCard.className = `team-card ${key === selectedAwayKey ? 'selected' : ''}`;
            awayCard.innerHTML = `
                <div class="team-swatch" style="background-color: ${team.primaryColor}; border-color: ${team.secondaryColor}"></div>
                <div class="team-title">${team.name}</div>
                <div class="team-stars">★ ${team.rating}</div>
            `;
            awayCard.addEventListener('click', () => {
                selectedAwayKey = key;
                populateTeamGrids();
                if (window.soundSystem) window.soundSystem.playClick();
            });
            awayGrid.appendChild(awayCard);
        });
    }

    populateTeamGrids();

    // Mode Buttons
    function setActiveModeButton(activeBtn) {
        [btnModeMatch, btnModePenalty, btnModeFreeKick].forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
        if (window.soundSystem) window.soundSystem.playClick();
    }

    btnModeMatch.addEventListener('click', () => {
        setActiveModeButton(btnModeMatch);
        game.mode = 'match';
        game.scoreHome = 0;
        game.scoreAway = 0;
        game.matchTime = 0;
        game.gameOver = false;
        game.updateScoreboardHUD();
        game.resetMatchPositions('home');
        game.particles.addBanner("KLASSIK O'YIN (5v5)", "Hujumga o'ting!", 120, '#38bdf8');
    });

    btnModePenalty.addEventListener('click', () => {
        setActiveModeButton(btnModePenalty);
        game.scoreHome = 0;
        game.scoreAway = 0;
        game.gameOver = false;
        game.updateScoreboardHUD();
        game.setupPenaltyShootout();
    });

    btnModeFreeKick.addEventListener('click', () => {
        setActiveModeButton(btnModeFreeKick);
        game.gameOver = false;
        game.setupFreeKickMode();
    });

    // Sound toggle
    btnSoundToggle.addEventListener('click', () => {
        const enabled = window.soundSystem.toggleMute();
        btnSoundToggle.textContent = enabled ? '🔊' : '🔇';
        btnSoundToggle.title = enabled ? 'Ovoz yoniq' : 'Ovoz o\'chiq';
    });

    // Weather toggle (Night -> Day -> Rain)
    const weathers = ['night', 'day', 'rain'];
    const weatherIcons = { night: '🌙', day: '☀️', rain: '🌧️' };
    let weatherIdx = 0;

    btnWeatherToggle.addEventListener('click', () => {
        weatherIdx = (weatherIdx + 1) % weathers.length;
        const w = weathers[weatherIdx];
        game.weather = w;
        btnWeatherToggle.textContent = weatherIcons[w];
        if (window.soundSystem) window.soundSystem.playClick();
        game.particles.addBanner(`OB-HAVO: ${w.toUpperCase()}`, "", 60, '#38bdf8');
    });

    // Modals
    btnSettings.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        if (window.soundSystem) window.soundSystem.playClick();
    });

    btnCloseSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    btnHelp.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
        if (window.soundSystem) window.soundSystem.playClick();
    });

    btnCloseHelp.addEventListener('click', () => {
        helpModal.classList.add('hidden');
    });

    btnUnderstandHelp.addEventListener('click', () => {
        helpModal.classList.add('hidden');
        if (window.soundSystem) window.soundSystem.playClick();
    });

    // 1-Player vs 2-Player selection
    const btnModeSingle = document.getElementById('btnModeSingle');
    const btnModeTwoPlayer = document.getElementById('btnModeTwoPlayer');

    btnModeSingle.addEventListener('click', () => {
        isTwoPlayer = false;
        btnModeSingle.classList.add('active');
        btnModeTwoPlayer.classList.remove('active');
        if (window.soundSystem) window.soundSystem.playClick();
    });

    btnModeTwoPlayer.addEventListener('click', () => {
        isTwoPlayer = true;
        btnModeTwoPlayer.classList.add('active');
        btnModeSingle.classList.remove('active');
        if (window.soundSystem) window.soundSystem.playClick();
    });

    // Difficulty buttons
    document.querySelectorAll('[data-diff]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDifficulty = btn.getAttribute('data-diff');
            if (window.soundSystem) window.soundSystem.playClick();
        });
    });

    // Match Time buttons
    document.querySelectorAll('[data-time]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-time]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedMatchDuration = parseInt(btn.getAttribute('data-time'), 10);
            if (window.soundSystem) window.soundSystem.playClick();
        });
    });

    // Apply Settings
    btnApplySettings.addEventListener('click', () => {
        game.twoPlayerMode = isTwoPlayer;
        game.ai.setDifficulty(selectedDifficulty);
        game.matchDuration = selectedMatchDuration;
        game.scoreHome = 0;
        game.scoreAway = 0;
        game.matchTime = 0;
        game.gameOver = false;

        game.loadTeams(selectedHomeKey, selectedAwayKey);
        game.resetMatchPositions('home');
        game.updateScoreboardHUD();
        settingsModal.classList.add('hidden');

        if (window.soundSystem) {
            window.soundSystem.playClick();
            window.soundSystem.playWhistle('double');
        }

        game.particles.addBanner("YANGI O'YIN BOSHLANDI!", `${game.homeTeam.name} vs ${game.awayTeam.name}`, 150, '#38bdf8');
    });

    // Pause Modal Controls
    btnResume.addEventListener('click', () => {
        game.togglePause();
    });

    btnRestartMatch.addEventListener('click', () => {
        pauseModal.classList.add('hidden');
        game.isPaused = false;
        game.scoreHome = 0;
        game.scoreAway = 0;
        game.matchTime = 0;
        game.gameOver = false;
        game.resetMatchPositions('home');
        game.updateScoreboardHUD();
    });

    btnOpenSettingsFromPause.addEventListener('click', () => {
        pauseModal.classList.add('hidden');
        settingsModal.classList.remove('hidden');
    });

    // Game Over
    btnPlayAgain.addEventListener('click', () => {
        gameOverModal.classList.add('hidden');
        game.scoreHome = 0;
        game.scoreAway = 0;
        game.matchTime = 0;
        game.gameOver = false;
        game.resetMatchPositions('home');
        game.updateScoreboardHUD();
    });
});

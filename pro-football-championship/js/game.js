/**
 * PRO FOOTBALL CHAMPIONSHIP - CORE GAME ENGINE
 */

// Cross-browser roundRect polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r = 8) {
        const radius = typeof r === 'number' ? r : 8;
        this.moveTo(x + radius, y);
        this.arcTo(x + w, y, x + w, y + h, radius);
        this.arcTo(x + w, y + h, x, y + h, radius);
        this.arcTo(x, y + h, x, y, radius);
        this.arcTo(x, y, x + w, y, radius);
        this.closePath();
        return this;
    };
}

class FootballGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Pitch dimensions (virtual resolution)
        this.pitch = {
            x: 90,
            y: 70,
            width: 1100,
            height: 640,
            goalWidth: 150,
            goalDepth: 42,
            penaltyBoxW: 160,
            penaltyBoxH: 340,
            goalAreaW: 60,
            goalAreaH: 190,
            centerRadius: 85,
            cornerArcRadius: 22
        };

        // Virtual coordinate space (total arena including stadium stands)
        this.arenaWidth = this.pitch.width + this.pitch.x * 2;
        this.arenaHeight = this.pitch.height + this.pitch.y * 2;

        this.particles = new ParticleSystem();
        this.ball = new Ball(this.pitch.x + this.pitch.width / 2, this.pitch.y + this.pitch.height / 2);
        this.ai = new FootballAI('medium');

        // Game Configuration & State
        this.mode = 'match'; // 'match', 'penalty', 'freekick'
        this.difficulty = 'medium';
        this.weather = 'night'; // 'day', 'night', 'rain'
        this.matchDuration = 180; // 3 minutes standard
        this.matchTime = 0; // In seconds
        this.clockTimer = 0;
        this.isPaused = false;
        this.gameOver = false;
        this.isHalftime = false;
        this.isExtraTime = false;

        // Scores
        this.scoreHome = 0;
        this.scoreAway = 0;
        
        // Shoot power charge meter
        this.isChargingShot = false;
        this.shotPower = 0;
        this.maxShotPower = 18;
        this.chargingPlayer = null;

        // Replay & Goal state
        this.goalCelebrationTimer = 0;
        this.slowMoFactor = 1.0;
        this.camera = { x: 0, y: 0, zoom: 1.0, targetX: 0, targetY: 0 };

        // Teams
        this.homeTeamKey = 'real_madrid';
        this.awayTeamKey = 'barcelona';
        this.homeTeam = null;
        this.awayTeam = null;

        // Controlled players
        this.player1Selected = null;
        this.player2Selected = null;
        this.twoPlayerMode = false;

        // Penalty Shootout Mode state
        this.penaltyState = {
            round: 1,
            maxRounds: 5,
            turn: 'home', // 'home' or 'away'
            homeResults: [], // true for goal, false for miss
            awayResults: [],
            aimX: 0,
            aimY: 0,
            targetMoveTimer: 0,
            cursorSpeed: 2.8,
            kicking: false,
            gkDived: false,
            shotOutcomeTimer: 0
        };

        // Free kick mode state
        this.freekickState = {
            score: 0,
            attempts: 0,
            maxAttempts: 5,
            wallPlayers: [],
            targetRings: [],
            curving: 0
        };

        // Stadium flashlights / crowd animation
        this.crowdFlashes = [];
        this.crowdTimer = 0;

        // Input state
        this.keys = {};
        this.mousePos = { x: 0, y: 0 };
        this.mouseClicked = false;

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.particles.initRain(this.arenaWidth, this.arenaHeight, 100);
        this.loadTeams(this.homeTeamKey, this.awayTeamKey);
        this.resetMatchPositions();

        // Start render loop
        let lastTime = performance.now();
        const loop = (currentTime) => {
            const dt = (currentTime - lastTime) / 1000;
            lastTime = currentTime;
            this.update(dt);
            this.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    setupCanvas() {
        const resize = () => {
            const container = document.getElementById('canvasContainer');
            if (!container) return;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            // Maintain 16:9 or arena ratio
            const targetRatio = this.arenaWidth / this.arenaHeight;
            let w = containerWidth;
            let h = containerWidth / targetRatio;
            if (h > containerHeight) {
                h = containerHeight;
                w = containerHeight * targetRatio;
            }

            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = this.arenaWidth * dpr;
            this.canvas.height = this.arenaHeight * dpr;
            this.canvas.style.width = `${w}px`;
            this.canvas.style.height = `${h}px`;
            this.ctx.resetTransform();
            this.ctx.scale(dpr, dpr);
        };

        window.addEventListener('resize', resize);
        setTimeout(resize, 50);
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.keys[e.code] = true;

            // Space key: switch player to closest
            if (e.code === 'Space') {
                e.preventDefault();
                this.switchPlayerToClosest();
            }

            // P or Escape: toggle pause
            if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
                this.togglePause();
            }

            // Sound unlock on first gesture
            if (window.soundSystem) window.soundSystem.resume();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;

            // Release shoot button
            if (e.key.toLowerCase() === 'l' || e.code === 'KeyL' || e.key.toLowerCase() === 'c') {
                if (this.isChargingShot) {
                    this.executePowerShot();
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.arenaWidth / rect.width;
            const scaleY = this.arenaHeight / rect.height;
            this.mousePos.x = (e.clientX - rect.left) * scaleX;
            this.mousePos.y = (e.clientY - rect.top) * scaleY;
        });

        this.canvas.addEventListener('click', () => {
            if (window.soundSystem) window.soundSystem.resume();
            if (this.mode === 'penalty') {
                this.shootPenalty();
            } else if (this.mode === 'freekick') {
                this.shootFreeKick();
            }
        });
    }

    loadTeams(homeKey, awayKey) {
        this.homeTeamKey = homeKey;
        this.awayTeamKey = awayKey;

        const homeData = window.TEAMS_DATA[homeKey] || window.TEAMS_DATA.real_madrid;
        const awayData = window.TEAMS_DATA[awayKey] || window.TEAMS_DATA.barcelona;

        // Home Team (Left side)
        this.homeTeam = {
            id: homeData.id,
            name: homeData.name,
            short: homeData.short,
            side: 'left',
            colors: homeData,
            players: []
        };

        // Away Team (Right side)
        this.awayTeam = {
            id: awayData.id,
            name: awayData.name,
            short: awayData.short,
            side: 'right',
            colors: awayData,
            players: []
        };

        // Formations (4 field players + 1 GK for dynamic 5v5 action)
        const centerY = this.pitch.y + this.pitch.height / 2;
        const pX = this.pitch.x;
        const pW = this.pitch.width;

        const homePositions = [
            { x: pX + 35, y: centerY },                    // GK
            { x: pX + 220, y: centerY },                   // DEF
            { x: pX + 380, y: centerY - 150 },             // MID L
            { x: pX + 380, y: centerY + 150 },             // MID R
            { x: pX + 490, y: centerY }                    // FWD
        ];

        const awayPositions = [
            { x: pX + pW - 35, y: centerY },               // GK
            { x: pX + pW - 220, y: centerY },              // DEF
            { x: pX + pW - 380, y: centerY - 150 },        // MID L
            { x: pX + pW - 380, y: centerY + 150 },        // MID R
            { x: pX + pW - 490, y: centerY }               // FWD
        ];

        homeData.players.forEach((pData, idx) => {
            const p = new Player(pData, this.homeTeam, false, homePositions[idx] || homePositions[0]);
            this.homeTeam.players.push(p);
        });

        awayData.players.forEach((pData, idx) => {
            const isAI = !this.twoPlayerMode;
            const p = new Player(pData, this.awayTeam, isAI, awayPositions[idx] || awayPositions[0]);
            this.awayTeam.players.push(p);
        });

        // Set initial selected player
        this.player1Selected = this.homeTeam.players[4]; // Forward
        this.player1Selected.isSelected = true;

        if (this.twoPlayerMode) {
            this.player2Selected = this.awayTeam.players[4];
            this.player2Selected.isSelected = true;
        }

        this.updateHUDTeamInfo();
    }

    resetMatchPositions(kickoffTeam = 'home') {
        const centerY = this.pitch.y + this.pitch.height / 2;
        const centerX = this.pitch.x + this.pitch.width / 2;

        const pX = this.pitch.x;
        const pW = this.pitch.width;

        const homePositions = [
            { x: pX + 35, y: centerY },
            { x: pX + 220, y: centerY },
            { x: pX + 360, y: centerY - 140 },
            { x: pX + 360, y: centerY + 140 },
            { x: kickoffTeam === 'home' ? centerX - 8 : pX + 450, y: centerY }
        ];

        const awayPositions = [
            { x: pX + pW - 35, y: centerY },
            { x: pX + pW - 220, y: centerY },
            { x: pX + pW - 360, y: centerY - 140 },
            { x: pX + pW - 360, y: centerY + 140 },
            { x: kickoffTeam === 'away' ? centerX + 8 : pX + pW - 450, y: centerY }
        ];

        this.homeTeam.players.forEach((p, idx) => p.reset(homePositions[idx]));
        this.awayTeam.players.forEach((p, idx) => p.reset(awayPositions[idx]));

        this.ball.reset(centerX, centerY);

        // Give ball to kickoff taker
        if (kickoffTeam === 'home') {
            const taker = this.homeTeam.players[4];
            this.ball.holder = taker;
            taker.hasBall = true;
            this.player1Selected = taker;
            this.player1Selected.isSelected = true;
        } else {
            const taker = this.awayTeam.players[4];
            this.ball.holder = taker;
            taker.hasBall = true;
        }

        if (window.soundSystem) window.soundSystem.playWhistle('short');
    }

    switchPlayerToClosest() {
        if (!this.homeTeam) return;

        let closest = null;
        let minDist = Infinity;

        this.homeTeam.players.forEach(p => {
            if (p.role !== 'GK') {
                const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = p;
                }
            }
        });

        if (closest && closest !== this.player1Selected) {
            if (this.player1Selected) this.player1Selected.isSelected = false;
            this.player1Selected = closest;
            this.player1Selected.isSelected = true;
            if (window.soundSystem) window.soundSystem.playClick();
        }
    }

    handlePlayer1Input() {
        if (!this.player1Selected) return;
        const p = this.player1Selected;

        // Directional input (WASD or Arrow Keys)
        let moveX = 0;
        let moveY = 0;

        if (this.keys['w'] || this.keys['keyw'] || (!this.twoPlayerMode && this.keys['arrowup'])) moveY -= 1;
        if (this.keys['s'] || this.keys['keys'] || (!this.twoPlayerMode && this.keys['arrowdown'])) moveY += 1;
        if (this.keys['a'] || this.keys['keya'] || (!this.twoPlayerMode && this.keys['arrowleft'])) moveX -= 1;
        if (this.keys['d'] || this.keys['keyd'] || (!this.twoPlayerMode && this.keys['arrowright'])) moveX += 1;

        // Sprint (Shift or J or Z)
        p.isSprinting = (this.keys['shift'] || this.keys['shiftleft'] || this.keys['j'] || this.keys['keyj'] || this.keys['z']) && p.stamina > 5;
        const speed = p.isSprinting ? p.sprintSpeed : p.baseSpeed;

        if (moveX !== 0 || moveY !== 0) {
            const len = Math.hypot(moveX, moveY);
            p.vx = (moveX / len) * speed;
            p.vy = (moveY / len) * speed;
            p.angle = Math.atan2(p.vy, p.vx);
        }

        // Slide Tackle (K or X when defending)
        if ((this.keys['k'] || this.keys['keyk'] || this.keys['x']) && !p.hasBall) {
            p.tackle();
        }

        // Pass / Low kick (K or X when with ball)
        if ((this.keys['k'] || this.keys['keyk'] || this.keys['x']) && p.hasBall && p.kickCooldown <= 0) {
            this.executePass(p, this.homeTeam);
        }

        // Lob / Through pass (E or I)
        if ((this.keys['e'] || this.keys['keye'] || this.keys['i'] || this.keys['keyi']) && p.hasBall && p.kickCooldown <= 0) {
            this.executeLobPass(p, this.homeTeam);
        }

        // Start Charging Power Shot (L or C)
        if ((this.keys['l'] || this.keys['keyl'] || this.keys['c']) && p.hasBall && !this.isChargingShot) {
            this.isChargingShot = true;
            this.shotPower = 6;
            this.chargingPlayer = p;
        }

        if (this.isChargingShot) {
            this.shotPower = Math.min(this.maxShotPower, this.shotPower + 0.35);
        }
    }

    handlePlayer2Input() {
        if (!this.twoPlayerMode || !this.player2Selected) return;
        const p = this.player2Selected;

        let moveX = 0;
        let moveY = 0;

        if (this.keys['arrowup']) moveY -= 1;
        if (this.keys['arrowdown']) moveY += 1;
        if (this.keys['arrowleft']) moveX -= 1;
        if (this.keys['arrowright']) moveX += 1;

        p.isSprinting = (this.keys['numpad1'] || this.keys['comma']) && p.stamina > 5;
        const speed = p.isSprinting ? p.sprintSpeed : p.baseSpeed;

        if (moveX !== 0 || moveY !== 0) {
            const len = Math.hypot(moveX, moveY);
            p.vx = (moveX / len) * speed;
            p.vy = (moveY / len) * speed;
            p.angle = Math.atan2(p.vy, p.vx);
        }

        // P2 Pass / Tackle
        if ((this.keys['numpad2'] || this.keys['period']) && !p.hasBall) {
            p.tackle();
        } else if ((this.keys['numpad2'] || this.keys['period']) && p.hasBall && p.kickCooldown <= 0) {
            this.executePass(p, this.awayTeam);
        }

        // P2 Shoot
        if ((this.keys['numpad3'] || this.keys['slash']) && p.hasBall && p.kickCooldown <= 0) {
            const goalX = this.pitch.x;
            const goalY = this.pitch.y + this.pitch.height / 2 + (Math.random() - 0.5) * 80;
            const angle = Math.atan2(goalY - p.y, goalX - p.x);
            this.ball.kick(angle, 14, 2, 0, p);
            p.kickCooldown = 25;
        }
    }

    executePass(player, team) {
        // Find best teammate in front of player
        const candidates = team.players.filter(p => p !== player && p.role !== 'GK');
        let bestTarget = null;
        let bestDot = -Infinity;

        candidates.forEach(t => {
            const dx = t.x - player.x;
            const dy = t.y - player.y;
            const dist = Math.hypot(dx, dy);
            const facingDot = (dx * Math.cos(player.angle) + dy * Math.sin(player.angle)) / dist;
            if (facingDot > bestDot) {
                bestDot = facingDot;
                bestTarget = t;
            }
        });

        const targetX = bestTarget ? bestTarget.x + bestTarget.vx * 5 : player.x + Math.cos(player.angle) * 150;
        const targetY = bestTarget ? bestTarget.y + bestTarget.vy * 5 : player.y + Math.sin(player.angle) * 150;
        const passAngle = Math.atan2(targetY - player.y, targetX - player.x);

        this.ball.kick(passAngle, 9.5, 0, 0, player);
        player.kickCooldown = 25;

        // Switch selection to receiver
        if (bestTarget && team === this.homeTeam) {
            this.player1Selected.isSelected = false;
            this.player1Selected = bestTarget;
            this.player1Selected.isSelected = true;
        }
    }

    executeLobPass(player, team) {
        const passAngle = player.angle;
        this.ball.kick(passAngle, 10.5, 5.2, 0, player);
        player.kickCooldown = 30;
    }

    executePowerShot() {
        if (!this.chargingPlayer) return;
        const p = this.chargingPlayer;
        this.isChargingShot = false;

        const enemyGoalX = p.team.side === 'left' ? this.pitch.x + this.pitch.width : this.pitch.x;
        const goalCenterY = this.pitch.y + this.pitch.height / 2;

        // Add curve spin if turning
        let spin = 0;
        if (this.keys['w'] || this.keys['arrowup']) spin -= 0.65;
        if (this.keys['s'] || this.keys['arrowdown']) spin += 0.65;

        // Shot angle towards goal mouth with slight deviation
        const targetGoalY = goalCenterY + (Math.random() - 0.5) * (this.pitch.goalWidth * 0.7);
        const shotAngle = Math.atan2(targetGoalY - p.y, enemyGoalX - p.x);

        const power = this.shotPower;
        const lift = (power / this.maxShotPower) * 3.8;

        this.ball.kick(shotAngle, power, lift, spin, p);
        p.kickCooldown = 35;
        this.chargingPlayer = null;
        this.shotPower = 0;

        // Big screen shake for super shots
        if (power > 14) {
            this.shakeCamera(7, 10);
        }
    }

    shakeCamera(intensity, frames) {
        this.screenShake = { intensity, frames };
    }

    checkPossessionAndCollisions() {
        const allPlayers = [...this.homeTeam.players, ...this.awayTeam.players];

        allPlayers.forEach(p => {
            // Player vs Ball collision
            const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
            const ballCatchRadius = p.role === 'GK' ? 24 : 19;

            if (dist < p.radius + ballCatchRadius && this.ball.z < 28) {
                // If sliding tackle, strip ball immediately
                if (p.isTackling && this.ball.holder && this.ball.holder !== p) {
                    const stolenFrom = this.ball.holder;
                    stolenFrom.hasBall = false;
                    this.ball.holder = null;
                    const stealAngle = p.angle + (Math.random() - 0.5) * 0.5;
                    this.ball.kick(stealAngle, 8.0, 1.0, 0, p);
                    this.particles.addBanner("Ajoyib Podkat!", "To'p olib qo'yildi", 60, '#38bdf8');
                    return;
                }

                // Normal possession pickup
                if (!this.ball.holder && p.kickCooldown <= 0 && Math.hypot(this.ball.vx, this.ball.vy) < 14) {
                    this.ball.holder = p;
                    p.hasBall = true;
                    if (p.team === this.homeTeam && this.player1Selected !== p) {
                        this.player1Selected.isSelected = false;
                        this.player1Selected = p;
                        this.player1Selected.isSelected = true;
                    }
                }
            }
        });

        // Player vs Player collision repulsion
        for (let i = 0; i < allPlayers.length; i++) {
            for (let j = i + 1; j < allPlayers.length; j++) {
                const p1 = allPlayers[i];
                const p2 = allPlayers[j];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const d = Math.hypot(dx, dy);
                const minDist = p1.radius + p2.radius;

                if (d < minDist && d > 0.01) {
                    const overlap = (minDist - d) / 2;
                    const nx = dx / d;
                    const ny = dy / d;
                    p1.x -= nx * overlap;
                    p1.y -= ny * overlap;
                    p2.x += nx * overlap;
                    p2.y += ny * overlap;
                }
            }
        }
    }

    checkGoal() {
        if (this.goalCelebrationTimer > 0) return;

        const goalTop = this.pitch.y + this.pitch.height / 2 - this.pitch.goalWidth / 2;
        const goalBottom = this.pitch.y + this.pitch.height / 2 + this.pitch.goalWidth / 2;

        // Ball inside Left Goal Line -> Away Team Scores!
        if (this.ball.x < this.pitch.x && this.ball.y > goalTop && this.ball.y < goalBottom && this.ball.z < 40) {
            this.handleGoalScored('away');
            return;
        }

        // Ball inside Right Goal Line -> Home Team Scores!
        if (this.ball.x > this.pitch.x + this.pitch.width && this.ball.y > goalTop && this.ball.y < goalBottom && this.ball.z < 40) {
            this.handleGoalScored('home');
            return;
        }

        // Out of bounds (Touchlines & Goal lines)
        this.checkPitchBoundaries();
    }

    handleGoalScored(scoringSide) {
        this.goalCelebrationTimer = 220; // ~3.5 seconds
        if (scoringSide === 'home') {
            this.scoreHome++;
            const scorer = this.ball.lastKickedBy ? this.ball.lastKickedBy.name : this.homeTeam.name;
            this.particles.addBanner("GOOOOOL!", `${this.homeTeam.name} - ${scorer}`, 180, '#facc15');
        } else {
            this.scoreAway++;
            const scorer = this.ball.lastKickedBy ? this.ball.lastKickedBy.name : this.awayTeam.name;
            this.particles.addBanner("GOOOOOL!", `${this.awayTeam.name} - ${scorer}`, 180, '#f87171');
        }

        if (window.soundSystem) window.soundSystem.playGoalCelebration();
        this.particles.triggerGoalCelebration(this.arenaWidth, this.arenaHeight);
        this.updateScoreboardHUD();
    }

    checkPitchBoundaries() {
        if (this.ball.holder) return;

        const pX = this.pitch.x;
        const pY = this.pitch.y;
        const pW = this.pitch.width;
        const pH = this.pitch.height;

        // Top and Bottom touchlines (Out)
        if (this.ball.y < pY || this.ball.y > pY + pH) {
            this.ball.y = Math.max(pY + 12, Math.min(pY + pH - 12, this.ball.y));
            this.ball.vx *= -0.2;
            this.ball.vy *= -0.2;
            this.particles.addBanner("AUT!", "To'p maydondan chiqdi", 45, '#94a3b8');
            if (window.soundSystem) window.soundSystem.playWhistle('short');
        }

        // Left and Right goal lines (when not a goal)
        const goalTop = pY + pH / 2 - this.pitch.goalWidth / 2;
        const goalBottom = pY + pH / 2 + this.pitch.goalWidth / 2;

        if (this.ball.x < pX && (this.ball.y < goalTop || this.ball.y > goalBottom)) {
            this.ball.x = pX + 25;
            this.ball.vx = 2;
            this.particles.addBanner("BURCHAK / DARVOZA ZARBASI", "", 45, '#94a3b8');
            if (window.soundSystem) window.soundSystem.playWhistle('short');
        } else if (this.ball.x > pX + pW && (this.ball.y < goalTop || this.ball.y > goalBottom)) {
            this.ball.x = pX + pW - 25;
            this.ball.vx = -2;
            this.particles.addBanner("BURCHAK / DARVOZA ZARBASI", "", 45, '#94a3b8');
            if (window.soundSystem) window.soundSystem.playWhistle('short');
        }
    }

    update(dt) {
        if (this.isPaused) return;

        // Goal Celebration slowdown
        if (this.goalCelebrationTimer > 0) {
            this.goalCelebrationTimer--;
            this.slowMoFactor = 0.45;
            if (this.goalCelebrationTimer <= 0) {
                this.slowMoFactor = 1.0;
                this.resetMatchPositions(this.ball.lastKickedBy && this.ball.lastKickedBy.team === this.homeTeam ? 'away' : 'home');
            }
        }

        // Match clock
        if (this.mode === 'match' && !this.gameOver && this.goalCelebrationTimer <= 0) {
            this.clockTimer++;
            if (this.clockTimer >= 60) {
                this.clockTimer = 0;
                this.matchTime++;
                this.updateMatchClockHUD();

                if (this.matchTime >= this.matchDuration) {
                    this.endMatch();
                }
            }
        }

        // Mode specific updates
        if (this.mode === 'match') {
            this.updateMatchMode();
        } else if (this.mode === 'penalty') {
            this.updatePenaltyMode();
        } else if (this.mode === 'freekick') {
            this.updateFreeKickMode();
        }

        // Particles & visual updates
        this.particles.update(this.arenaWidth, this.arenaHeight, this.weather === 'rain');

        // Screen shake decay
        if (this.screenShake && this.screenShake.frames > 0) {
            this.screenShake.frames--;
        }

        // Random crowd camera flashes
        if (Math.random() < 0.08) {
            this.crowdFlashes.push({
                x: Math.random() * this.arenaWidth,
                y: Math.random() > 0.5 ? Math.random() * this.pitch.y : this.pitch.y + this.pitch.height + Math.random() * this.pitch.y,
                life: 6
            });
        }
        for (let i = this.crowdFlashes.length - 1; i >= 0; i--) {
            this.crowdFlashes[i].life--;
            if (this.crowdFlashes[i].life <= 0) this.crowdFlashes.splice(i, 1);
        }
    }

    updateMatchMode() {
        // Handle User Input
        this.handlePlayer1Input();
        if (this.twoPlayerMode) {
            this.handlePlayer2Input();
        }

        // Update AI
        this.ai.update(this.awayTeam, this.homeTeam, this.ball, this.pitch);
        if (!this.twoPlayerMode) {
            // Teammate support AI for player 1's team
            this.ai.update(this.homeTeam, this.awayTeam, this.ball, this.pitch);
        }

        // Update physics
        this.homeTeam.players.forEach(p => p.update(this.pitch, this.ball, this.particles));
        this.awayTeam.players.forEach(p => p.update(this.pitch, this.ball, this.particles));
        this.ball.update(this.pitch, this.particles);

        // Check collisions & possession
        this.checkPossessionAndCollisions();

        // Check goals
        this.checkGoal();
    }

    // PENALTY SHOOTOUT LOGIC
    setupPenaltyShootout() {
        this.mode = 'penalty';
        this.penaltyState = {
            round: 1,
            maxRounds: 5,
            turn: 'home',
            homeResults: [],
            awayResults: [],
            aimX: this.pitch.x + this.pitch.width,
            aimY: this.pitch.y + this.pitch.height / 2,
            targetMoveTimer: 0,
            cursorSpeed: 3.2,
            kicking: false,
            gkDived: false,
            shotOutcomeTimer: 0
        };

        const centerY = this.pitch.y + this.pitch.height / 2;
        // Position ball at penalty spot
        this.ball.reset(this.pitch.x + this.pitch.width - 120, centerY);

        // Position Kicker
        const kicker = this.homeTeam.players[4];
        kicker.reset({ x: this.pitch.x + this.pitch.width - 150, y: centerY });
        kicker.angle = 0;
        this.player1Selected = kicker;

        // Position Goalkeeper
        const gk = this.awayTeam.players[0];
        gk.reset({ x: this.pitch.x + this.pitch.width - 25, y: centerY });
        gk.angle = Math.PI;

        this.particles.addBanner("PENALTILAR SERIYASI!", "Zarbani yo'naltiring va sichqonchani bosing", 120, '#f59e0b');
        this.updatePenaltyHUD();
    }

    updatePenaltyMode() {
        const goalTop = this.pitch.y + this.pitch.height / 2 - this.pitch.goalWidth / 2 + 15;
        const goalBottom = this.pitch.y + this.pitch.height / 2 + this.pitch.goalWidth / 2 - 15;
        const goalX = this.pitch.x + this.pitch.width;

        // Oscillate target cursor smoothly
        if (!this.penaltyState.kicking) {
            this.penaltyState.targetMoveTimer += 0.045;
            this.penaltyState.aimY = (goalTop + goalBottom) / 2 + Math.sin(this.penaltyState.targetMoveTimer) * ((goalBottom - goalTop) / 2);
            this.penaltyState.aimX = goalX;
        }

        // Update ball & players
        this.ball.update(this.pitch, this.particles);
        this.homeTeam.players.forEach(p => p.update(this.pitch, this.ball, this.particles));
        this.awayTeam.players.forEach(p => p.update(this.pitch, this.ball, this.particles));

        // When shot in flight, trigger GK dive
        if (this.penaltyState.kicking && !this.penaltyState.gkDived && Math.hypot(this.ball.vx, this.ball.vy) > 2) {
            this.penaltyState.gkDived = true;
            const gk = this.penaltyState.turn === 'home' ? this.awayTeam.players[0] : this.homeTeam.players[0];
            // AI guess dive target (75% prediction probability on high difficulty)
            const willSave = Math.random() < 0.45;
            const diveTargetY = willSave ? this.penaltyState.aimY : (goalTop + Math.random() * (goalBottom - goalTop));
            gk.dive(goalX - 25, diveTargetY);
        }

        // Outcome checking
        if (this.penaltyState.kicking) {
            this.penaltyState.shotOutcomeTimer++;
            if (this.penaltyState.shotOutcomeTimer > 80) {
                this.resolvePenaltyOutcome();
            }
        }
    }

    shootPenalty() {
        if (this.penaltyState.kicking) return;
        this.penaltyState.kicking = true;
        this.penaltyState.shotOutcomeTimer = 0;

        const kicker = this.penaltyState.turn === 'home' ? this.homeTeam.players[4] : this.awayTeam.players[4];
        const angle = Math.atan2(this.penaltyState.aimY - this.ball.y, this.penaltyState.aimX - this.ball.x);
        const power = 13.5;
        this.ball.kick(angle, power, 2.5, (Math.random() - 0.5) * 0.4, kicker);
    }

    resolvePenaltyOutcome() {
        const isGoal = this.ball.x > this.pitch.x + this.pitch.width - 5 && Math.abs(this.ball.y - (this.pitch.y + this.pitch.height / 2)) < this.pitch.goalWidth / 2;

        if (this.penaltyState.turn === 'home') {
            this.penaltyState.homeResults.push(isGoal);
            if (isGoal) {
                this.scoreHome++;
                this.particles.addBanner("GOOOL!", "Ajoyib penalti zarbasi!", 90, '#22c55e');
                if (window.soundSystem) window.soundSystem.playGoalCelebration();
            } else {
                this.particles.addBanner("XATO!", "Darvozabon qaytardi!", 90, '#ef4444');
                if (window.soundSystem) window.soundSystem.playWhistle('double');
            }
            this.penaltyState.turn = 'away';
        } else {
            this.penaltyState.awayResults.push(isGoal);
            if (isGoal) {
                this.scoreAway++;
                this.particles.addBanner("GOOOL!", "Raqib gol urdi!", 90, '#f97316');
                if (window.soundSystem) window.soundSystem.playGoalCelebration();
            } else {
                this.particles.addBanner("XATO!", "Raqib noaniq zarba berdi!", 90, '#3b82f6');
                if (window.soundSystem) window.soundSystem.playWhistle('double');
            }
            this.penaltyState.round++;
            this.penaltyState.turn = 'home';
        }

        this.updateScoreboardHUD();
        this.updatePenaltyHUD();

        // Check if finished
        if (this.penaltyState.round > this.penaltyState.maxRounds) {
            this.endMatch();
            return;
        }

        // Reset for next penalty
        setTimeout(() => {
            this.penaltyState.kicking = false;
            this.penaltyState.gkDived = false;
            const centerY = this.pitch.y + this.pitch.height / 2;
            this.ball.reset(this.pitch.x + this.pitch.width - 120, centerY);
            this.homeTeam.players[0].reset({ x: this.pitch.x + 35, y: centerY });
            this.awayTeam.players[0].reset({ x: this.pitch.x + this.pitch.width - 25, y: centerY });
        }, 1500);
    }

    // FREE KICK PRACTICE CHALLENGE
    setupFreeKickMode() {
        this.mode = 'freekick';
        this.freekickState = {
            score: 0,
            attempts: 0,
            maxAttempts: 5,
            kicking: false,
            shotOutcomeTimer: 0
        };

        const centerY = this.pitch.y + this.pitch.height / 2;
        // Position ball at free-kick range (~24 meters)
        this.ball.reset(this.pitch.x + this.pitch.width - 290, centerY - 60);

        // Kicker
        const kicker = this.homeTeam.players[4];
        kicker.reset({ x: this.pitch.x + this.pitch.width - 320, y: centerY - 60 });
        kicker.angle = 0;
        this.player1Selected = kicker;

        // Defensive wall (3 players standing side by side)
        const wallX = this.pitch.x + this.pitch.width - 180;
        this.awayTeam.players[1].reset({ x: wallX, y: centerY - 80 });
        this.awayTeam.players[2].reset({ x: wallX, y: centerY - 50 });
        this.awayTeam.players[3].reset({ x: wallX, y: centerY - 20 });

        // Goalkeeper
        this.awayTeam.players[0].reset({ x: this.pitch.x + this.pitch.width - 25, y: centerY });

        this.particles.addBanner("JARIMA TO'PI MASHQI!", "Devordan oshirib burchakka yo'naltiring", 120, '#38bdf8');
    }

    updateFreeKickMode() {
        this.ball.update(this.pitch, this.particles);
        this.homeTeam.players.forEach(p => p.update(this.pitch, this.ball, this.particles));
        this.awayTeam.players.forEach(p => p.update(this.pitch, this.ball, this.particles));

        if (this.freekickState.kicking) {
            this.freekickState.shotOutcomeTimer++;
            if (this.freekickState.shotOutcomeTimer > 90) {
                this.freekickState.attempts++;
                const isGoal = this.ball.x > this.pitch.x + this.pitch.width - 5;
                if (isGoal) {
                    this.freekickState.score += 100;
                    this.particles.addBanner("SHEVR! +100 BALL", "To'g'ridan-to'g'ri burchakka!", 90, '#eab308');
                    if (window.soundSystem) window.soundSystem.playGoalCelebration();
                } else {
                    this.particles.addBanner("QAYTARILDI!", "Zarba noaniq ketdi", 90, '#94a3b8');
                    if (window.soundSystem) window.soundSystem.playWhistle('short');
                }

                if (this.freekickState.attempts >= this.freekickState.maxAttempts) {
                    setTimeout(() => {
                        this.particles.addBanner("CHALLENGE TUGADI!", `Jami Ball: ${this.freekickState.score}`, 180, '#22c55e');
                    }, 1200);
                } else {
                    setTimeout(() => {
                        this.freekickState.kicking = false;
                        this.setupFreeKickMode();
                    }, 1500);
                }
            }
        }
    }

    shootFreeKick() {
        if (this.freekickState.kicking) return;
        this.freekickState.kicking = true;
        this.freekickState.shotOutcomeTimer = 0;

        const kicker = this.player1Selected;
        const targetX = this.mousePos.x;
        const targetY = this.mousePos.y;

        const angle = Math.atan2(targetY - this.ball.y, targetX - this.ball.x);
        const spin = (this.mousePos.y < this.ball.y ? -0.8 : 0.8);
        this.ball.kick(angle, 14, 4.2, spin, kicker);

        // Wall jump reaction!
        setTimeout(() => {
            this.awayTeam.players[1].vy = -2.5;
            this.awayTeam.players[2].vy = -2.5;
            this.awayTeam.players[3].vy = -2.5;
        }, 150);
    }

    endMatch() {
        this.gameOver = true;
        let winnerText = "DURRANG!";
        let winnerColor = '#e2e8f0';

        if (this.scoreHome > this.scoreAway) {
            winnerText = `${this.homeTeam.name} G'ALABA QOZONDI!`;
            winnerColor = '#22c55e';
        } else if (this.scoreAway > this.scoreHome) {
            winnerText = `${this.awayTeam.name} G'ALABA QOZONDI!`;
            winnerColor = '#ef4444';
        }

        this.particles.addBanner("O'YIN TUGADI!", winnerText, 300, winnerColor);
        if (window.soundSystem) window.soundSystem.playWhistle('long');
        document.getElementById('gameOverModal').classList.remove('hidden');
        document.getElementById('winnerText').textContent = winnerText;
        document.getElementById('finalScoreText').textContent = `${this.scoreHome} - ${this.scoreAway}`;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const modal = document.getElementById('pauseModal');
        if (this.isPaused) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    }

    // RENDERING PIPELINE
    render() {
        this.ctx.clearRect(0, 0, this.arenaWidth, this.arenaHeight);

        this.ctx.save();
        if (this.screenShake && this.screenShake.frames > 0) {
            const mag = this.screenShake.intensity;
            this.ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
        }

        // 1. Draw Grandstand & Stadium Environment
        this.drawStadiumEnvironment();

        // 2. Draw Football Pitch & Markings
        this.drawPitch();

        // 3. Draw Shadows
        this.drawShadows();

        // 4. Draw Goal Nets & Posts
        this.drawGoalNets();

        // 5. Draw Players
        this.drawPlayers();

        // 6. Draw Ball
        this.drawBall();

        // 7. Draw Visual FX & Particles
        this.particles.draw(this.ctx);

        // 8. Draw Weather FX
        this.particles.drawWeather(this.ctx, this.arenaWidth, this.arenaHeight);

        // 9. Draw Mode Specific UI (Penalty target cursor / Free-kick arc)
        if (this.mode === 'penalty') {
            this.drawPenaltyUI();
        } else if (this.mode === 'freekick') {
            this.drawFreeKickUI();
        }

        // 10. Draw In-Game Banners
        this.particles.drawBanners(this.ctx, this.arenaWidth, this.arenaHeight);

        this.ctx.restore();

        // 11. Draw Minimap / Radar
        this.drawRadar();
    }

    drawStadiumEnvironment() {
        const w = this.arenaWidth;
        const h = this.arenaHeight;

        // Dark stadium concrete foundation
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, w, h);

        // Grandstand seating tiers
        const standDepth = 55;
        this.ctx.fillStyle = '#1e293b';
        // Top stand
        this.ctx.fillRect(0, 0, w, standDepth);
        // Bottom stand
        this.ctx.fillRect(0, h - standDepth, w, standDepth);
        // Left stand
        this.ctx.fillRect(0, standDepth, standDepth + 20, h - standDepth * 2);
        // Right stand
        this.ctx.fillRect(w - (standDepth + 20), standDepth, standDepth + 20, h - standDepth * 2);

        // Spectator crowd dots in grandstands
        this.drawCrowd(0, 0, w, standDepth);
        this.drawCrowd(0, h - standDepth, w, standDepth);

        // LED Advertising Board surrounding the pitch
        this.drawAdvertisingBoards();

        // Corner Stadium Floodlights Glow
        if (this.weather === 'night' || this.weather === 'rain') {
            this.drawFloodlights();
        }
    }

    drawCrowd(x, y, w, h) {
        this.ctx.save();
        const colors = ['#38bdf8', '#f43f5e', '#facc15', '#94a3b8', '#a855f7', '#ffffff', '#22c55e'];
        for (let row = y + 8; row < y + h - 8; row += 10) {
            for (let col = x + 12; col < x + w - 12; col += 12) {
                const colorIdx = Math.floor((Math.sin(col * 0.1) + Math.cos(row * 0.1) + 2) * 2) % colors.length;
                this.ctx.fillStyle = colors[colorIdx];
                this.ctx.fillRect(col, row, 4, 4);
            }
        }
        this.ctx.restore();
    }

    drawAdvertisingBoards() {
        const p = this.pitch;
        const text = "⚽ PRO FOOTBALL CHAMPIONSHIP  ★  ULTIMATE ARENA  ★  FAIR PLAY  ★  WINNERS CUP  ★  ";

        this.ctx.save();
        this.ctx.fillStyle = '#090d16';
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 2;

        // Top Ad board
        this.ctx.fillRect(p.x, p.y - 18, p.width, 16);
        this.ctx.strokeRect(p.x, p.y - 18, p.width, 16);

        // Bottom Ad board
        this.ctx.fillRect(p.x, p.y + p.height + 2, p.width, 16);
        this.ctx.strokeRect(p.x, p.y + p.height + 2, p.width, 16);

        // Glowing LED text
        this.ctx.font = 'bold 9px "Outfit", monospace';
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.shadowColor = '#0284c7';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(text, p.x + 10, p.y - 6);
        this.ctx.fillText(text, p.x + 10, p.y + p.height + 14);

        this.ctx.restore();
    }

    drawFloodlights() {
        const corners = [
            { x: 30, y: 30 },
            { x: this.arenaWidth - 30, y: 30 },
            { x: 30, y: this.arenaHeight - 30 },
            { x: this.arenaWidth - 30, y: this.arenaHeight - 30 }
        ];

        this.ctx.save();
        corners.forEach(c => {
            const grad = this.ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 140);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
            grad.addColorStop(0.3, 'rgba(224, 242, 254, 0.18)');
            grad.addColorStop(1, 'rgba(224, 242, 254, 0)');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(c.x, c.y, 140, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Crowd camera flashes
        this.crowdFlashes.forEach(f => {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.beginPath();
            this.ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.restore();
    }

    drawPitch() {
        const p = this.pitch;

        this.ctx.save();

        // Authentic manicured turf stripes (alternating rich greens)
        const stripeCount = 14;
        const stripeWidth = p.width / stripeCount;

        for (let i = 0; i < stripeCount; i++) {
            this.ctx.fillStyle = (i % 2 === 0) ? '#166534' : '#15803d'; // Rich pitch green
            if (this.weather === 'rain') {
                this.ctx.fillStyle = (i % 2 === 0) ? '#14532d' : '#166534';
            }
            this.ctx.fillRect(p.x + i * stripeWidth, p.y, stripeWidth, p.height);
        }

        // Pitch Outlines (White chalk markings)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
        this.ctx.lineWidth = 3;

        // Outer touchlines
        this.ctx.strokeRect(p.x, p.y, p.width, p.height);

        // Halfway line
        const midX = p.x + p.width / 2;
        const midY = p.y + p.height / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(midX, p.y);
        this.ctx.lineTo(midX, p.y + p.height);
        this.ctx.stroke();

        // Center circle & center spot
        this.ctx.beginPath();
        this.ctx.arc(midX, midY, p.centerRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(midX, midY, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Left Penalty Box & Goal Area
        this.ctx.strokeRect(p.x, midY - p.penaltyBoxH / 2, p.penaltyBoxW, p.penaltyBoxH);
        this.ctx.strokeRect(p.x, midY - p.goalAreaH / 2, p.goalAreaW, p.goalAreaH);

        // Left Penalty Spot & Arc
        const leftPenSpotX = p.x + 110;
        this.ctx.beginPath();
        this.ctx.arc(leftPenSpotX, midY, 3.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(leftPenSpotX, midY, 50, -0.65, 0.65);
        this.ctx.stroke();

        // Right Penalty Box & Goal Area
        this.ctx.strokeRect(p.x + p.width - p.penaltyBoxW, midY - p.penaltyBoxH / 2, p.penaltyBoxW, p.penaltyBoxH);
        this.ctx.strokeRect(p.x + p.width - p.goalAreaW, midY - p.goalAreaH / 2, p.goalAreaW, p.goalAreaH);

        // Right Penalty Spot & Arc
        const rightPenSpotX = p.x + p.width - 110;
        this.ctx.beginPath();
        this.ctx.arc(rightPenSpotX, midY, 3.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(rightPenSpotX, midY, 50, Math.PI - 0.65, Math.PI + 0.65);
        this.ctx.stroke();

        // Corner Arcs
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.cornerArcRadius, 0, Math.PI / 2);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y + p.height, p.cornerArcRadius, -Math.PI / 2, 0);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(p.x + p.width, p.y, p.cornerArcRadius, Math.PI / 2, Math.PI);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(p.x + p.width, p.y + p.height, p.cornerArcRadius, Math.PI, Math.PI * 1.5);
        this.ctx.stroke();

        // Corner flags
        const corners = [
            { x: p.x, y: p.y },
            { x: p.x + p.width, y: p.y },
            { x: p.x, y: p.y + p.height },
            { x: p.x + p.width, y: p.y + p.height }
        ];
        corners.forEach(c => {
            this.ctx.fillStyle = '#ef4444';
            this.ctx.beginPath();
            this.ctx.moveTo(c.x, c.y);
            this.ctx.lineTo(c.x + 8, c.y - 6);
            this.ctx.lineTo(c.x, c.y - 12);
            this.ctx.fill();
        });

        this.ctx.restore();
    }

    drawGoalNets() {
        const p = this.pitch;
        const midY = p.y + p.height / 2;
        const goalTop = midY - p.goalWidth / 2;
        const goalBottom = midY + p.goalWidth / 2;

        this.ctx.save();

        // Draw Left Goal Net
        this.ctx.fillStyle = 'rgba(240, 240, 240, 0.22)';
        this.ctx.fillRect(p.x - p.goalDepth, goalTop, p.goalDepth, p.goalWidth);

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 1;
        for (let x = p.x - p.goalDepth; x <= p.x; x += 7) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, goalTop);
            this.ctx.lineTo(x, goalBottom);
            this.ctx.stroke();
        }
        for (let y = goalTop; y <= goalBottom; y += 7) {
            this.ctx.beginPath();
            this.ctx.moveTo(p.x - p.goalDepth, y);
            this.ctx.lineTo(p.x, y);
            this.ctx.stroke();
        }

        // Left Goal Posts (Solid white with metallic glow)
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(p.x - p.goalDepth, goalTop, p.goalDepth, p.goalWidth);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(p.x, goalTop, 4, 0, Math.PI * 2);
        this.ctx.arc(p.x, goalBottom, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw Right Goal Net
        this.ctx.fillStyle = 'rgba(240, 240, 240, 0.22)';
        this.ctx.fillRect(p.x + p.width, goalTop, p.goalDepth, p.goalWidth);

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        for (let x = p.x + p.width; x <= p.x + p.width + p.goalDepth; x += 7) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, goalTop);
            this.ctx.lineTo(x, goalBottom);
            this.ctx.stroke();
        }
        for (let y = goalTop; y <= goalBottom; y += 7) {
            this.ctx.beginPath();
            this.ctx.moveTo(p.x + p.width, y);
            this.ctx.lineTo(p.x + p.width + p.goalDepth, y);
            this.ctx.stroke();
        }

        // Right Goal Posts
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(p.x + p.width, goalTop, p.goalDepth, p.goalWidth);

        this.ctx.beginPath();
        this.ctx.arc(p.x + p.width, goalTop, 4, 0, Math.PI * 2);
        this.ctx.arc(p.x + p.width, goalBottom, 4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    drawShadows() {
        const allEntities = [...this.homeTeam.players, ...this.awayTeam.players];

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';

        // 4 Quad Stadium Shadows pointing out from 4 light poles
        allEntities.forEach(e => {
            const shadowOffsets = [
                { dx: 3, dy: 3 },
                { dx: -3, dy: 3 },
                { dx: 3, dy: -3 },
                { dx: -3, dy: -3 }
            ];
            shadowOffsets.forEach(s => {
                this.ctx.beginPath();
                this.ctx.ellipse(e.x + s.dx, e.y + s.dy + 4, e.radius * 0.9, e.radius * 0.45, 0, 0, Math.PI * 2);
                this.ctx.fill();
            });
        });

        // Ball Shadow (stays on pitch even when ball is kicked into air)
        const ballShadowScale = Math.max(0.4, 1 - (this.ball.z / 120));
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        this.ctx.beginPath();
        this.ctx.ellipse(this.ball.x, this.ball.y, this.ball.radius * ballShadowScale, this.ball.radius * 0.55 * ballShadowScale, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    drawPlayers() {
        const allPlayers = [...this.homeTeam.players, ...this.awayTeam.players];

        // Sort by Y for correct top-to-bottom depth
        allPlayers.sort((a, b) => a.y - b.y);

        allPlayers.forEach(p => {
            this.ctx.save();
            this.ctx.translate(p.x, p.y);

            // Selection indicator ring under player
            if (p.isSelected) {
                this.ctx.strokeStyle = '#38bdf8';
                this.ctx.lineWidth = 2.5;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
                this.ctx.stroke();

                // Direction pointer arrow
                this.ctx.fillStyle = '#38bdf8';
                this.ctx.beginPath();
                const tipX = Math.cos(p.angle) * (p.radius + 14);
                const tipY = Math.sin(p.angle) * (p.radius + 14);
                this.ctx.arc(tipX, tipY, 3.5, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Power Shot Charging Meter
            if (p === this.chargingPlayer && this.isChargingShot) {
                const pct = (this.shotPower - 6) / (this.maxShotPower - 6);
                const meterWidth = 36;
                const meterHeight = 6;
                const barY = -p.radius - 16;

                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(-meterWidth / 2, barY, meterWidth, meterHeight);

                // Gradient from green to orange to fiery red
                this.ctx.fillStyle = pct < 0.6 ? '#22c55e' : (pct < 0.85 ? '#eab308' : '#ef4444');
                this.ctx.fillRect(-meterWidth / 2 + 1, barY + 1, (meterWidth - 2) * pct, meterHeight - 2);
            }

            // Stamina bar (when sprinting or low)
            if (p.stamina < 90) {
                const sPct = p.stamina / 100;
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                this.ctx.fillRect(-14, p.radius + 7, 28, 4);
                this.ctx.fillStyle = sPct > 0.3 ? '#38bdf8' : '#ef4444';
                this.ctx.fillRect(-13, p.radius + 8, 26 * sPct, 2);
            }

            // Rotate for player body facing direction
            this.ctx.rotate(p.angle);

            // Feet / Running cycle animation
            const legOffset = Math.sin(p.runCycle) * 6;
            this.ctx.fillStyle = '#1e293b';
            // Left foot
            this.ctx.fillRect(-6 + legOffset, -p.radius + 1, 7, 5);
            // Right foot
            this.ctx.fillRect(-6 - legOffset, p.radius - 6, 7, 5);

            // Player Shoulders & Torso (Jersey)
            this.ctx.fillStyle = (p.role === 'GK') ? '#10b981' : p.team.colors.primaryColor;
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, p.radius, p.radius * 0.85, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Jersey secondary stripe / trim
            this.ctx.fillStyle = p.team.colors.secondaryColor;
            this.ctx.fillRect(-4, -p.radius * 0.85, 8, p.radius * 1.7);

            // Head & Hair
            this.ctx.fillStyle = '#f87171'; // skin tone
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
            this.ctx.fill();

            // Hair / Cap
            this.ctx.fillStyle = '#334155';
            this.ctx.beginPath();
            this.ctx.arc(-2, 0, 6.5, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();

            // Player Name and Squad Number above head
            this.ctx.save();
            this.ctx.font = 'bold 10px "Outfit", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.shadowColor = '#000000';
            this.ctx.shadowBlur = 4;
            this.ctx.fillText(p.name, p.x, p.y - p.radius - 6);
            this.ctx.restore();
        });
    }

    drawBall() {
        const b = this.ball;
        const drawY = b.y - b.z; // 3D elevation
        const ballSize = b.radius * (1 + b.z / 90);

        this.ctx.save();
        this.ctx.translate(b.x, drawY);
        this.ctx.rotate(b.rotation);

        // Soccer ball outer leather
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, ballSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Authentic Black Pentagon Patches
        this.ctx.fillStyle = '#0f172a';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, ballSize * 0.38, 0, Math.PI * 2);
        this.ctx.fill();

        // 3 mini peripheral patches
        for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2) / 3) {
            this.ctx.beginPath();
            this.ctx.arc(Math.cos(a) * ballSize * 0.65, Math.sin(a) * ballSize * 0.65, ballSize * 0.22, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Ball 3D Lighting & Shading
        const grad = this.ctx.createRadialGradient(-ballSize * 0.3, -ballSize * 0.3, 0, 0, 0, ballSize);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        grad.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, ballSize, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    drawRadar() {
        // High-tech translucent mini pitch in top center/right
        const radarW = 160;
        const radarH = 92;
        const radarX = this.arenaWidth - radarW - 20;
        const radarY = 20;

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        this.ctx.lineWidth = 1.5;

        this.ctx.beginPath();
        this.ctx.roundRect(radarX, radarY, radarW, radarH, 8);
        this.ctx.fill();
        this.ctx.stroke();

        // Center line & circle
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        this.ctx.beginPath();
        this.ctx.moveTo(radarX + radarW / 2, radarY);
        this.ctx.lineTo(radarX + radarW / 2, radarY + radarH);
        this.ctx.stroke();

        const scaleX = radarW / this.pitch.width;
        const scaleY = radarH / this.pitch.height;

        // Draw players on radar
        this.homeTeam.players.forEach(p => {
            const rx = radarX + (p.x - this.pitch.x) * scaleX;
            const ry = radarY + (p.y - this.pitch.y) * scaleY;
            this.ctx.fillStyle = '#38bdf8';
            this.ctx.beginPath();
            this.ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.awayTeam.players.forEach(p => {
            const rx = radarX + (p.x - this.pitch.x) * scaleX;
            const ry = radarY + (p.y - this.pitch.y) * scaleY;
            this.ctx.fillStyle = '#ef4444';
            this.ctx.beginPath();
            this.ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Pulsing white ball
        const bx = radarX + (this.ball.x - this.pitch.x) * scaleX;
        const by = radarY + (this.ball.y - this.pitch.y) * scaleY;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(bx, by, 3, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    drawPenaltyUI() {
        if (!this.penaltyState.kicking) {
            // Target Aiming Reticle with animated crosshair
            this.ctx.save();
            const x = this.penaltyState.aimX;
            const y = this.penaltyState.aimY;

            this.ctx.strokeStyle = '#ef4444';
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 16, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(x - 22, y);
            this.ctx.lineTo(x + 22, y);
            this.ctx.moveTo(x, y - 22);
            this.ctx.lineTo(x, y + 22);
            this.ctx.stroke();

            this.ctx.restore();
        }
    }

    drawFreeKickUI() {
        if (!this.freekickState.kicking) {
            // Curved trajectory guideline from ball to mouse position
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([6, 6]);

            this.ctx.beginPath();
            this.ctx.moveTo(this.ball.x, this.ball.y);
            const cpX = (this.ball.x + this.mousePos.x) / 2;
            const cpY = (this.ball.y + this.mousePos.y) / 2 - 40;
            this.ctx.quadraticCurveTo(cpX, cpY, this.mousePos.x, this.mousePos.y);
            this.ctx.stroke();

            // Target ring at mouse pos
            this.ctx.setLineDash([]);
            this.ctx.strokeStyle = '#facc15';
            this.ctx.beginPath();
            this.ctx.arc(this.mousePos.x, this.mousePos.y, 14, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.restore();
        }
    }

    // UI & DOM HUD UPDATES
    updateHUDTeamInfo() {
        const homeNameEl = document.getElementById('homeTeamName');
        const awayNameEl = document.getElementById('awayTeamName');
        const homeBadgeEl = document.getElementById('homeBadge');
        const awayBadgeEl = document.getElementById('awayBadge');

        if (homeNameEl) homeNameEl.textContent = this.homeTeam.short;
        if (awayNameEl) awayNameEl.textContent = this.awayTeam.short;
        if (homeBadgeEl) homeBadgeEl.style.backgroundColor = this.homeTeam.colors.primaryColor;
        if (awayBadgeEl) awayBadgeEl.style.backgroundColor = this.awayTeam.colors.primaryColor;
    }

    updateScoreboardHUD() {
        const homeScoreEl = document.getElementById('homeScore');
        const awayScoreEl = document.getElementById('awayScore');
        if (homeScoreEl) homeScoreEl.textContent = this.scoreHome;
        if (awayScoreEl) awayScoreEl.textContent = this.scoreAway;
    }

    updateMatchClockHUD() {
        const clockEl = document.getElementById('matchClock');
        if (!clockEl) return;
        const minutes = Math.floor(this.matchTime / 60);
        const seconds = this.matchTime % 60;
        clockEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updatePenaltyHUD() {
        const pRoundEl = document.getElementById('penaltyRound');
        if (pRoundEl) pRoundEl.textContent = `Penalti Seriyasi: ${this.penaltyState.round} / ${this.penaltyState.maxRounds}`;
    }
}

window.FootballGame = FootballGame;

/**
 * PRO FOOTBALL CHAMPIONSHIP - TACTICAL AI SYSTEM
 */

class FootballAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty; // 'easy', 'medium', 'hard'
        this.actionCooldown = 0;
    }

    setDifficulty(diff) {
        this.difficulty = diff;
    }

    update(team, opponentTeam, ball, pitch) {
        const isPossession = team.players.some(p => p.hasBall);
        const opponentGoalX = team.side === 'left' ? pitch.x + pitch.width : pitch.x;
        const ownGoalX = team.side === 'left' ? pitch.x : pitch.x + pitch.width;
        const goalCenterY = pitch.height / 2;

        // Find closest field player to the ball
        let closestPlayer = null;
        let minBallDist = Infinity;

        team.players.forEach(p => {
            if (p.role !== 'GK') {
                const d = Math.hypot(p.x - ball.x, p.y - ball.y);
                if (d < minBallDist) {
                    minBallDist = d;
                    closestPlayer = p;
                }
            }
        });

        team.players.forEach(player => {
            // Only update AI players (or teammates if player is not currently user-controlled)
            if (!player.isAI && player.isSelected) return;

            if (player.role === 'GK') {
                this.updateGoalkeeper(player, ball, pitch, ownGoalX, goalCenterY);
            } else if (player.hasBall) {
                this.updateBallCarrier(player, team, opponentTeam, ball, pitch, opponentGoalX, goalCenterY);
            } else if (isPossession) {
                this.updateAttackingSupport(player, team, ball, pitch, opponentGoalX, goalCenterY);
            } else {
                this.updateDefending(player, closestPlayer, opponentTeam, ball, pitch, ownGoalX, goalCenterY);
            }
        });
    }

    updateGoalkeeper(gk, ball, pitch, ownGoalX, goalCenterY) {
        const goalTop = goalCenterY - pitch.goalWidth / 2 + 10;
        const goalBottom = goalCenterY + pitch.goalWidth / 2 - 10;
        const penaltyBoxWidth = 140;
        const penaltyBoxX = gk.team.side === 'left' ? pitch.x + penaltyBoxWidth : pitch.x + pitch.width - penaltyBoxWidth;

        // If GK has the ball, pass it to an open defender or midfielder
        if (gk.hasBall) {
            if (!gk.passTimer) gk.passTimer = 40;
            gk.passTimer--;
            if (gk.passTimer <= 0) {
                this.passToBestTeammate(gk, gk.team, ball, 7.5);
                gk.passTimer = 0;
            }
            return;
        }

        // Distance from ball to own goal
        const distToBall = Math.hypot(ball.x - ownGoalX, ball.y - goalCenterY);
        const ballInBox = gk.team.side === 'left' 
            ? (ball.x <= penaltyBoxX && Math.abs(ball.y - goalCenterY) < 180)
            : (ball.x >= penaltyBoxX && Math.abs(ball.y - goalCenterY) < 180);

        // Check if ball is moving fast towards the goal -> DIVE!
        const ballSpeed = Math.hypot(ball.vx, ball.vy);
        const headingToOwnGoal = gk.team.side === 'left' ? (ball.vx < -4) : (ball.vx > 4);

        if (ballSpeed > 5 && headingToOwnGoal && distToBall < 260 && !gk.isDiving && Math.random() < this.getReactionRate()) {
            // Predict where ball crosses the goal line
            const timeToLine = Math.abs(ball.x - ownGoalX) / Math.abs(ball.vx);
            const predictedY = ball.y + ball.vy * timeToLine;
            if (predictedY >= goalTop - 20 && predictedY <= goalBottom + 20) {
                gk.dive(ownGoalX, Math.max(goalTop, Math.min(goalBottom, predictedY)));
                return;
            }
        }

        // Rush out if loose ball inside penalty box
        if (ballInBox && !ball.holder && distToBall < 150) {
            this.moveTowards(gk, ball.x, ball.y, gk.baseSpeed * 1.15);
            return;
        }

        // Standard positioning: stay on goal line arc facing the ball
        const targetX = gk.team.side === 'left' ? pitch.x + 28 : pitch.x + pitch.width - 28;
        const targetY = Math.max(goalTop, Math.min(goalBottom, goalCenterY + (ball.y - goalCenterY) * 0.42));

        this.moveTowards(gk, targetX, targetY, gk.baseSpeed);
    }

    updateBallCarrier(player, team, opponentTeam, ball, pitch, opponentGoalX, goalCenterY) {
        const distToGoal = Math.hypot(player.x - opponentGoalX, player.y - goalCenterY);
        const dirToGoal = player.team.side === 'left' ? 1 : -1;

        // Check distance to nearest opponent
        let nearestOppDist = Infinity;
        opponentTeam.players.forEach(opp => {
            const d = Math.hypot(opp.x - player.x, opp.y - player.y);
            if (d < nearestOppDist) nearestOppDist = d;
        });

        // 1. SHOOTING OPPORTUNITY: If close to goal, blast it!
        const shootRange = this.difficulty === 'hard' ? 320 : (this.difficulty === 'medium' ? 260 : 200);
        if (distToGoal < shootRange) {
            // Aim at corners of the goal
            const aimCorner = Math.random() > 0.5 
                ? goalCenterY - pitch.goalWidth / 2 + 25 
                : goalCenterY + pitch.goalWidth / 2 - 25;
            
            const shootAngle = Math.atan2(aimCorner - player.y, opponentGoalX - player.x);
            const shootPower = 11 + (player.shootStat / 100) * 4;
            const spin = (Math.random() - 0.5) * 0.8;
            ball.kick(shootAngle, shootPower, 2.5, spin, player);
            player.kickCooldown = 25;
            return;
        }

        // 2. PASSING: If under heavy pressure or open teammate forward
        if (nearestOppDist < 55 || Math.random() < 0.015) {
            const passed = this.passToBestTeammate(player, team, ball, 8.5);
            if (passed) return;
        }

        // 3. DRIBBLE: Drive towards opponent goal with slight zig-zag
        const targetX = player.x + dirToGoal * 60;
        const targetY = player.y + (Math.sin(Date.now() * 0.003 + player.id) * 25);
        this.moveTowards(player, targetX, targetY, player.isSprinting ? player.sprintSpeed : player.baseSpeed);
    }

    updateAttackingSupport(player, team, ball, pitch, opponentGoalX, goalCenterY) {
        const dirToGoal = team.side === 'left' ? 1 : -1;

        // Formation base anchors
        let targetX = player.defaultPos.x + (ball.x - pitch.width / 2) * 0.55;
        let targetY = player.defaultPos.y;

        if (player.role === 'FWD') {
            // Make attacking run into penalty area
            targetX = opponentGoalX - dirToGoal * (80 + Math.random() * 60);
            targetY = goalCenterY + (player.id % 2 === 0 ? 60 : -60);
        } else if (player.role === 'MID') {
            // Support midfield and follow ball play
            targetX = ball.x - dirToGoal * 50;
            targetY = ball.y + (player.id % 2 === 0 ? 45 : -45);
        } else if (player.role === 'DEF') {
            // Keep defensive line
            targetX = Math.min(pitch.x + pitch.width * 0.5, Math.max(pitch.x + 80, player.defaultPos.x + dirToGoal * 60));
        }

        this.moveTowards(player, targetX, targetY, player.baseSpeed * 0.95);
    }

    updateDefending(player, closestPlayer, opponentTeam, ball, pitch, ownGoalX, goalCenterY) {
        const isClosest = (player === closestPlayer);

        if (isClosest) {
            // Chase ball & carrier aggressively
            this.moveTowards(player, ball.x, ball.y, player.sprintSpeed);

            // Attempt tackle if close to ball carrier
            const distToBall = Math.hypot(player.x - ball.x, player.y - ball.y);
            if (distToBall < 38 && ball.holder && ball.holder.team !== player.team && Math.random() < this.getTackleProbability()) {
                player.tackle();
            }
        } else {
            // Zone marking / tracking back
            let targetX = player.defaultPos.x;
            let targetY = player.defaultPos.y;

            // Shift team towards ball
            targetX += (ball.x - pitch.width / 2) * 0.35;
            targetY += (ball.y - pitch.height / 2) * 0.25;

            this.moveTowards(player, targetX, targetY, player.baseSpeed * 0.85);
        }
    }

    passToBestTeammate(kicker, team, ball, power = 8.0) {
        const candidates = team.players.filter(p => p !== kicker && p.role !== 'GK');
        if (candidates.length === 0) return false;

        // Choose player that is furthest forward towards enemy goal
        const dir = team.side === 'left' ? 1 : -1;
        let bestTeammate = candidates[0];
        let bestScore = -Infinity;

        candidates.forEach(t => {
            const forwardProgress = (t.x - kicker.x) * dir;
            const dist = Math.hypot(t.x - kicker.x, t.y - kicker.y);
            const score = forwardProgress * 1.5 - dist * 0.4;
            if (score > bestScore) {
                bestScore = score;
                bestTeammate = t;
            }
        });

        if (bestTeammate) {
            // Lead the pass slightly
            const leadX = bestTeammate.x + bestTeammate.vx * 6;
            const leadY = bestTeammate.y + bestTeammate.vy * 6;
            const passAngle = Math.atan2(leadY - kicker.y, leadX - kicker.x);
            ball.kick(passAngle, power, 0, 0, kicker);
            kicker.kickCooldown = 25;
            return true;
        }
        return false;
    }

    moveTowards(player, targetX, targetY, maxSpeed) {
        const dx = targetX - player.x;
        const dy = targetY - player.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
            const speed = Math.min(dist * 0.25, maxSpeed);
            player.vx = (dx / dist) * speed;
            player.vy = (dy / dist) * speed;
            player.angle = Math.atan2(dy, dx);
        } else {
            player.vx = 0;
            player.vy = 0;
        }
    }

    getReactionRate() {
        if (this.difficulty === 'hard') return 0.95;
        if (this.difficulty === 'medium') return 0.78;
        return 0.55;
    }

    getTackleProbability() {
        if (this.difficulty === 'hard') return 0.12;
        if (this.difficulty === 'medium') return 0.07;
        return 0.03;
    }
}

window.FootballAI = FootballAI;

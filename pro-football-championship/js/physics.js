/**
 * PRO FOOTBALL CHAMPIONSHIP - REALISTIC 2.5D PHYSICS ENGINE
 */

class Ball {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.z = 0; // Height off ground
        this.vx = 0;
        this.vy = 0;
        this.vz = 0; // Vertical velocity
        this.radius = 9;
        this.friction = 0.985;
        this.airFriction = 0.992;
        this.gravity = 0.42;
        this.bounce = 0.72;
        this.spin = 0; // Magnus curve spin (-1.0 to 1.0)
        this.holder = null; // Player currently possessing
        this.lastKickedBy = null;
        this.inGoal = false;
        this.rotation = 0;
        this.trailTimer = 0;
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.z = 0;
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        this.spin = 0;
        this.holder = null;
        this.lastKickedBy = null;
        this.inGoal = false;
    }

    update(pitch, particles) {
        // If possessed by a player, ball is placed right in front of the player's feet
        if (this.holder) {
            const dribbleDistance = this.holder.radius + this.radius + 3;
            const targetX = this.holder.x + Math.cos(this.holder.angle) * dribbleDistance;
            const targetY = this.holder.y + Math.sin(this.holder.angle) * dribbleDistance;
            
            // Smoothly stick to player
            this.x += (targetX - this.x) * 0.45;
            this.y += (targetY - this.y) * 0.45;
            this.z = 0;
            this.vx = this.holder.vx;
            this.vy = this.holder.vy;
            this.vz = 0;
            this.rotation += Math.hypot(this.vx, this.vy) * 0.15;
            return;
        }

        // Apply Magnus spin effect (curving the trajectory in flight)
        if (Math.abs(this.spin) > 0.05) {
            const speed = Math.hypot(this.vx, this.vy);
            if (speed > 1.5) {
                const perpX = -this.vy / speed;
                const perpY = this.vx / speed;
                const curveForce = this.spin * 0.28 * Math.min(speed / 10, 1.2);
                this.vx += perpX * curveForce;
                this.vy += perpY * curveForce;
            }
            this.spin *= 0.982;
        }

        // Apply 3D gravity and height
        if (this.z > 0 || this.vz > 0) {
            this.vz -= this.gravity;
            this.z += this.vz;

            // Bounce off ground
            if (this.z <= 0) {
                this.z = 0;
                if (Math.abs(this.vz) > 1.2) {
                    this.vz = -this.vz * this.bounce;
                    if (window.soundSystem) window.soundSystem.playKick(Math.abs(this.vz) * 0.15);
                    if (particles) particles.addGrass(this.x, this.y, this.vx * 0.3, this.vy * 0.3, 3);
                } else {
                    this.vz = 0;
                }
            }
            // Air drag
            this.vx *= this.airFriction;
            this.vy *= this.airFriction;
        } else {
            // Ground friction
            this.vx *= this.friction;
            this.vy *= this.friction;
            if (Math.hypot(this.vx, this.vy) < 0.05) {
                this.vx = 0;
                this.vy = 0;
            }
        }

        // Move ball
        this.x += this.vx;
        this.y += this.vy;

        // Visual ball rotation
        const groundSpeed = Math.hypot(this.vx, this.vy);
        this.rotation += groundSpeed * 0.12;

        // Ball speed trail when high velocity shot
        if (groundSpeed > 9 && particles) {
            particles.addBallTrail(this.x, this.y, this.z, this.radius);
        }

        // Post collisions and net logic
        this.checkGoalAndPosts(pitch, particles);
    }

    kick(angle, power, lift = 0, spin = 0, kicker = null) {
        if (this.holder) {
            this.holder.hasBall = false;
            this.holder = null;
        }
        this.vx = Math.cos(angle) * power;
        this.vy = Math.sin(angle) * power;
        this.vz = lift;
        this.spin = spin;
        this.lastKickedBy = kicker;
        if (window.soundSystem) window.soundSystem.playKick(power / 10);
    }

    checkGoalAndPosts(pitch, particles) {
        const goalTop = pitch.height / 2 - pitch.goalWidth / 2;
        const goalBottom = pitch.height / 2 + pitch.goalWidth / 2;
        const postRadius = 6;
        const crossbarHeight = 42; // Max height for a goal

        // Left Goal Posts: Top post, Bottom post
        const leftPosts = [
            { x: pitch.x, y: goalTop },
            { x: pitch.x, y: goalBottom }
        ];

        // Right Goal Posts: Top post, Bottom post
        const rightPosts = [
            { x: pitch.x + pitch.width, y: goalTop },
            { x: pitch.x + pitch.width, y: goalBottom }
        ];

        const allPosts = [...leftPosts, ...rightPosts];

        allPosts.forEach(post => {
            const dist = Math.hypot(this.x - post.x, this.y - post.y);
            if (dist < this.radius + postRadius) {
                // If ball is below crossbar height or hitting the post
                if (this.z < crossbarHeight) {
                    const angle = Math.atan2(this.y - post.y, this.x - post.x);
                    const speed = Math.hypot(this.vx, this.vy);
                    this.vx = Math.cos(angle) * (speed * 0.75 + 1);
                    this.vy = Math.sin(angle) * (speed * 0.75 + 1);
                    this.x = post.x + Math.cos(angle) * (this.radius + postRadius + 1);
                    this.y = post.y + Math.sin(angle) * (this.radius + postRadius + 1);
                    if (window.soundSystem) window.soundSystem.playPostHit();
                    if (particles) particles.addGrass(this.x, this.y, this.vx, this.vy, 8);
                }
            }
        });

        // Inside Left Goal Net
        if (this.x < pitch.x) {
            if (this.y > goalTop && this.y < goalBottom && this.z < crossbarHeight) {
                // Inside net bounds
                if (this.x < pitch.x - pitch.goalDepth + this.radius) {
                    this.x = pitch.x - pitch.goalDepth + this.radius;
                    this.vx = -this.vx * 0.3;
                    if (window.soundSystem) window.soundSystem.playNetHit();
                }
                this.vx *= 0.88;
                this.vy *= 0.88;
            } else {
                // Behind goal line out of goal
                if (this.x < pitch.x - 20) {
                    this.vx *= 0.5;
                }
            }
        }

        // Inside Right Goal Net
        if (this.x > pitch.x + pitch.width) {
            if (this.y > goalTop && this.y < goalBottom && this.z < crossbarHeight) {
                if (this.x > pitch.x + pitch.width + pitch.goalDepth - this.radius) {
                    this.x = pitch.x + pitch.width + pitch.goalDepth - this.radius;
                    this.vx = -this.vx * 0.3;
                    if (window.soundSystem) window.soundSystem.playNetHit();
                }
                this.vx *= 0.88;
                this.vy *= 0.88;
            } else {
                if (this.x > pitch.x + pitch.width + 20) {
                    this.vx *= 0.5;
                }
            }
        }
    }
}

class Player {
    constructor(data, team, isAI = false, defaultPos = { x: 0, y: 0 }) {
        this.id = data.id;
        this.name = data.name;
        this.number = data.number;
        this.role = data.role; // 'GK', 'DEF', 'MID', 'FWD'
        this.team = team;
        this.isAI = isAI;
        this.defaultPos = defaultPos;

        // Physical stats
        this.speedStat = data.speed || 80;
        this.shootStat = data.shoot || 80;
        this.passStat = data.pass || 80;
        this.tackleStat = data.tackle || 75;
        this.gkStat = data.gk || 40;

        // Position & Movement
        this.x = defaultPos.x;
        this.y = defaultPos.y;
        this.vx = 0;
        this.vy = 0;
        this.targetX = defaultPos.x;
        this.targetY = defaultPos.y;
        this.angle = team.side === 'left' ? 0 : Math.PI;
        this.radius = 16;
        this.baseSpeed = 3.2 + (this.speedStat / 100) * 1.8;
        this.sprintSpeed = this.baseSpeed * 1.45;

        // States
        this.stamina = 100;
        this.maxStamina = 100;
        this.isSprinting = false;
        this.isTackling = false;
        this.tackleTimer = 0;
        this.tackleCooldown = 0;
        this.isDiving = false; // Goalkeeper dive
        this.diveTimer = 0;
        this.diveDir = { x: 0, y: 0 };
        this.hasBall = false;
        this.isSelected = false;
        this.kickCooldown = 0;
        this.runCycle = 0;
    }

    reset(pos) {
        this.x = pos.x;
        this.y = pos.y;
        this.targetX = pos.x;
        this.targetY = pos.y;
        this.vx = 0;
        this.vy = 0;
        this.angle = this.team.side === 'left' ? 0 : Math.PI;
        this.hasBall = false;
        this.isTackling = false;
        this.tackleTimer = 0;
        this.isDiving = false;
        this.diveTimer = 0;
        this.stamina = 100;
        this.kickCooldown = 0;
    }

    tackle() {
        if (this.tackleTimer > 0 || this.tackleCooldown > 0 || this.hasBall) return;
        this.isTackling = true;
        this.tackleTimer = 22; // ~360ms slide
        this.tackleCooldown = 60;
        const tackleSpeed = 7.5;
        this.vx = Math.cos(this.angle) * tackleSpeed;
        this.vy = Math.sin(this.angle) * tackleSpeed;
        if (window.soundSystem) window.soundSystem.playTackle();
    }

    dive(targetX, targetY) {
        if (this.role !== 'GK' || this.diveTimer > 0) return;
        this.isDiving = true;
        this.diveTimer = 25;
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        this.angle = angle;
        this.vx = Math.cos(angle) * 6.2;
        this.vy = Math.sin(angle) * 6.2;
        if (window.soundSystem) window.soundSystem.playTackle();
    }

    update(pitch, ball, particles) {
        if (this.kickCooldown > 0) this.kickCooldown--;
        if (this.tackleCooldown > 0) this.tackleCooldown--;

        // Slide tackle update
        if (this.isTackling) {
            this.tackleTimer--;
            this.vx *= 0.92;
            this.vy *= 0.92;
            this.x += this.vx;
            this.y += this.vy;
            if (particles && Math.random() > 0.3) {
                particles.addGrass(this.x, this.y, -this.vx * 0.4, -this.vy * 0.4, 3);
            }
            if (this.tackleTimer <= 0) {
                this.isTackling = false;
            }
            this.clampToPitch(pitch);
            return;
        }

        // GK dive update
        if (this.isDiving) {
            this.diveTimer--;
            this.vx *= 0.90;
            this.vy *= 0.90;
            this.x += this.vx;
            this.y += this.vy;
            if (particles && Math.random() > 0.4) {
                particles.addGrass(this.x, this.y, -this.vx * 0.3, -this.vy * 0.3, 2);
            }
            if (this.diveTimer <= 0) {
                this.isDiving = false;
            }
            this.clampToPitch(pitch);
            return;
        }

        // Normal movement update
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 0.1) {
            this.angle = Math.atan2(this.vy, this.vx);
            this.runCycle += speed * 0.2;
            if (particles && Math.random() > 0.85 && this.isSprinting) {
                particles.addGrass(this.x, this.y, -this.vx * 0.2, -this.vy * 0.2, 1);
            }
        }

        // Stamina management
        if (this.isSprinting && speed > 1) {
            this.stamina = Math.max(0, this.stamina - 0.25);
            if (this.stamina <= 0) this.isSprinting = false;
        } else {
            this.stamina = Math.min(this.maxStamina, this.stamina + 0.15);
        }

        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.82;
        this.vy *= 0.82;

        this.clampToPitch(pitch);
    }

    clampToPitch(pitch) {
        const margin = 10;
        this.x = Math.max(pitch.x + margin, Math.min(pitch.x + pitch.width - margin, this.x));
        this.y = Math.max(pitch.y + margin, Math.min(pitch.y + pitch.height - margin, this.y));
    }
}

window.Ball = Ball;
window.Player = Player;

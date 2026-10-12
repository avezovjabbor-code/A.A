/**
 * PRO FOOTBALL CHAMPIONSHIP - PARTICLE & FX SYSTEM
 */

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

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.confetti = [];
        this.rainDrops = [];
        this.ballTrails = [];
        this.banners = [];
    }

    addGrass(x, y, vx, vy, count = 5) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            this.particles.push({
                x: x + (Math.random() - 0.5) * 8,
                y: y + (Math.random() - 0.5) * 8,
                vx: vx * 0.3 + Math.cos(angle) * speed,
                vy: vy * 0.3 + Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.03 + Math.random() * 0.03,
                size: Math.random() * 2.5 + 1.5,
                color: Math.random() > 0.4 ? '#4ade80' : '#22c55e',
                type: 'grass'
            });
        }
    }

    addBallTrail(x, y, z, radius) {
        this.ballTrails.push({
            x,
            y,
            z,
            radius,
            alpha: 0.6
        });
        if (this.ballTrails.length > 15) {
            this.ballTrails.shift();
        }
    }

    triggerGoalCelebration(pitchWidth, pitchHeight) {
        // Explode 250 vibrant confetti particles from the goal sides
        const colors = ['#f43f5e', '#3b82f6', '#eab308', '#10b981', '#a855f7', '#ec4899', '#ffffff', '#fb923c'];
        for (let i = 0; i < 200; i++) {
            const fromLeft = Math.random() > 0.5;
            const originX = fromLeft ? 60 : pitchWidth - 60;
            const originY = pitchHeight / 2 + (Math.random() - 0.5) * 200;

            const angle = fromLeft 
                ? (Math.random() * Math.PI * 0.7 - Math.PI * 0.35) 
                : (Math.PI - (Math.random() * Math.PI * 0.7 - Math.PI * 0.35));
            const speed = Math.random() * 12 + 6;

            this.confetti.push({
                x: originX,
                y: originY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - (Math.random() * 4 + 3),
                gravity: 0.28,
                rot: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 0.3,
                w: Math.random() * 7 + 4,
                h: Math.random() * 5 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                decay: 0.007 + Math.random() * 0.005
            });
        }
    }

    addBanner(text, subtext = '', duration = 120, color = '#fbbf24') {
        this.banners.push({
            text,
            subtext,
            life: duration,
            maxLife: duration,
            color,
            scale: 0.2
        });
    }

    initRain(pitchWidth, pitchHeight, count = 120) {
        this.rainDrops = [];
        for (let i = 0; i < count; i++) {
            this.rainDrops.push({
                x: Math.random() * pitchWidth,
                y: Math.random() * pitchHeight,
                l: Math.random() * 12 + 8,
                speed: Math.random() * 8 + 14
            });
        }
    }

    update(pitchWidth, pitchHeight, isRaining = false) {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update ball trails
        for (let i = this.ballTrails.length - 1; i >= 0; i--) {
            const t = this.ballTrails[i];
            t.alpha -= 0.05;
            if (t.alpha <= 0) {
                this.ballTrails.splice(i, 1);
            }
        }

        // Update confetti
        for (let i = this.confetti.length - 1; i >= 0; i--) {
            const c = this.confetti[i];
            c.x += c.vx;
            c.y += c.vy;
            c.vy += c.gravity;
            c.vx *= 0.98;
            c.rot += c.vRot;
            c.life -= c.decay;
            if (c.life <= 0 || c.y > pitchHeight + 100) {
                this.confetti.splice(i, 1);
            }
        }

        // Update rain
        if (isRaining) {
            for (let r of this.rainDrops) {
                r.x -= 2;
                r.y += r.speed;
                if (r.y > pitchHeight) {
                    r.y = -10;
                    r.x = Math.random() * (pitchWidth + 200);
                }
            }
        }

        // Update banners
        for (let i = this.banners.length - 1; i >= 0; i--) {
            const b = this.banners[i];
            b.life--;
            // Pop in smoothly
            const progress = 1 - (b.life / b.maxLife);
            if (progress < 0.2) {
                b.scale = Math.sin((progress / 0.2) * (Math.PI / 2));
            } else {
                b.scale = 1.0;
            }
            if (b.life <= 0) {
                this.banners.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        // Draw Grass particles
        for (let p of this.particles) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw Ball Trails (fire / speed trail effect)
        for (let t of this.ballTrails) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, t.alpha * 0.4);
            const grad = ctx.createRadialGradient(t.x, t.y - t.z, 0, t.x, t.y - t.z, t.radius * 2.2);
            grad.addColorStop(0, 'rgba(255, 230, 80, 0.8)');
            grad.addColorStop(0.6, 'rgba(249, 115, 22, 0.4)');
            grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(t.x, t.y - t.z, t.radius * 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw Confetti
        for (let c of this.confetti) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, c.life);
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rot);
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
            ctx.restore();
        }
    }

    drawWeather(ctx, width, height) {
        if (this.rainDrops.length > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(200, 225, 255, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let r of this.rainDrops) {
                ctx.moveTo(r.x, r.y);
                ctx.lineTo(r.x - 2, r.y + r.l);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    drawBanners(ctx, viewWidth, viewHeight) {
        for (let b of this.banners) {
            ctx.save();
            ctx.translate(viewWidth / 2, viewHeight / 2 - 40);
            ctx.scale(b.scale, b.scale);

            // Banner shadow & background card
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 25;
            ctx.fillStyle = 'rgba(10, 15, 25, 0.88)';
            ctx.strokeStyle = b.color;
            ctx.lineWidth = 3;

            const textW = Math.max(380, ctx.measureText(b.text).width + 80);
            const boxH = b.subtext ? 110 : 80;

            ctx.beginPath();
            ctx.roundRect(-textW / 2, -boxH / 2, textW, boxH, 16);
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.shadowBlur = 10;
            ctx.shadowColor = b.color;
            ctx.fillStyle = b.color;
            ctx.font = 'bold 44px "Outfit", "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.text, 0, b.subtext ? -14 : 0);

            if (b.subtext) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ffffff';
                ctx.font = '500 20px "Outfit", "Segoe UI", sans-serif';
                ctx.fillText(b.subtext, 0, 26);
            }

            ctx.restore();
        }
    }
}

window.ParticleSystem = ParticleSystem;

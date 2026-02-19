const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const mainMenu = document.getElementById('main-menu');
const gameOverScreen = document.getElementById('game-over');
const victoryScreen = document.getElementById('victory');
const hud = document.getElementById('hud');
const progressBar = document.getElementById('progress-bar');
const percentageText = document.getElementById('percentage');
const finalScoreText = document.getElementById('final-score');

// Game Constants
let GAME_SPEED = 6;
const GRAVITY = 0.6;
const JUMP_FORCE = -11;
const DOUBLE_JUMP_FORCE = -10;
const ROTATION_SPEED = 0.15;

// Game State
let gameState = 'MENU';
let frameCount = 0;
let levelLength = 0;
let currentDifficulty = 'normal';
let currentChapter = 1; // 1 to 5

// Entities
let player;
let obstacles = [];
let particles = [];
let backgroundLayers = [];

// Assets / Colors
const COLORS = {
    skyTop: '#89cff0',
    skyBottom: '#e0f7fa',
    cloud: '#fff',
    hillFar: '#9ccc65',
    hillNear: '#7cb342',
    ground: '#558b2f',
    spike: '#5d4037',
    player: '#ffd54f',
    playerGlow: '#fff9c4',
    platform: '#8d6e63'
};

function resizeCanvas() {
    canvas.width = 800;
    canvas.height = 450;
}
resizeCanvas();

// --- Input Handling ---
function handleInput() {
    if (gameState === 'PLAYING') {
        player.jump();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') handleInput();
});

canvas.addEventListener('mousedown', handleInput);

// --- Game Logic ---

function startGame(difficulty) {
    currentDifficulty = difficulty;
    currentChapter = 1; // Always start at Chapter 1
    startChapter();
}

function startChapter() {
    // Determine Speed based on Difficulty + Chapter
    let baseSpeed = 5;
    if (currentDifficulty === 'normal') baseSpeed = 7;
    if (currentDifficulty === 'hard') baseSpeed = 9;

    // Slight speed increase per chapter
    GAME_SPEED = baseSpeed + (currentChapter - 1) * 0.5;

    // Level Length increases with chapter
    levelLength = 2000 + (currentChapter * 500);

    gameState = 'PLAYING';
    frameCount = 0;
    obstacles = [];
    particles = [];

    player = new Player();
    initBackgrounds();
    generateLevel();

    updateUI();
    loop();
}

function nextChapter() {
    if (currentChapter < 5) {
        currentChapter++;
        startChapter();
    } else {
        victory();
    }
}

function resetGame() {
    // Restart current chapter
    startChapter();
}

function updateUI() {
    mainMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    // Show Chapter Info briefly? For now just HUD
    percentageText.innerText = `Ch ${currentChapter} - 0%`;
}

function showMainMenu() {
    gameState = 'MENU';
    mainMenu.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
    hud.classList.add('hidden');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    initBackgrounds();
    drawBackground();
}

function gameOver() {
    gameState = 'GAMEOVER';
    for (let i = 0; i < 30; i++) {
        particles.push(new Particle(player.x, player.y, player.color));
    }
    draw();

    const percent = Math.min(100, Math.floor((player.x / (levelLength * GAME_SPEED)) * 100));
    finalScoreText.innerText = `Chapter ${currentChapter} - ${percent}%`;
    setTimeout(() => {
        gameOverScreen.classList.remove('hidden');
    }, 500);
}

function victory() {
    gameState = 'VICTORY';
    victoryScreen.classList.remove('hidden');
}

function generateLevel() {
    let x = 800;
    const minGap = currentDifficulty === 'hard' ? 250 : 350;
    const maxGap = currentDifficulty === 'hard' ? 450 : 600;

    // Y levels - Optimized for Double Jump
    const GROUND_Y = 350;
    const LOW_PLATFORM_Y = 280; // Easy single jump (70px up)
    const MID_PLATFORM_Y = 220; // Needs good jump (130px up)
    const HIGH_PLATFORM_Y = 170; // Needs double jump (180px up)

    // Aerial density based on Chapter (20% -> 90%)
    const aerialThreshold = 0.1 + (currentChapter * 0.16); // Ch1: 0.26, Ch5: 0.9

    while (x < levelLength * GAME_SPEED) {
        let gap = Math.random() * (maxGap - minGap) + minGap;

        // In later chapters, gap can be larger due to double jump
        if (currentChapter >= 3) gap += 50;

        x += gap;

        const isAerial = Math.random() < aerialThreshold;

        if (isAerial) {
            // == Aerial Section (Platforms) ==

            // Decide height based on chapter progression
            let height = LOW_PLATFORM_Y;
            if (currentChapter >= 2 && Math.random() > 0.4) height = MID_PLATFORM_Y;
            if (currentChapter >= 4 && Math.random() > 0.6) height = HIGH_PLATFORM_Y;

            const length = Math.floor(Math.random() * 3) + 3; // 3-5 segments

            // Create Platforms
            for (let i = 0; i < length; i++) {
                obstacles.push(new Obstacle(x + i * 50, 'platform', height));
            }

            // ** FORCE AERIAL: Ground Spikes under the platform **
            // Fill the ground below with spikes so player MUST take the platform
            const platStartX = x;
            const platEndX = x + (length * 50);

            // Cover the entire ground area under the platforms with spikes
            // Spikes are ~30px wide
            for (let groundX = platStartX - 50; groundX < platEndX + 50; groundX += 30) {
                obstacles.push(new Obstacle(groundX, 'spike', GROUND_Y));
            }

            // Chance for obstacle ON the platform
            if (Math.random() > 0.6) {
                // Place small spike on middle/end of platform
                const spikeIndex = Math.floor(Math.random() * (length - 1)) + 1;
                obstacles.push(new Obstacle(x + spikeIndex * 50, 'spike', height));
            }

            x += 50 * length;

        } else {
            // == Ground Section ==
            const pattern = Math.random();

            if (pattern < 0.3) {
                // Triple Spike
                obstacles.push(new Obstacle(x, 'spike', GROUND_Y));
                obstacles.push(new Obstacle(x + 35, 'spike', GROUND_Y));
                obstacles.push(new Obstacle(x + 70, 'spike', GROUND_Y));
                x += 70;
            } else if (pattern < 0.6) {
                // Double Spike
                obstacles.push(new Obstacle(x, 'spike', GROUND_Y));
                obstacles.push(new Obstacle(x + 35, 'spike', GROUND_Y));
                x += 35;
            } else {
                // Tall Block
                obstacles.push(new Obstacle(x, 'block', GROUND_Y));
            }
        }
    }

    obstacles.push(new Obstacle(levelLength * GAME_SPEED + 500, 'finish'));
}

function initBackgrounds() {
    backgroundLayers = [];
    backgroundLayers.push(new BackgroundLayer(0.2, COLORS.cloud, 'cloud'));
    backgroundLayers.push(new BackgroundLayer(0.1, COLORS.hillFar, 'hill', 150));
    backgroundLayers.push(new BackgroundLayer(0.5, COLORS.hillNear, 'hill', 100));
}

// --- Classes ---

class Player {
    constructor() {
        this.size = 36;
        this.x = 150;
        this.y = 300;
        this.prevY = 300;
        this.vy = 0;
        this.rotation = 0;
        this.isGrounded = false;
        this.jumpCount = 0; // For Double Jump
        this.maxJumps = 2;
        this.color = COLORS.player;
    }

    update() {
        this.prevY = this.y;
        this.vy += GRAVITY;
        this.y += this.vy;

        const groundLevel = 350 - this.size / 2;

        // Ground Collision
        if (this.y > groundLevel) {
            this.y = groundLevel;
            this.vy = 0;
            this.isGrounded = true;
            this.jumpCount = 0; // Reset jumps
            this.snapRotation();
        } else {
            this.isGrounded = false;
            this.rotation += ROTATION_SPEED;
        }
    }

    snapRotation() {
        const nearestRepo = Math.round(this.rotation / (Math.PI / 2)) * (Math.PI / 2);
        this.rotation = this.rotation + (nearestRepo - this.rotation) * 0.2;
    }

    jump() {
        if (this.isGrounded) {
            this.vy = JUMP_FORCE;
            this.isGrounded = false;
            this.jumpCount = 1;
        } else if (this.jumpCount < this.maxJumps) {
            // Double Jump
            this.vy = DOUBLE_JUMP_FORCE;
            this.jumpCount++;

            // Double jump particle effect
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(this.x, this.y + this.size / 2, '#fff'));
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(150, this.y);
        ctx.rotate(this.rotation);

        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.playerGlow;

        ctx.fillStyle = this.color;

        roundRect(ctx, -this.size / 2, -this.size / 2, this.size, this.size, 6);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#4e342e';

        ctx.beginPath();
        ctx.arc(6, -2, 4, 0, Math.PI * 2);
        ctx.arc(-6, -2, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class Obstacle {
    constructor(x, type, y = null) {
        this.x = x;
        this.type = type;
        this.w = 34; // Slightly wider
        this.h = 34;
        this.y = y; // Custom Y (top of obstacle for platforms, base for spikes/blocks)

        // Defaults if y is not provided
        if (this.y === null) {
            if (this.type === 'spike' || this.type === 'block') {
                this.y = 350; // Ground level base
            } else if (this.type === 'finish') {
                this.y = 0;
            }
        }

        if (this.type === 'finish') {
            this.w = 50;
            this.h = 500;
        } else if (this.type === 'platform') {
            this.w = 50;
            this.h = 20;
            // this.y is passed in constructor e.g., 250 or 150
        }
    }

    draw() {
        const screenX = this.x - (player.x - 150);
        if (screenX < -100 || screenX > 900) return;

        if (this.type === 'spike') {
            ctx.fillStyle = COLORS.spike;
            ctx.beginPath();
            // Triangle
            ctx.moveTo(screenX + 5, this.y);
            ctx.lineTo(screenX + this.w / 2, this.y - this.h);
            ctx.lineTo(screenX + this.w - 5, this.y);
            ctx.fill();

            // Detail (lighter side)
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.moveTo(screenX + 5, this.y);
            ctx.lineTo(screenX + this.w / 2, this.y - this.h);
            ctx.lineTo(screenX + this.w / 2, this.y);
            ctx.fill();

        } else if (this.type === 'block') {
            ctx.fillStyle = '#795548'; // Wood/Earth block
            ctx.fillRect(screenX, this.y - this.h, this.w, this.h);

            // Grass on top
            ctx.fillStyle = '#7cb342';
            ctx.fillRect(screenX, this.y - this.h, this.w, 6);

        } else if (this.type === 'platform') {
            // Floating platform
            ctx.fillStyle = COLORS.platform;
            ctx.fillRect(screenX, this.y, this.w, this.h);
            // Grass on top
            ctx.fillStyle = '#81c784'; // Lighter grass
            ctx.fillRect(screenX, this.y, this.w, 5);

        } else if (this.type === 'finish') {
            ctx.fillStyle = '#fff9c4';
            ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.1) * 0.2;
            ctx.fillRect(screenX, 0, 20, 450);
            ctx.globalAlpha = 1.0;
        }
    }

    getHitbox() {
        if (this.type === 'spike') {
            // Approximate spike hitbox for collision
            return { x: this.x + 8, y: this.y - this.h + 10, w: this.w - 16, h: this.h - 10 };
        } else if (this.type === 'block') {
            return { x: this.x, y: this.y - this.h, w: this.w, h: this.h };
        } else if (this.type === 'platform') {
            return { x: this.x, y: this.y, w: this.w, h: this.h };
        } else if (this.type === 'finish') {
            return { x: this.x, y: 0, w: 20, h: 450 };
        }
        return { x: 0, y: 0, w: 0, h: 0 };
    }
}

class BackgroundLayer {
    constructor(speedMod, color, type, heightFunc = 100) {
        this.speedMod = speedMod;
        this.color = color;
        this.type = type;
        this.items = [];
        this.heightFunc = heightFunc;

        // Pre-generate some items
        for (let i = 0; i < 10; i++) {
            this.items.push({
                x: Math.random() * 800 + i * 200,
                y: type === 'cloud' ? Math.random() * 150 : 350,
                size: Math.random() * 50 + 50
            });
        }
    }

    updateAndDraw(playerX) {
        const relX = playerX * this.speedMod;

        ctx.fillStyle = this.color;

        this.items.forEach(item => {
            let drawX = item.x - (relX % 1600); // Loop logic
            if (drawX < -200) drawX += 1600; // Reset

            if (this.type === 'cloud') {
                // Cloud circles
                ctx.beginPath();
                ctx.arc(drawX, item.y, item.size, 0, Math.PI * 2);
                ctx.arc(drawX + item.size * 0.8, item.y - item.size * 0.5, item.size * 0.7, 0, Math.PI * 2);
                ctx.arc(drawX + item.size * 1.2, item.y, item.size * 0.8, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.type === 'hill') {
                // Hill sine waveish
                ctx.beginPath();
                ctx.moveTo(drawX - 200, 450);

                // Draw a hill shape
                ctx.ellipse(drawX, 450, item.size * 4, item.size * 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - (player.x - 150), this.y, 8, 8);
        ctx.restore();
    }
}

// --- Utils ---
function roundRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function update() {
    if (gameState !== 'PLAYING') return;

    player.x += GAME_SPEED;
    player.update();

    // Check collisions
    // Player Hitbox (smaller than visual)
    const pRect = {
        x: player.x - player.size / 2 + 6,
        y: player.y - player.size / 2 + 6,
        w: player.size - 12,
        h: player.size - 12
    };

    for (const ob of obstacles) {
        // Optimization
        if (ob.x < player.x - 200) continue;
        if (ob.x > player.x + 200) break;

        const obRect = ob.getHitbox();

        if (checkCollision(pRect, obRect)) {
            if (ob.type === 'finish') {
                nextChapter(); // Progress to next chapter instead of victory
            } else if (ob.type === 'platform') {
                // Platform collision resolution
                // If player was above the platform in previous frame AND falling -> Land
                const prevBottom = player.prevY + player.size / 2;
                const platformTop = obRect.y; // Top of platform is y

                // Allow a small buffer for fast movement
                if (player.vy >= 0 && prevBottom <= platformTop + 15) {
                    // Landed on top
                    player.y = platformTop - player.size / 2;
                    player.vy = 0;
                    player.isGrounded = true;
                    player.jumpCount = 0; // Reset jumps
                    player.snapRotation();
                } else {
                    // Hit side or bottom -> Death
                    gameOver();
                }
            } else if (ob.type === 'block') {
                // Block logic: if landing on top, survive. Else die.
                const prevBottom = player.prevY + player.size / 2;
                const platformTop = obRect.y;

                if (player.vy >= 0 && prevBottom <= platformTop + 15) {
                    // Landed
                    player.y = platformTop - player.size / 2;
                    player.vy = 0;
                    player.isGrounded = true;
                    player.jumpCount = 0; // Reset jumps
                    player.snapRotation();
                } else {
                    gameOver();
                }
            } else {
                // Spikes kill instantly
                gameOver();
            }
        }
    }

    // Progress
    const percent = Math.min(100, (player.x / (levelLength * GAME_SPEED)) * 100);
    progressBar.style.width = `${percent}%`;
    percentageText.innerText = `Ch ${currentChapter} - ${Math.floor(percent)}%`;
}

function checkCollision(r1, r2) {
    return (r1.x < r2.x + r2.w &&
        r1.x + r1.w > r2.x &&
        r1.y < r2.y + r2.h &&
        r1.y + r1.h > r2.y);
}

function drawBackground() {
    // Background Clear
    ctx.fillStyle = COLORS.skyBottom;
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Fallback if no CSS/gradient

    backgroundLayers.forEach(layer => layer.updateAndDraw(player ? player.x : 0));

    // Foreground Ground
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 350, 800, 100);

    // Top Grass Line
    ctx.fillStyle = '#AED581';
    ctx.fillRect(0, 350, 800, 5);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();

    if (gameState === 'PLAYING' || gameState === 'GAMEOVER' || gameState === 'VICTORY') {
        player.draw();

        for (const ob of obstacles) {
            ob.draw();
        }

        // Particles
        particles.forEach((p, index) => {
            p.update();
            p.draw();
            if (p.life <= 0) particles.splice(index, 1);
        });
    }
}

function loop() {
    if (gameState === 'PLAYING' || (gameState === 'GAMEOVER' && particles.length > 0)) {
        update();
        draw();
        frameCount++;
        requestAnimationFrame(loop);
    }
}

// Init
initBackgrounds();
drawBackground();

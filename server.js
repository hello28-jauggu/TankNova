const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "..", "public")));

const WORLD = {
  width: 3600,
  height: 2400
};

const players = new Map();
const bots = new Map();
const bullets = new Map();

let playerId = 1;
let botId = 1;
let bulletId = 1;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomSpawn() {
  return {
    x: 200 + Math.random() * (WORLD.width - 400),
    y: 200 + Math.random() * (WORLD.height - 400)
  };
}

function cleanName(name) {
  return String(name || "Player")
    .replace(/[^\w -]/g, "")
    .trim()
    .slice(0, 18) || "Player";
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createPlayer(name) {
  const spawn = randomSpawn();

  return {
    id: String(playerId++),
    name: cleanName(name),

    x: spawn.x,
    y: spawn.y,

    angle: 0,

    radius: 25,

    speed: 280,

    hp: 100,
    maxHp: 100,

    level: 1,
    xp: 0,
    score: 0,

    fireCooldown: 0,

    input: {
      up: false,
      down: false,
      left: false,
      right: false,
      fire: false,
      angle: 0
    },

    ws: null
  };
}

function createBot() {
  const spawn = randomSpawn();

  return {
    id: "bot-" + botId++,
    name: "Drone",

    x: spawn.x,
    y: spawn.y,

    angle: Math.random() * Math.PI * 2,

    radius: 22,

    speed: 120,

    hp: 70,
    maxHp: 70,

    fireCooldown: Math.random()
  };
}

function addXP(player, amount) {
  player.xp += amount;

  while (player.xp >= player.level * 100) {
    player.xp -= player.level * 100;
    player.level++;

    player.maxHp += 10;
    player.hp = player.maxHp;

    player.speed += 5;
  }
}

function fireBullet(owner, ownerType, angle) {
  const id = String(bulletId++);

  const speed = ownerType === "player" ? 850 : 500;
  const damage = ownerType === "player" ? 20 : 10;

  bullets.set(id, {
    id,

    owner: owner.id,
    ownerType,

    x: owner.x + Math.cos(angle) * 38,
    y: owner.y + Math.sin(angle) * 38,

    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,

    radius: 7,

    damage,

    life: 1.6,

    color: ownerType === "player"
      ? "#72eaff"
      : "#ff9c68"
  });
}

function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(data) {
  const message = JSON.stringify(data);

  for (const player of players.values()) {
    if (player.ws && player.ws.readyState === 1) {
      player.ws.send(message);
    }
  }
}

wss.on("connection", ws => {
  let player = null;

  send(ws, {
    type: "hello",
    world: WORLD
  });

  ws.on("message", raw => {
    try {
      const message = JSON.parse(raw);

      if (message.type === "join" && !player) {
        player = createPlayer(message.name);
        player.ws = ws;

        players.set(player.id, player);

        send(ws, {
          type: "joined",
          id: player.id,
          world: WORLD
        });

        console.log(`${player.name} joined`);
      }

      if (message.type === "input" && player) {
        const input = message.input || {};

        player.input.up = !!input.up;
        player.input.down = !!input.down;
        player.input.left = !!input.left;
        player.input.right = !!input.right;
        player.input.fire = !!input.fire;

        if (Number.isFinite(input.angle)) {
          player.input.angle = input.angle;
        }
      }

    } catch {
      // Ignore invalid packets
    }
  });

  ws.on("close", () => {
    if (player) {
      console.log(`${player.name} left`);
      players.delete(player.id);
    }
  });
});

// Initial bots
for (let i = 0; i < 12; i++) {
  const bot = createBot();
  bots.set(bot.id, bot);
}

function updatePlayers(dt) {
  for (const player of players.values()) {

    let dx = 0;
    let dy = 0;

    if (player.input.right) dx++;
    if (player.input.left) dx--;

    if (player.input.down) dy++;
    if (player.input.up) dy--;

    const length = Math.hypot(dx, dy);

    if (length > 0) {
      dx /= length;
      dy /= length;
    }

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    player.x = clamp(
      player.x,
      player.radius,
      WORLD.width - player.radius
    );

    player.y = clamp(
      player.y,
      player.radius,
      WORLD.height - player.radius
    );

    player.angle = player.input.angle;

    player.fireCooldown -= dt;

    if (player.input.fire && player.fireCooldown <= 0) {
      fireBullet(
        player,
        "player",
        player.angle
      );

      player.fireCooldown = 0.22;
    }
  }
}

function updateBots(dt) {
  for (const bot of bots.values()) {

    let target = null;
    let closest = Infinity;

    for (const player of players.values()) {
      const d = distance(bot, player);

      if (d < closest) {
        closest = d;
        target = player;
      }
    }

    bot.fireCooldown -= dt;

    if (!target) continue;

    const angle = Math.atan2(
      target.y - bot.y,
      target.x - bot.x
    );

    bot.angle = angle;

    if (closest > 350) {
      bot.x += Math.cos(angle) * bot.speed * dt;
      bot.y += Math.sin(angle) * bot.speed * dt;
    }

    if (closest < 850 && bot.fireCooldown <= 0) {
      fireBullet(
        bot,
        "bot",
        angle
      );

      bot.fireCooldown = 0.8;
    }
  }
}

function respawnBot(bot) {
  const spawn = randomSpawn();

  bot.x = spawn.x;
  bot.y = spawn.y;
  bot.hp = bot.maxHp;
}

function respawnPlayer(player) {
  const spawn = randomSpawn();

  player.x = spawn.x;
  player.y = spawn.y;
  player.hp = player.maxHp;
}

function updateBullets(dt) {
  for (const [id, bullet] of bullets) {

    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    bullet.life -= dt;

    if (
      bullet.life <= 0 ||
      bullet.x < 0 ||
      bullet.y < 0 ||
      bullet.x > WORLD.width ||
      bullet.y > WORLD.height
    ) {
      bullets.delete(id);
      continue;
    }

    if (bullet.ownerType === "player") {

      let hit = false;

      for (const bot of bots.values()) {
        if (
          distance(bullet, bot) <
          bullet.radius + bot.radius
        ) {
          bot.hp -= bullet.damage;

          bullets.delete(id);
          hit = true;

          if (bot.hp <= 0) {
            const killer = players.get(bullet.owner);

            if (killer) {
              killer.score += 100;
              addXP(killer, 50);
            }

            respawnBot(bot);
          }

          break;
        }
      }

      if (hit) continue;
    }

    if (bullet.ownerType === "bot") {

      for (const player of players.values()) {

        if (
          distance(bullet, player) <
          bullet.radius + player.radius
        ) {
          player.hp -= bullet.damage;

          bullets.delete(id);

          if (player.hp <= 0) {
            player.score = Math.max(
              0,
              player.score - 25
            );

            respawnPlayer(player);
          }

          break;
        }
      }
    }
  }
}

function gameState() {
  return {
    type: "state",

    players: [...players.values()].map(player => ({
      id: player.id,
      name: player.name,

      x: player.x,
      y: player.y,

      angle: player.angle,

      radius: player.radius,

      hp: player.hp,
      maxHp: player.maxHp,

      level: player.level,
      xp: player.xp,
      score: player.score
    })),

    bots: [...bots.values()].map(bot => ({
      id: bot.id,
      name: bot.name,

      x: bot.x,
      y: bot.y,

      angle: bot.angle,

      radius: bot.radius,

      hp: bot.hp,
      maxHp: bot.maxHp
    })),

    bullets: [...bullets.values()].map(bullet => ({
      id: bullet.id,

      x: bullet.x,
      y: bullet.y,

      radius: bullet.radius,
      color: bullet.color
    }))
  };
}

let lastTime = Date.now();

setInterval(() => {

  const now = Date.now();

  const dt = Math.min(
    (now - lastTime) / 1000,
    0.05
  );

  lastTime = now;

  updatePlayers(dt);
  updateBots(dt);
  updateBullets(dt);

  broadcast(gameState());

}, 1000 / 30);

server.listen(PORT, () => {
  console.log(`TankNova running on port ${PORT}`);
});
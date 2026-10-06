const canvas =
  document.getElementById("game");

const ctx =
  canvas.getContext("2d");

const menu =
  document.getElementById("menu");

const hud =
  document.getElementById("hud");

const nameInput =
  document.getElementById("name");

const play =
  document.getElementById("play");

const joystick =
  document.getElementById("joystick");

const knob =
  document.querySelector(".knob");

const fireButton =
  document.getElementById("fireButton");

let socket = null;

let myId = null;

let world = {
  width: 3600,
  height: 2400
};

let state = {
  players: [],
  bots: [],
  bullets: []
};

let keys = {};

let mouse = {
  x: innerWidth / 2,
  y: innerHeight / 2,
  down: false
};

let joystickInput = {
  x: 0,
  y: 0
};

let mobileFire = false;

const camera = {
  x: 0,
  y: 0
};

function resize() {

  const ratio =
    window.devicePixelRatio || 1;

  canvas.width =
    innerWidth * ratio;

  canvas.height =
    innerHeight * ratio;

  canvas.style.width =
    innerWidth + "px";

  canvas.style.height =
    innerHeight + "px";

  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );
}

window.addEventListener(
  "resize",
  resize
);

resize();

play.addEventListener(
  "click",
  () => {

    const name =
      nameInput.value.trim() ||
      "Player";

    const protocol =
      location.protocol === "https:"
        ? "wss://"
        : "ws://";

    socket =
      new WebSocket(
        protocol + location.host
      );

    socket.addEventListener(
      "open",
      () => {

        socket.send(
          JSON.stringify({
            type: "join",
            name
          })
        );
      }
    );

    socket.addEventListener(
      "message",
      event => {

        const message =
          JSON.parse(event.data);

        if (message.type === "joined") {

          myId = message.id;

          world = message.world;

          menu.style.display = "none";

          hud.hidden = false;
        }

        if (message.type === "state") {

          state = message;
        }
      }
    );
  }
);

window.addEventListener(
  "keydown",
  event => {

    keys[
      event.key.toLowerCase()
    ] = true;
  }
);

window.addEventListener(
  "keyup",
  event => {

    keys[
      event.key.toLowerCase()
    ] = false;
  }
);

canvas.addEventListener(
  "mousemove",
  event => {

    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }
);

canvas.addEventListener(
  "mousedown",
  () => {

    mouse.down = true;
  }
);

window.addEventListener(
  "mouseup",
  () => {

    mouse.down = false;
  }
);

function sendInput() {

  if (
    !socket ||
    socket.readyState !== WebSocket.OPEN ||
    !myId
  ) {
    return;
  }

  const me =
    state.players.find(
      player => player.id === myId
    );

  if (!me) return;

  const centerX =
    innerWidth / 2;

  const centerY =
    innerHeight / 2;

  const angle =
    Math.atan2(
      mouse.y - centerY,
      mouse.x - centerX
    );

  socket.send(
    JSON.stringify({
      type: "input",

      input: {

        up:
          keys.w ||
          keys.arrowup ||
          joystickInput.y < -0.2,

        down:
          keys.s ||
          keys.arrowdown ||
          joystickInput.y > 0.2,

        left:
          keys.a ||
          keys.arrowleft ||
          joystickInput.x < -0.2,

        right:
          keys.d ||
          keys.arrowright ||
          joystickInput.x > 0.2,

        fire:
          mouse.down ||
          mobileFire,

        angle
      }
    })
  );
}

setInterval(
  sendInput,
  33
);

function worldToScreen(x, y) {

  return {
    x:
      x -
      camera.x +
      innerWidth / 2,

    y:
      y -
      camera.y +
      innerHeight / 2
  };
}

function drawTank(
  tank,
  mine
) {

  const position =
    worldToScreen(
      tank.x,
      tank.y
    );

  ctx.save();

  ctx.translate(
    position.x,
    position.y
  );

  ctx.rotate(
    tank.angle
  );

  // Gun
  ctx.fillStyle =
    mine ? "#65e8ff" : "#ff9d68";

  ctx.fillRect(
    0,
    -7,
    43,
    14
  );

  // Body
  ctx.beginPath();

  ctx.arc(
    0,
    0,
    tank.radius,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    mine ? "#36c8e4" : "#df7e51";

  ctx.fill();

  ctx.lineWidth = 3;

  ctx.strokeStyle =
    "#e7fbff";

  ctx.stroke();

  ctx.restore();

  // HP
  const hp =
    Math.max(
      0,
      tank.hp / tank.maxHp
    );

  const width = 54;

  ctx.fillStyle =
    "#121a26";

  ctx.fillRect(
    position.x - width / 2,
    position.y - tank.radius - 13,
    width,
    5
  );

  ctx.fillStyle =
    "#61e39b";

  ctx.fillRect(
    position.x - width / 2,
    position.y - tank.radius - 13,
    width * hp,
    5
  );

  // Name
  ctx.font =
    "11px Arial";

  ctx.textAlign =
    "center";

  ctx.fillStyle =
    "#dce9f5";

  ctx.fillText(
    tank.name,
    position.x,
    position.y +
      tank.radius +
      17
  );
}

function drawGrid() {

  const grid = 80;

  const startX =
    Math.floor(
      (camera.x - innerWidth / 2) /
      grid
    ) * grid;

  const startY =
    Math.floor(
      (camera.y - innerHeight / 2) /
      grid
    ) * grid;

  ctx.strokeStyle =
    "#152337";

  ctx.lineWidth = 1;

  for (
    let x = startX;
    x <
      camera.x +
      innerWidth / 2 +
      grid;
    x += grid
  ) {

    const screen =
      worldToScreen(x, 0);

    ctx.beginPath();

    ctx.moveTo(
      screen.x,
      0
    );

    ctx.lineTo(
      screen.x,
      innerHeight
    );

    ctx.stroke();
  }

  for (
    let y = startY;
    y <
      camera.y +
      innerHeight / 2 +
      grid;
    y += grid
  ) {

    const screen =
      worldToScreen(0, y);

    ctx.beginPath();

    ctx.moveTo(
      0,
      screen.y
    );

    ctx.lineTo(
      innerWidth,
      screen.y
    );

    ctx.stroke();
  }
}

function drawLeaderboard() {

  const leaderboard =
    document.getElementById(
      "leaderboard"
    );

  const players =
    [...state.players]
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(0, 5);

  leaderboard.innerHTML =
    `<div class="leaderboard">
      <b>LEADERBOARD</b><br>
      ${
        players
          .map(
            (p, index) =>
              `${index + 1}. ${
                escapeHTML(p.name)
              } — ${p.score}`
          )
          .join("<br>")
      }
    </div>`;
}

function escapeHTML(value) {

  return String(value)
    .replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
    );
}

function updateHUD() {

  const me =
    state.players.find(
      player =>
        player.id === myId
    );

  if (!me) return;

  document.getElementById(
    "level"
  ).textContent =
    `LVL ${me.level} • SCORE ${me.score}`;

  document.getElementById(
    "xp"
  ).style.width =
    (
      me.xp /
      (me.level * 100) *
      100
    ) + "%";

  document.getElementById(
    "hp"
  ).style.width =
    (
      me.hp /
      me.maxHp *
      100
    ) + "%";
}

function render() {

  ctx.clearRect(
    0,
    0,
    innerWidth,
    innerHeight
  );

  const me =
    state.players.find(
      player =>
        player.id === myId
    );

  if (me) {

    camera.x +=
      (me.x - camera.x) *
      0.18;

    camera.y +=
      (me.y - camera.y) *
      0.18;
  }

  ctx.fillStyle =
    "#0a111c";

  ctx.fillRect(
    0,
    0,
    innerWidth,
    innerHeight
  );

  drawGrid();

  // Bullets
  for (
    const bullet of state.bullets
  ) {

    const position =
      worldToScreen(
        bullet.x,
        bullet.y
      );

    ctx.beginPath();

    ctx.arc(
      position.x,
      position.y,
      bullet.radius,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      bullet.color;

    ctx.fill();
  }

  // Bots
  for (
    const bot of state.bots
  ) {

    drawTank(
      bot,
      false
    );
  }

  // Players
  for (
    const player of state.players
  ) {

    drawTank(
      player,
      player.id === myId
    );
  }

  updateHUD();
  drawLeaderboard();

  requestAnimationFrame(
    render
  );
}

let joystickPointer = null;

joystick.addEventListener(
  "pointerdown",
  event => {

    joystickPointer =
      event.pointerId;

    joystick.setPointerCapture(
      event.pointerId
    );

    moveJoystick(event);
  }
);

joystick.addEventListener(
  "pointermove",
  event => {

    if (
      event.pointerId ===
      joystickPointer
    ) {
      moveJoystick(event);
    }
  }
);

joystick.addEventListener(
  "pointerup",
  resetJoystick
);

joystick.addEventListener(
  "pointercancel",
  resetJoystick
);

function moveJoystick(event) {

  const rect =
    joystick.getBoundingClientRect();

  const centerX =
    rect.left +
    rect.width / 2;

  const centerY =
    rect.top +
    rect.height / 2;

  let dx =
    event.clientX -
    centerX;

  let dy =
    event.clientY -
    centerY;

  const max = 45;

  const length =
    Math.hypot(dx, dy);

  if (length > max) {

    dx =
      dx / length * max;

    dy =
      dy / length * max;
  }

  joystickInput.x =
    dx / max;

  joystickInput.y =
    dy / max;

  knob.style.transform =
    `translate(${dx}px, ${dy}px)`;
}

function resetJoystick() {

  joystickPointer = null;

  joystickInput.x = 0;
  joystickInput.y = 0;

  knob.style.transform =
    "";
}

fireButton.addEventListener(
  "pointerdown",
  () => {

    mobileFire = true;
  }
);

fireButton.addEventListener(
  "pointerup",
  () => {

    mobileFire = false;
  }
);

fireButton.addEventListener(
  "pointercancel",
  () => {

    mobileFire = false;
  }
);

render();
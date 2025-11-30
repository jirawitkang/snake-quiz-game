// app.js
// Step C: Round + Board + Roll Dice (Host เป็นผู้สังเกตการณ์)

import { initializeApp as firebaseInitializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  update,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ---------------- Firebase Config ของคุณ ----------------
const firebaseConfig = {
  apiKey: "AIzaSyCOT002ZBTw_roNiN_9npuGJZpuFg3TB5s",
  authDomain: "snake-quiz-cdf1c.firebaseapp.com",
  databaseURL:
    "https://snake-quiz-cdf1c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "snake-quiz-cdf1c",
  storageBucket: "snake-quiz-cdf1c.firebasestorage.app",
  messagingSenderId: "58607066678",
  appId: "1:58607066678:web:cf6f8a783171e553d80297",
  measurementId: "G-32FNRV7FH4",
};

console.log("app.js loaded (Step C)");
const app = firebaseInitializeApp(firebaseConfig);
const db = getDatabase(app);

// ---------------- DOM elements ----------------
const createRoomBtn = document.getElementById("createRoomBtn");
const hostNameInput = document.getElementById("hostNameInput");

const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const playerNameInput = document.getElementById("playerNameInput");

const lobbyEl = document.getElementById("lobby");
const roomInfoEl = document.getElementById("roomInfo");
const roleInfoEl = document.getElementById("roleInfo");
const playerListEl = document.getElementById("playerList");

const hostRoundControlsEl = document.getElementById("hostRoundControls");
const startRoundBtn = document.getElementById("startRoundBtn");

const gameAreaEl = document.getElementById("gameArea");
const roundInfoEl = document.getElementById("roundInfo");
const phaseInfoEl = document.getElementById("phaseInfo");
const boardEl = document.getElementById("board");

const rollDiceBtn = document.getElementById("rollDiceBtn");
const playerStatusEl = document.getElementById("playerStatus");

// ---------------- State ----------------
let currentRoomCode = null;
let currentRole = null; // "host" หรือ "player"
let currentPlayerId = null;

const BOARD_SIZE = 30;

// ---------------- Helpers ----------------
function createId(prefix) {
  return prefix + "_" + Math.random().toString(36).substring(2, 10);
}

function createRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function randomColor() {
  const colors = ["#e91e63", "#9c27b0", "#3f51b5", "#009688", "#ff9800", "#795548"];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ---------------- Host: Create Room ----------------
createRoomBtn.addEventListener("click", async () => {
  const hostName = hostNameInput.value.trim();
  if (!hostName) {
    alert("กรุณากรอกชื่อของ Host");
    return;
  }

  const roomCode = createRoomCode();
  const hostId = createId("host");

  currentRoomCode = roomCode;
  currentRole = "host";
  currentPlayerId = null;

  const roomRef = ref(db, `rooms/${roomCode}`);

  try {
    await set(roomRef, {
      createdAt: Date.now(),
      status: "lobby",       // (ไว้ใช้เพิ่มต่อในอนาคต)
      hostId: hostId,
      hostName: hostName,
      boardSize: BOARD_SIZE,
      currentRound: 0,
      phase: "idle",         // idle | rolling | questionCountdown | answering | result
      // players: {}
    });

    console.log("Room created:", roomCode);
    enterLobbyView();
    subscribeRoom(roomCode);
    alert(
      `สร้างห้องสำเร็จ!\nRoom Code: ${roomCode}\nแชร์รหัสนี้ให้นักเรียนใช้ Join ได้เลย`
    );
  } catch (err) {
    console.error("Error creating room:", err);
    alert("มีปัญหาในการสร้างห้อง ดู error ใน Console");
  }
});

// ---------------- Player: Join Room ----------------
joinRoomBtn.addEventListener("click", async () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  const playerName = playerNameInput.value.trim();

  if (!roomCode || !playerName) {
    alert("กรุณากรอกทั้ง Room Code และชื่อนักเรียน");
    return;
  }

  const roomRef = ref(db, `rooms/${roomCode}`);
  const snap = await get(roomRef);

  if (!snap.exists()) {
    alert("ไม่พบห้องนี้ กรุณาตรวจสอบ Room Code");
    return;
  }

  const roomData = snap.val();
  if (roomData.status !== "lobby") {
    alert("ห้องนี้ไม่อยู่ในสถานะ Lobby อาจเริ่มเกมไปแล้ว");
    return;
  }

  const playerId = createId("p");

  currentRoomCode = roomCode;
  currentRole = "player";
  currentPlayerId = playerId;

  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);

  try {
    await set(playerRef, {
      name: playerName,
      color: randomColor(),
      position: 0,
      lastRoll: null,
      hasRolled: false,
      answered: false,
      lastAnswerCorrect: null,
      joinedAt: Date.now(),
    });

    console.log("Joined room:", roomCode, "as", playerName);
    enterLobbyView();
    subscribeRoom(roomCode);
    alert(`เข้าห้องสำเร็จ! คุณอยู่ในห้อง ${roomCode}`);
  } catch (err) {
    console.error("Error joining room:", err);
    alert("มีปัญหาในการ Join ห้อง ดู error ใน Console");
  }
});

// ---------------- Lobby View ----------------
function enterLobbyView() {
  lobbyEl.style.display = "block";

  if (currentRoomCode) {
    roomInfoEl.textContent = `Room Code: ${currentRoomCode}`;
  } else {
    roomInfoEl.textContent = "";
  }

  if (currentRole === "host") {
    roleInfoEl.textContent =
      "คุณเป็น Host (ครู): จอของคุณจะใช้ดูสถานะของนักเรียนทุกคนตลอดเกม";
    hostRoundControlsEl.style.display = "block";
  } else if (currentRole === "player") {
    roleInfoEl.textContent =
      "คุณเป็นผู้เล่น: รอครูเริ่มรอบใหม่ จากนั้นกดทอยลูกเต๋าได้รอบละ 1 ครั้ง";
    hostRoundControlsEl.style.display = "none";
  } else {
    roleInfoEl.textContent = "";
    hostRoundControlsEl.style.display = "none";
  }
}

// ---------------- Subscribe Room Realtime ----------------
function subscribeRoom(roomCode) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      console.warn("Room not found anymore:", roomCode);
      return;
    }

    const roomData = snapshot.val();
    const players = roomData.players || {};
    const hostName = roomData.hostName || "(ไม่ทราบชื่อ)";

    if (currentRoomCode === roomCode) {
      roomInfoEl.textContent = `Room Code: ${roomCode} | Host: ${hostName}`;
    }

    renderPlayerList(players);
    updateGameView(roomData);
  });
}

// ---------------- Render Player List ----------------
function renderPlayerList(playersObj) {
  playerListEl.innerHTML = "";

  const entries = Object.entries(playersObj);

  entries.sort((a, b) => {
    const aJoined = a[1].joinedAt || 0;
    const bJoined = b[1].joinedAt || 0;
    return aJoined - bJoined;
  });

  for (const [pid, player] of entries) {
    const li = document.createElement("li");

    const statusText =
      player.answered === false
        ? "ยังไม่ตอบ"
        : player.lastAnswerCorrect === true
        ? "ตอบถูก"
        : player.lastAnswerCorrect === false
        ? "ตอบผิด"
        : "ยังไม่ตอบ";

    li.innerHTML = `
      <span class="player-name">${player.name || pid}</span>
      <span class="player-meta">
        ช่องปัจจุบัน: <strong>${player.position ?? 0}</strong> |
        ทอยล่าสุด: <strong>${player.lastRoll ?? "-"}</strong> |
        สถานะคำถาม: <strong>${statusText}</strong>
      </span>
    `;

    playerListEl.appendChild(li);
  }

  if (entries.length === 0) {
    const li = document.createElement("li");
    li.textContent = "ยังไม่มีผู้เล่นเข้าห้อง";
    playerListEl.appendChild(li);
  }
}

// ---------------- Host: Start New Round ----------------
startRoundBtn.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;

  const roomData = snap.val();
  const players = roomData.players || {};
  const currentRound = roomData.currentRound || 0;

  const updates = {};
  updates[`rooms/${currentRoomCode}/currentRound`] = currentRound + 1;
  updates[`rooms/${currentRoomCode}/phase`] = "rolling";

  for (const pid of Object.keys(players)) {
    updates[`rooms/${currentRoomCode}/players/${pid}/lastRoll`] = null;
    updates[`rooms/${currentRoomCode}/players/${pid}/hasRolled`] = false;
    // answered / lastAnswerCorrect จะใช้ใน Step D
  }

  await update(ref(db), updates);
});

// ---------------- Player: Roll Dice ----------------
rollDiceBtn.addEventListener("click", async () => {
  if (currentRole !== "player" || !currentRoomCode || !currentPlayerId) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;

  const roomData = snap.val();
  if (roomData.phase !== "rolling") {
    alert("ตอนนี้ยังไม่ใช่ช่วงทอยลูกเต๋า (รอครูเริ่มรอบ)");
    return;
  }

  const players = roomData.players || {};
  const me = players[currentPlayerId];
  if (!me) {
    alert("ไม่พบข้อมูลผู้เล่นของคุณในห้อง");
    return;
  }

  if (me.hasRolled) {
    alert("คุณทอยลูกเต๋าในรอบนี้ไปแล้ว");
    return;
  }

  const roll = Math.floor(Math.random() * 6) + 1;
  let newPos = (me.position || 0) + roll;

  // TODO: Step ถัดไปสามารถเพิ่ม งู/บันไดได้
  if (newPos < 0) newPos = 0;
  if (newPos > BOARD_SIZE) newPos = BOARD_SIZE;

  const updates = {};
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/lastRoll`] = roll;
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/position`] = newPos;
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/hasRolled`] = true;

  await update(ref(db), updates);
});

// ---------------- Game View (Board + Status) ----------------
function updateGameView(roomData) {
  const players = roomData.players || {};
  const round = roomData.currentRound || 0;
  const phase = roomData.phase || "idle";

  if (round > 0) {
    gameAreaEl.style.display = "block";
  } else {
    gameAreaEl.style.display = "none";
  }

  if (round > 0) {
    roundInfoEl.textContent = `รอบที่: ${round}`;
  } else {
    roundInfoEl.textContent = "ยังไม่ได้เริ่มรอบ";
  }

  let phaseText = "";
  switch (phase) {
    case "rolling":
      phaseText = "กำลังทอยลูกเต๋า";
      break;
    case "questionCountdown":
      phaseText = "เตรียมคำถาม (นับถอยหลัง 3,2,1) – Step D";
      break;
    case "answering":
      phaseText = "กำลังตอบคำถาม – Step D";
      break;
    case "result":
      phaseText = "สรุปผลคำถาม – Step D";
      break;
    default:
      phaseText = "รอ Host เริ่มรอบใหม่";
  }
  phaseInfoEl.textContent = `สถานะรอบ: ${phaseText}`;

  renderBoard(players);

  // Controls & status per role
  if (currentRole === "player") {
    const me = players[currentPlayerId] || {};
    const rolled = !!me.hasRolled;
    const canRoll = phase === "rolling" && !rolled;

    rollDiceBtn.style.display = "inline-block";
    rollDiceBtn.disabled = !canRoll;

    playerStatusEl.textContent = `ตำแหน่งของคุณ: ${me.position ?? 0} | ทอยล่าสุด: ${
      me.lastRoll ?? "-"
    }`;

    if (phase === "idle" || round === 0) {
      playerStatusEl.textContent += " | รอ Host เริ่มรอบใหม่";
    } else if (phase === "rolling" && rolled) {
      playerStatusEl.textContent += " | คุณทอยในรอบนี้แล้ว รอผู้เล่นคนอื่น";
    }
  } else if (currentRole === "host") {
    rollDiceBtn.style.display = "none";
    playerStatusEl.textContent = "คุณกำลังดูสถานะของนักเรียนทั้งหมด";
  } else {
    rollDiceBtn.style.display = "none";
    playerStatusEl.textContent = "";
  }

  // Host helper: บอกว่าทอยครบกี่คนแล้ว
  if (currentRole === "host" && phase === "rolling") {
    const totalPlayers = Object.keys(players).length;
    const rolledCount = Object.values(players).filter((p) => p.hasRolled).length;

    if (totalPlayers > 0 && rolledCount === totalPlayers) {
      phaseInfoEl.textContent +=
        " | ทุกคนทอยเสร็จแล้ว (พร้อมไปขั้นคำถามใน Step D)";
    } else {
      phaseInfoEl.textContent += ` | ทอยแล้ว ${rolledCount}/${totalPlayers} คน`;
    }
  }
}

// ---------------- Board Rendering ----------------
function renderBoard(players) {
  if (!boardEl.dataset.initialized) {
    boardEl.innerHTML = "";
    for (let i = 1; i <= BOARD_SIZE; i++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      const idxSpan = document.createElement("span");
      idxSpan.classList.add("cell-index");
      idxSpan.textContent = i;
      cell.appendChild(idxSpan);
      boardEl.appendChild(cell);
    }
    boardEl.dataset.initialized = "1";
  }

  const cells = boardEl.querySelectorAll(".cell");
  cells.forEach((cell) => {
    const tokens = cell.querySelectorAll(".token");
    tokens.forEach((t) => t.remove());
  });

  for (const [pid, p] of Object.entries(players)) {
    let pos = p.position || 0;
    if (pos < 1) continue;
    if (pos > BOARD_SIZE) pos = BOARD_SIZE;

    const cell = cells[pos - 1];
    if (!cell) continue;

    const token = document.createElement("div");
    token.classList.add("token");
    token.textContent = p.name || pid;
    token.style.backgroundColor = p.color || "#1976d2";
    cell.appendChild(token);
  }
}

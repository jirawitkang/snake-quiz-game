// main.js
// Starter logic สำหรับเกม snake-quiz แบบหลายผู้เล่นด้วย Firebase Realtime DB

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  serverTimestamp,
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

// 1) Init Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 2) DOM elements
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const hostNameInput = document.getElementById("hostNameInput");
const roomCodeInput = document.getElementById("roomCodeInput");
const playerNameInput = document.getElementById("playerNameInput");

const lobbyEl = document.getElementById("lobby");
const roomInfoEl = document.getElementById("roomInfo");
const playerListEl = document.getElementById("playerList");
const startGameBtn = document.getElementById("startGameBtn");
const hostControlsEl = document.getElementById("hostControls");

const gameAreaEl = document.getElementById("gameArea");
const statusTextEl = document.getElementById("statusText");
const diceResultEl = document.getElementById("diceResult");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const boardEl = document.getElementById("board");

// 3) State
let currentRoomCode = null;
let currentPlayerId = null;
let currentPlayerName = null;
let isHost = false;

const BOARD_SIZE = 30;
const SNAKES = {
  17: 7,
  24: 15,
};
const LADDERS = {
  3: 11,
  5: 9,
};

function randomColor() {
  const colors = [
    "#e91e63",
    "#9c27b0",
    "#3f51b5",
    "#009688",
    "#ff9800",
    "#795548",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function createPlayerId() {
  return "p_" + Math.random().toString(36).substring(2, 10);
}

function createRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ------------ Create / Join Room ------------

createRoomBtn.addEventListener("click", async () => {
  const name = hostNameInput.value.trim();
  if (!name) {
    alert("กรุณากรอกชื่อเล่นของ Host");
    return;
  }

  isHost = true;
  currentPlayerName = name;
  currentPlayerId = createPlayerId();
  const roomCode = createRoomCode();
  currentRoomCode = roomCode;

  const roomRef = ref(db, `rooms/${roomCode}`);
  await set(roomRef, {
    createdAt: Date.now(),
    status: "lobby",
    hostId: currentPlayerId,
    boardSize: BOARD_SIZE,
    snakes: SNAKES,
    ladders: LADDERS,
  });

  const playerRef = ref(db, `rooms/${roomCode}/players/${currentPlayerId}`);
  await set(playerRef, {
    name: currentPlayerName,
    position: 0,
    color: randomColor(),
    isHost: true,
    joinedAt: serverTimestamp(),
  });

  enterLobby();
});

joinRoomBtn.addEventListener("click", async () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  const name = playerNameInput.value.trim();

  if (!roomCode || !name) {
    alert("กรุณากรอก Room Code และชื่อเล่น");
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
    alert("ห้องนี้เริ่มเกมไปแล้ว หรือไม่อยู่ในสถานะ Lobby");
    return;
  }

  isHost = false;
  currentPlayerName = name;
  currentPlayerId = createPlayerId();
  currentRoomCode = roomCode;

  const playerRef = ref(db, `rooms/${roomCode}/players/${currentPlayerId}`);
  await set(playerRef, {
    name: currentPlayerName,
    position: 0,
    color: randomColor(),
    isHost: false,
    joinedAt: serverTimestamp(),
  });

  enterLobby();
});

// ------------ Lobby / Game UI ------------

function enterLobby() {
  lobbyEl.style.display = "block";
  gameAreaEl.style.display = "none";

  roomInfoEl.textContent = `Room Code: ${currentRoomCode}`;
  hostControlsEl.style.display = isHost ? "block" : "none";

  subscribeRoom();
}

function enterGame() {
  lobbyEl.style.display = "none";
  gameAreaEl.style.display = "block";
  renderBoard();
  subscribeRoom();
}

function subscribeRoom() {
  if (!currentRoomCode) return;
  const roomRef = ref(db, `rooms/${currentRoomCode}`);

  onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      alert("ห้องนี้ถูกลบแล้ว");
      location.reload();
      return;
    }

    const roomData = snapshot.val();
    const players = roomData.players || {};
    const status = roomData.status || "lobby";

    updatePlayerList(players, roomData.hostId);

    if (status === "playing") {
      gameAreaEl.style.display = "block";
      lobbyEl.style.display = "none";
    }

    if (gameAreaEl.style.display === "block") {
      updateGameUI(roomData);
    }
  });
}

function updatePlayerList(playersObj, hostId) {
  playerListEl.innerHTML = "";
  const entries = Object.entries(playersObj);

  entries.sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

  for (const [pid, player] of entries) {
    const li = document.createElement("li");
    li.textContent = player.name || pid;

    const badge = document.createElement("span");
    badge.classList.add("badge");
    if (pid === hostId) {
      badge.textContent = "Host";
      badge.classList.add("host");
    } else {
      badge.textContent = "Player";
    }
    li.appendChild(badge);
    playerListEl.appendChild(li);
  }
}

// ------------ Host: Start Game ------------

startGameBtn.addEventListener("click", async () => {
  if (!isHost || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  await update(roomRef, {
    status: "playing",
    turn: 0,
    lastDice: null,
  });

  enterGame();
});

// ------------ Game Logic ------------

function renderBoard() {
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
}

function updateGameUI(roomData) {
  const players = roomData.players || {};
  const turn = roomData.turn || 0;
  const lastDice = roomData.lastDice || null;

  statusTextEl.textContent = `เทิร์นที่: ${turn}`;
  if (lastDice && lastDice.round === turn) {
    const diceInfo = Object.entries(lastDice.dice)
      .map(([pid, val]) => `${players[pid]?.name || pid}: ${val}`)
      .join(" | ");
    diceResultEl.textContent = `ผลลูกเต๋ารอบนี้: ${diceInfo}`;
  } else {
    diceResultEl.textContent = "";
  }

  const cells = boardEl.querySelectorAll(".cell");
  cells.forEach((cell) => {
    const tokens = cell.querySelectorAll(".token");
    tokens.forEach((t) => t.remove());
  });

  for (const [pid, player] of Object.entries(players)) {
    let pos = player.position || 0;
    if (pos < 1) pos = 1;
    if (pos > BOARD_SIZE) pos = BOARD_SIZE;

    const cellIndex = pos - 1;
    const cell = cells[cellIndex];
    if (!cell) continue;

    const token = document.createElement("div");
    token.classList.add("token");
    token.textContent = player.name || pid;
    token.style.background = player.color || "#000";

    cell.appendChild(token);
  }

  nextRoundBtn.disabled = !isHost;
}

// Host: ทอยเต๋ารอบใหม่
nextRoundBtn.addEventListener("click", async () => {
  if (!isHost || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;
  const roomData = snap.val();
  const players = roomData.players || {};
  const turn = (roomData.turn || 0) + 1;

  const diceResults = {};
  const updatedPositions = {};

  for (const [pid, player] of Object.entries(players)) {
    const roll = Math.floor(Math.random() * 6) + 1;
    diceResults[pid] = roll;

    let newPos = (player.position || 0) + roll;

    if (LADDERS[newPos]) {
      newPos = LADDERS[newPos];
    } else if (SNAKES[newPos]) {
      newPos = SNAKES[newPos];
    }

    if (newPos > BOARD_SIZE) {
      newPos = BOARD_SIZE;
    }

    updatedPositions[pid] = newPos;
  }

  const updates = {};
  for (const [pid, newPos] of Object.entries(updatedPositions)) {
    updates[`rooms/${currentRoomCode}/players/${pid}/position`] = newPos;
  }
  updates[`rooms/${currentRoomCode}/turn`] = turn;
  updates[`rooms/${currentRoomCode}/lastDice`] = {
    round: turn,
    dice: diceResults,
  };

  const winnerId = Object.entries(updatedPositions).find(
    ([_, pos]) => pos >= BOARD_SIZE
  )?.[0];

  if (winnerId) {
    updates[`rooms/${currentRoomCode}/status`] = "finished";
    updates[`rooms/${currentRoomCode}/winnerId`] = winnerId;
  }

  await update(ref(db), updates);

  if (winnerId) {
    alert(`ผู้ชนะคือ: ${players[winnerId]?.name || winnerId}`);
  }
});

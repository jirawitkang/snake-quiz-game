// main.js
// Starter logic สำหรับเกม snake-quiz แบบหลายผู้เล่นด้วย Firebase Realtime DB

import { initializeApp as firebaseInitializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
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
console.log("main.js loaded"); // เช็คว่าไฟล์นี้รันจริง
const app = firebaseInitializeApp(firebaseConfig);
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
    name: current

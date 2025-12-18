// app.js
// Stable Multiplayer: transactions for dice/answer/host actions

import { initializeApp as firebaseInitializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  update,
  remove,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ---------------- Firebase Config ----------------
const firebaseConfig = {
  apiKey: "AIzaSyCOT002ZBTw_roNiN_9npuGJZpuFg3TB5s",
  authDomain: "snake-quiz-cdf1c.firebaseapp.com",
  databaseURL: "https://snake-quiz-cdf1c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "snake-quiz-cdf1c",
  storageBucket: "snake-quiz-cdf1c.firebasestorage.app",
  messagingSenderId: "58607066678",
  appId: "1:58607066678:web:cf6f8a783171e553d80297",
  measurementId: "G-32FNRV7FH4",
};

console.log("app.js loaded (Stable Transactions)");
const app = firebaseInitializeApp(firebaseConfig);
const db = getDatabase(app);

// ---------------- Constants ----------------
const BOARD_SIZE = 30;
const STORAGE_KEY = "SQ_SESSION_V1";
const STORAGE = sessionStorage; // ✅ แยกต่อแท็บ (แนะนำที่สุดสำหรับ Host/Player ในเครื่องเดียวกัน)

// ---------------- Question Sets ----------------
const QUESTION_SETS = {
  general: [
    { text: "2 + 2 เท่ากับเท่าใด?", choices: { A: "3", B: "4", C: "5", D: "22" }, correctOption: "B", timeLimit: 10 },
    { text: "เมืองหลวงของประเทศไทยคือเมืองใด?", choices: { A: "เชียงใหม่", B: "ขอนแก่น", C: "กรุงเทพมหานคร", D: "ภูเก็ต" }, correctOption: "C", timeLimit: 10 },
  ],
  setA: [
    { text: "HTML ย่อมาจากข้อใด?", choices: { A: "HyperText Markup Language", B: "HighText Machine Language", C: "Hyperlinks and Text Markup Language", D: "Home Tool Markup Language" }, correctOption: "A", timeLimit: 10 },
    { text: "HTTP status code 404 หมายถึง?", choices: { A: "OK", B: "Not Found", C: "Forbidden", D: "Bad Request" }, correctOption: "B", timeLimit: 10 },
  ],
  setB: [
    { text: "ข้อใดต่อไปนี้คือหน่วยของความถี่?", choices: { A: "นิวตัน", B: "วัตต์", C: "เฮิรตซ์", D: "จูล" }, correctOption: "C", timeLimit: 10 },
    { text: "H2O คือสารใด?", choices: { A: "คาร์บอนไดออกไซด์", B: "น้ำ", C: "ไฮโดรเจน", D: "ออกซิเจน" }, correctOption: "B", timeLimit: 10 },
  ],
};

function getQuestionSetById(id) {
  return QUESTION_SETS[id] || QUESTION_SETS.general || [];
}
function getQuestionSetLengthForRoom(roomData) {
  const setId = roomData.gameSettings?.questionSetId || "general";
  const set = getQuestionSetById(setId);
  return set.length || 1;
}
function getQuestionFromRoom(roomData, index) {
  const setId = roomData.gameSettings?.questionSetId || "general";
  const set = getQuestionSetById(setId);
  if (!set.length) return null;
  const i = (index ?? 0) % set.length;
  return set[i];
}

// ---------------- DOM ----------------
const createRoomBtn = document.getElementById("createRoomBtn");
const hostNameInput = document.getElementById("hostNameInput");
const hostGameOptionsEl = document.getElementById("hostGameOptions");
const questionSetSelect = document.getElementById("questionSetSelect");
const maxRoundsInput = document.getElementById("maxRoundsInput");
const maxWinnersInput = document.getElementById("maxWinnersInput");
const rewardCorrectInput = document.getElementById("rewardCorrectInput");
const penaltyWrongInput = document.getElementById("penaltyWrongInput");
const confirmCreateRoomBtn = document.getElementById("confirmCreateRoomBtn");

const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const playerNameInput = document.getElementById("playerNameInput");

const lobbyEl = document.getElementById("lobby");
const roomInfoEl = document.getElementById("roomInfo");
const roleInfoEl = document.getElementById("roleInfo");
const playerListEl = document.getElementById("playerList");
const entrySectionEl = document.getElementById("entrySection");

const lobbyBadgesEl = document.getElementById("lobbyBadges");
const cancelRoomBtn = document.getElementById("cancelRoomBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");

const startGameBtn = document.getElementById("startGameBtn");
if (!startGameBtn) console.warn("[UI] startGameBtn not found");
const hostGameControlsEl = document.getElementById("hostGameControls");
const playerGameControlsEl = document.getElementById("playerGameControls");

const hostRoundControlsEl = document.getElementById("hostRoundControls");
const startRoundBtn = document.getElementById("startRoundBtn");
const startQuestionBtn = document.getElementById("startQuestionBtn");
const revealAnswerBtn = document.getElementById("revealAnswerBtn");

const gameAreaEl = document.getElementById("gameArea");
const roundInfoEl = document.getElementById("roundInfo");
const phaseInfoEl = document.getElementById("phaseInfo");
const boardEl = document.getElementById("board");

const rollDiceBtn = document.getElementById("rollDiceBtn");
const playerStatusEl = document.getElementById("playerStatus");

const diceOverlayEl = document.getElementById("diceOverlay");
const dice3dEl = document.getElementById("dice3d");
const diceHintEl = document.getElementById("diceHint");
const closeDiceOverlayBtn = document.getElementById("closeDiceOverlayBtn");

let diceIsRolling = false;
let diceCommitDone = false;

function showDiceOverlayRolling(){
  if (!diceOverlayEl) return;
  diceIsRolling = true;
  diceCommitDone = false;

  diceOverlayEl.style.display = "flex";

  if (closeDiceOverlayBtn){
    closeDiceOverlayBtn.style.display = "none";   // ✅ ห้ามเห็นระหว่างกลิ้ง
    closeDiceOverlayBtn.disabled = true;          // ✅ กันเผลอ
  }
}

function showDiceOverlayWaitingCommit(){
  diceIsRolling = false; // ✅ หมุนจบแล้ว

  if (closeDiceOverlayBtn){
    closeDiceOverlayBtn.style.display = "inline-flex"; // ✅ โชว์ได้ แต่ยังห้ามปิด
    closeDiceOverlayBtn.disabled = true;
  }
}

function enableDiceOverlayClose(){
  diceCommitDone = true;
  if (closeDiceOverlayBtn){
    closeDiceOverlayBtn.disabled = false; // ✅ ปิดได้หลัง commit เท่านั้น
  }
}

function hideDiceOverlay(){
  if (diceOverlayEl) diceOverlayEl.style.display = "none";
  if (closeDiceOverlayBtn) closeDiceOverlayBtn.style.display = "none";
  diceIsRolling = false;
  diceCommitDone = false;
}

closeDiceOverlayBtn?.addEventListener("click", () => {
  // ✅ กันกดตอนยังหมุน หรือยังไม่ commit
  if (diceIsRolling) return;
  if (!diceCommitDone) return;

  hideDiceOverlay();
  document.getElementById("gameArea")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

const questionAreaEl = document.getElementById("questionArea");
const countdownDisplayEl = document.getElementById("countdownDisplay");
const questionTextEl = document.getElementById("questionText");
const choicesContainerEl = document.getElementById("choicesContainer");

const endGameAreaEl = document.getElementById("endGameArea");
const endGameSummaryEl = document.getElementById("endGameSummary");

// ---------------- State ----------------
let currentRoomCode = null;
let currentRole = null; // "host" | "player"
let currentPlayerId = null;

let roomUnsub = null;

let timerInterval = null;
let timerPhase = null;
let timerRound = 0;

let countdownAutoTimeout = null;

let rollPending = false; // ✅ กันกดทอยซ้ำระหว่างรอ DB sync
let answerPending = false;

// ---------------- Utils ----------------
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function setEntryVisible(visible) {
  if (!entrySectionEl) return;
  entrySectionEl.style.display = visible ? "" : "none";
}
function clampPos(pos) {
  const p = Number(pos ?? 1);
  if (!Number.isFinite(p)) return 1;
  return Math.max(1, Math.min(BOARD_SIZE, Math.trunc(p)));
}
function createId(prefix) {
  return prefix + "_" + Math.random().toString(36).substring(2, 10);
}
function createRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}
function renderLobbyBadges(roomData) {
  if (!lobbyBadgesEl) return;

  const gs = roomData.gameSettings || {};
  const hostName = roomData.hostName || "-";
  const code = currentRoomCode || "-";

  const questionSetId = gs.questionSetId || "general";
  const maxRounds = gs.maxRounds ?? 10;
  const maxWinners = gs.maxWinners ?? 5;

  const rewardCorrect = Number.isFinite(gs.rewardCorrect) ? gs.rewardCorrect : 1;
  const penaltyWrong = Number.isFinite(gs.penaltyWrong) ? gs.penaltyWrong : -1;

  const rewardText = rewardCorrect >= 0 ? `+${rewardCorrect}` : `${rewardCorrect}`;
  const penaltyText = penaltyWrong >= 0 ? `+${penaltyWrong}` : `${penaltyWrong}`;

  const items = [
    `Room: ${code}`,
    `Host: ${hostName}`,
    `ชุดคำถาม: ${questionSetId}`,
    `รอบสูงสุด: ${maxRounds}`,
    `เข้าเส้นชัย: ${maxWinners} คน`,
    `ถูก: ${rewardText}`,
    `ผิด/ไม่ทัน: ${penaltyText}`,
  ];

  lobbyBadgesEl.innerHTML = "";
  for (const t of items) {
    const el = document.createElement("div");
    el.className = "lobby-badge";
    el.textContent = t;
    lobbyBadgesEl.appendChild(el);
  }
}
function randomColor() {
  const colors = ["#e91e63", "#9c27b0", "#3f51b5", "#009688", "#ff9800", "#795548"];
  return colors[Math.floor(Math.random() * colors.length)];
}
function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (countdownAutoTimeout) {
    clearTimeout(countdownAutoTimeout);
    countdownAutoTimeout = null;
  }
  timerPhase = null;
  timerRound = 0;
}

function getPathCells(from, to) {
  const cells = [];
  if (from === to) return cells;
  const step = from < to ? 1 : -1;
  let pos = from + step;
  while (true) {
    if (pos >= 1 && pos <= BOARD_SIZE) cells.push(pos);
    if (pos === to) break;
    pos += step;
  }
  return cells;
}
function saveSession() {
  const payload = { room: currentRoomCode, role: currentRole, pid: currentPlayerId };
  STORAGE.setItem(STORAGE_KEY, JSON.stringify(payload));
}
function clearSession() {
  STORAGE.removeItem(STORAGE_KEY);
}
function setHeaderPills() {
  const uiRoomPill = document.getElementById("uiRoomPill");
  const uiRolePill = document.getElementById("uiRolePill");
  if (uiRoomPill) uiRoomPill.textContent = `Room: ${currentRoomCode || "-"}`;
  if (uiRolePill) uiRolePill.textContent = `Role: ${currentRole || "-"}`;
}
function lockEntryUIForRole(role) {
  const lockHost = role === "host";
  const lockPlayer = role === "player";

  // Host block
  hostNameInput.disabled = lockHost;
  createRoomBtn.disabled = lockHost;
  confirmCreateRoomBtn.disabled = lockHost;

  // Player block
  roomCodeInput.disabled = lockPlayer;
  playerNameInput.disabled = lockPlayer;
  joinRoomBtn.disabled = lockPlayer;
}

// ---------------- Lobby View ----------------
function enterLobbyView() {
  if (lobbyEl) lobbyEl.style.display = "block";

  setEntryVisible(false); // ✅ ซ่อนหน้าแรก (LIBRARY RESOURCES + การ์ด Host/Player)

  if (roomInfoEl) {
    roomInfoEl.textContent = currentRoomCode ? `Room Code: ${currentRoomCode}` : "";
  }

  if (currentRole === "host") {
  if (hostRoundControlsEl) {
    hostRoundControlsEl.style.display = "flex";
    hostRoundControlsEl.style.visibility = "visible";
    hostRoundControlsEl.style.pointerEvents = "auto";
  }
} else if (currentRole === "player") {
  if (hostRoundControlsEl) {
    hostRoundControlsEl.style.display = "flex";       // จองพื้นที่ไว้ให้เท่ากัน
    hostRoundControlsEl.style.visibility = "hidden";  // แต่ไม่ให้เห็น
    hostRoundControlsEl.style.pointerEvents = "none";
  }
} else {
    if (roleInfoEl) roleInfoEl.textContent = "";
    if (hostRoundControlsEl) hostRoundControlsEl.style.display = "none";
  }

  // ✅ ปุ่มขวาสุดบนแถบ LOBBY
  if (cancelRoomBtn) cancelRoomBtn.style.display = (currentRole === "host") ? "inline-block" : "none";
  if (leaveRoomBtn)  leaveRoomBtn.style.display  = (currentRole === "player") ? "inline-block" : "none";

  const cancelBtn = document.getElementById("cancelRoomBtn");
  const leaveBtn  = document.getElementById("leaveRoomBtn");
  
  if (currentRole === "host") {
    if (cancelBtn) cancelBtn.style.display = "inline-flex";
    if (leaveBtn)  leaveBtn.style.display = "none";
  } else if (currentRole === "player") {
    if (cancelBtn) cancelBtn.style.display = "none";
    if (leaveBtn)  leaveBtn.style.display = "inline-flex";
  } else {
    if (cancelBtn) cancelBtn.style.display = "none";
    if (leaveBtn)  leaveBtn.style.display = "none";
  }

  setHeaderPills();
}

// ---------------- Subscribe Room ----------------
function subscribeRoom(roomCode) {
  if (roomUnsub) { try { roomUnsub(); } catch {} roomUnsub = null; } // ✅ กันซ้อน

  const roomRef = ref(db, `rooms/${roomCode}`);
  roomUnsub = onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      resetToHome("ห้องนี้ถูกยกเลิก/ปิดแล้ว");
      return;
    }

    const roomData = snapshot.val();
    const players = roomData.players || {};
    const hostName = roomData.hostName || "(ไม่ทราบชื่อ)";
    const gs = roomData.gameSettings || {};

    // ✅ เพิ่มตรงนี้: อัปเดต badge บนแถบ LOBBY ทุกครั้งที่ room เปลี่ยน
    renderLobbyBadges(roomData);

    // (จะเก็บไว้หรือจะลบทิ้งก็ได้ เพราะใน index.html เราซ่อน roomInfoEl แล้ว)
    if (currentRoomCode === roomCode && roomInfoEl) {
      const questionSetId = gs.questionSetId || "general";
      const maxRounds = gs.maxRounds ?? 10;
      const maxWinners = gs.maxWinners ?? 5;
      const rewardCorrect = Number.isFinite(gs.rewardCorrect) ? gs.rewardCorrect : 1;
      const penaltyWrong = Number.isFinite(gs.penaltyWrong) ? gs.penaltyWrong : -1;

      const rewardText = rewardCorrect >= 0 ? `+${rewardCorrect}` : `${rewardCorrect}`;
      const penaltyText = penaltyWrong >= 0 ? `+${penaltyWrong}` : `${penaltyWrong}`;

      roomInfoEl.textContent =
        `Room Code: ${roomCode} | Host: ${hostName} ` +
        `| ชุดคำถาม: ${questionSetId} ` +
        `| รอบสูงสุด: ${maxRounds} ` +
        `| ผู้เข้าเส้นชัย: ${maxWinners} คน ` +
        `| ตอบถูก: ${rewardText} ช่อง ` +
        `| ตอบผิด/ไม่ทัน: ${penaltyText} ช่อง`;
    }

    try { renderPlayerList(roomData, players); }
    catch (e) { console.error("renderPlayerList failed:", e); }
    
    try { updateGameView(roomData, players); }
    catch (e) { console.error("updateGameView failed:", e); }
    
    try { updateStartGameButton(roomData, players); }
    catch (e) { console.error("updateStartGameButton failed:", e); }
  });
}

function updateStartGameButton(roomData, players) {
  if (!startGameBtn) return;

  const totalPlayers = Object.keys(players || {}).length;

  // โชว์เฉพาะ Host และเฉพาะตอนอยู่ lobby และมีผู้เล่นอย่างน้อย 1 คน
  const shouldShow =
    currentRole === "host" &&
    currentRoomCode &&
    roomData?.status === "lobby" &&
    totalPlayers > 0;

  startGameBtn.style.display = shouldShow ? "inline-flex" : "none";
  startGameBtn.disabled = !shouldShow;
}

// ---------------- Restore Session ----------------
(async function attemptRestoreSession() {
  try {
    const raw = STORAGE.getItem(STORAGE_KEY);
    if (!raw) return;

    const s = JSON.parse(raw);
    if (!s?.room || !s?.role) return;

    const roomCode = String(s.room).toUpperCase();
    const snap = await get(ref(db, `rooms/${roomCode}`));
    if (!snap.exists()) return;

    const roomData = snap.val();

    // host restore
    if (s.role === "host") {
      currentRoomCode = roomCode;
      currentRole = "host";
      currentPlayerId = null;
      enterLobbyView();
      subscribeRoom(currentRoomCode);
      lockEntryUIForRole("host");
      return;
    }

    // player restore
    if (s.role === "player") {
      const pid = s.pid;
      if (pid && roomData.players?.[pid]) {
        currentRoomCode = roomCode;
        currentRole = "player";
        currentPlayerId = pid;
        enterLobbyView();
        subscribeRoom(currentRoomCode);
        lockEntryUIForRole("player");
        return;
      }
    }
  } catch (e) {
    console.warn("restore session failed:", e);
  }
})();

// ---------------- Host: Step 1 – เปิด panel ตั้งค่าเกม ----------------
createRoomBtn.addEventListener("click", () => {
  const hostName = (hostNameInput?.value || "").trim();

  if (!hostName) {
    alert("กรุณากรอกชื่อของ Host ก่อน");
    return;
  }

  // lock input + button
  hostNameInput.disabled = true;
  createRoomBtn.disabled = true;

  // ✅ บังคับแสดงแบบชนะทุก CSS (รวม !important)
  if (!hostGameOptionsEl) {
    alert("ไม่พบแผงตั้งค่าเกม (#hostGameOptions) กรุณาตรวจสอบ id ใน index.html");
    // unlock เพื่อให้แก้แล้วกดใหม่ได้
    hostNameInput.disabled = false;
    createRoomBtn.disabled = false;
    return;
  }

  hostGameOptionsEl.style.setProperty("display", "block", "important");
  hostGameOptionsEl.scrollIntoView({ behavior: "smooth", block: "start" });

  // debug แบบไม่รบกวน (เผื่อเช็ค)
  console.log("[UI] open hostGameOptions");
});

// ---------------- Host Step 2: create room ----------------
confirmCreateRoomBtn.addEventListener("click", async () => {
  const hostName = (hostNameInput.value || "").trim();
  if (!hostName) {
    alert("กรุณากรอกชื่อของ Host");
    return;
  }

  const questionSetId = questionSetSelect.value || "general";
  const maxRounds = Math.max(1, parseInt(maxRoundsInput.value, 10) || 10);
  const maxWinners = Math.max(1, parseInt(maxWinnersInput.value, 10) || 5);
  const rewardCorrect = parseInt(rewardCorrectInput.value, 10);
  const penaltyWrong = parseInt(penaltyWrongInput.value, 10);

  const roomRefBase = (code) => ref(db, `rooms/${code}`);

  // collision-safe (few tries)
  let roomCode = null;
  for (let i = 0; i < 6; i++) {
    const c = createRoomCode();
    const s = await get(roomRefBase(c));
    if (!s.exists()) { roomCode = c; break; }
  }
  if (!roomCode) {
    alert("สร้างห้องไม่สำเร็จ (รหัสชนกันหลายครั้ง) ลองใหม่อีกครั้ง");
    hostNameInput.disabled = false;
    createRoomBtn.disabled = false;
    return;
  }

  const hostId = createId("host");

  currentRoomCode = roomCode;
  currentRole = "host";
  currentPlayerId = null;

  try {
    await set(roomRefBase(roomCode), {
      createdAt: Date.now(),
      status: "lobby",      // lobby | playing | finished
      hostId,
      hostName,
      boardSize: BOARD_SIZE,
      currentRound: 0,
      phase: "idle",        // idle | rolling | questionCountdown | answering | result | ended
      questionIndex: null,
      questionCountdownStartAt: null,
      questionCountdownSeconds: 3,
      answerStartAt: null,
      answerTimeSeconds: null,
      answerDeadlineExpired: false,
      winners: [],
      history: {},
      gameSettings: {
        questionSetId,
        maxRounds,
        maxWinners,
        rewardCorrect: Number.isFinite(rewardCorrect) ? rewardCorrect : 1,
        penaltyWrong: Number.isFinite(penaltyWrong) ? penaltyWrong : -1,
      },
    });

    if (hostGameOptionsEl) hostGameOptionsEl.style.display = "none";
    enterLobbyView();
    subscribeRoom(roomCode);
    lockEntryUIForRole("host");
    saveSession();

    alert(`สร้างห้องสำเร็จ!\nRoom Code: ${roomCode}\nแชร์รหัสนี้ให้นักเรียนใช้ Join ได้เลย`);
  } catch (err) {
    console.error("Error creating room:", err);
    alert("มีปัญหาในการสร้างห้อง ดู error ใน Console");
    hostNameInput.disabled = false;
    createRoomBtn.disabled = false;
  }
});

// ---------------- Leave Room ----------------
leaveRoomBtn?.addEventListener("click", async () => {
  if (currentRoomCode && currentPlayerId) {
    try {
      await remove(ref(db, `rooms/${currentRoomCode}/players/${currentPlayerId}`));
    } catch (e) {
      console.warn("remove player failed:", e);
    }
  }
  resetToHome("ออกจากห้องเรียบร้อย");
});

// ---------------- ยกเลิกห้อง (Host)” ลบ room ใน DB ----------------
cancelRoomBtn?.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const ok = confirm("ต้องการยกเลิกห้องนี้ใช่ไหม? ผู้เล่นทุกคนจะถูกเตะออก");
  if (!ok) return;

  try {
    await set(ref(db, `rooms/${currentRoomCode}`), null); // ✅ ลบทั้งห้อง
  } catch (e) {
    console.error(e);
    alert("ยกเลิกห้องไม่สำเร็จ (ดู Console)");
    return;
  }

  resetToHome("ยกเลิกห้องเรียบร้อย");
});


// ---------------- Player: Join Room ----------------
joinRoomBtn.addEventListener("click", async () => {
  const roomCode = (roomCodeInput?.value || "").trim().toUpperCase();
  const playerNameRaw = (playerNameInput?.value || "").trim();

  if (!roomCode || !playerNameRaw) {
    alert("กรุณากรอกทั้ง Room Code และชื่อนักเรียน");
    return;
  }

  const playerName = playerNameRaw;
  const playerNameKey = playerNameRaw.toLowerCase();

  const roomRef = ref(db, `rooms/${roomCode}`);
  const snap = await get(roomRef);

  if (!snap.exists()) {
    alert("ไม่พบห้องนี้ กรุณาตรวจสอบ Room Code");
    return;
  }

  const roomData = snap.val();

  // ✅ กัน join กลางเกม
  if (roomData.status !== "lobby" || (roomData.currentRound || 0) > 0) {
    alert("ห้องนี้เริ่มเกมแล้ว ไม่สามารถ Join เพิ่มได้");
    return;
  }

  // ตรวจชื่อซ้ำกับ host
  const hostNameKey = String(roomData.hostName || "").trim().toLowerCase();
  if (hostNameKey && hostNameKey === playerNameKey) {
    alert("ชื่อนี้ซ้ำกับชื่อ Host กรุณาใช้ชื่ออื่น");
    return;
  }

  // ตรวจชื่อซ้ำกับผู้เล่น
  const players = roomData.players || {};
  for (const [, p] of Object.entries(players)) {
    const existingName = String(p.name || "").trim().toLowerCase();
    if (existingName === playerNameKey) {
      alert("มีผู้เล่นใช้ชื่อนี้ในห้องแล้ว กรุณาใช้ชื่ออื่น");
      return;
    }
  }

  const playerId = createId("p");

  currentRoomCode = roomCode;
  currentRole = "player";
  currentPlayerId = playerId;

  try {
    await set(ref(db, `rooms/${roomCode}/players/${playerId}`), {
      name: playerName,
      color: randomColor(),
      position: 1,
      lastRoll: null,
      hasRolled: false,
      answered: false,
      answer: null,
      lastAnswerCorrect: null,
      joinedAt: Date.now(),
      finished: false,
      finishedRound: null,
      finishedBy: null,
      startOfRoundPos: 1,
    });

    enterLobbyView();
    subscribeRoom(roomCode);
    lockEntryUIForRole("player");
    saveSession();

    alert(`เข้าห้องสำเร็จ! คุณอยู่ในห้อง ${roomCode}`);
  } catch (err) {
    console.error("Error joining room:", err);
    alert("มีปัญหาในการ Join ห้อง ดู error ใน Console");
  }
});

// ---------------- Render Player List ----------------
function renderPlayerList(roomData, playersObj) {
  const entries = Object.entries(playersObj || {});
  const phase = roomData.phase || "idle";
  const deadlineExpired = roomData.answerDeadlineExpired === true;

  const gs = roomData.gameSettings || {};
  const rewardCorrect = Number.isFinite(gs.rewardCorrect) ? gs.rewardCorrect : 1;
  const penaltyWrong = Number.isFinite(gs.penaltyWrong) ? gs.penaltyWrong : -1;

  const history = roomData.history || {};

  if (!playerListEl) return;
  if (entries.length === 0) {
    playerListEl.innerHTML = `<div class="muted">ยังไม่มีผู้เล่นเข้าห้อง</div>`;
    return;
  }

  // build per-player stats
  const perPlayer = {};
  for (const [pid, p] of entries) {
    perPlayer[pid] = {
      id: pid,
      name: p.name || pid,
      position: clampPos(p.position),
      lastRoll: p.lastRoll ?? null,
      hasRolled: !!p.hasRolled,
      answered: !!p.answered,
      lastAnswerCorrect: p.lastAnswerCorrect,
      finished: !!p.finished || clampPos(p.position) >= BOARD_SIZE,
      rolls: [],
      answerSymbols: [],
    };
  }

  // parse history
  const roundKeys = Object.keys(history)
    .filter((k) => k.startsWith("round_"))
    .sort((a, b) => parseInt(a.split("_")[1] || "0", 10) - parseInt(b.split("_")[1] || "0", 10));

  for (const rk of roundKeys) {
    const roundData = history[rk] || {};
    const answers = roundData.answers || {};
    for (const [pid, rec] of Object.entries(answers)) {
      if (!perPlayer[pid]) continue;
      if (rec.diceRoll != null) perPlayer[pid].rolls.push(rec.diceRoll);

      // neutral (finish by dice) -> don't count Q
      const finalPos = rec.finalPosition ?? perPlayer[pid].position;
      const basePos = rec.basePosition ?? finalPos;
      const neutralFinishByDice =
        rec.correct == null && !rec.answered && basePos >= BOARD_SIZE && finalPos >= BOARD_SIZE;

      if (neutralFinishByDice) continue;

      if (rec.correct === true) perPlayer[pid].answerSymbols.push("✅");
      else perPlayer[pid].answerSymbols.push("❌");
    }
  }

  const raf = () => new Promise((r) => requestAnimationFrame(r));
  function normalizeDeg(d){
    let x = Number(d) || 0;
    x = x % 360;
    if (x < 0) x += 360;
    return x;
  }

  const rollDiceWithOverlay = async (durationMs = 5000) => {
    const finalRoll = Math.floor(Math.random() * 6) + 1;
  
    if (!diceOverlayEl || !dice3dEl) return finalRoll;
  
    diceOverlayEl.style.display = "flex";
  
    // ✅ ระหว่างหมุน: ซ่อนปุ่ม และกันกด
    if (closeDiceOverlayBtn) {
      closeDiceOverlayBtn.style.display = "none";
      closeDiceOverlayBtn.disabled = true;
    }
  
    if (diceHintEl) diceHintEl.textContent = "ลูกเต๋ากำลังกลิ้ง…";
  
    // ตั้งท่าเริ่มแบบสุ่ม (ไม่มี transition)
    dice3dEl.style.transition = "none";
    const startX = Math.floor(Math.random() * 360);
    const startY = Math.floor(Math.random() * 360);
    const startZ = Math.floor(Math.random() * 360);
    dice3dEl.style.transform = `rotateX(${startX}deg) rotateY(${startY}deg) rotateZ(${startZ}deg)`;
  
    // ✅ ให้ browser “รับค่าท่าเริ่ม” ก่อนค่อยเริ่มหมุน (ดีกว่า offsetWidth)
    await raf();
  
    // หมุนให้ “ด้านบน” เป็นแต้มที่ทอยได้
    const end = rotationForTopFace(finalRoll);
  
    const extraX = 360 * (Math.floor(Math.random() * 4) + 6);
    const extraY = 360 * (Math.floor(Math.random() * 4) + 6);
    const extraZ = 360 * (Math.floor(Math.random() * 3) + 4);
  
    dice3dEl.style.transition = `transform ${durationMs}ms cubic-bezier(.08,.85,.18,1)`;
    dice3dEl.style.transform =
      `rotateX(${end.x + extraX}deg) rotateY(${end.y + extraY}deg) rotateZ(${end.z + extraZ}deg)`;
  
    await sleep(durationMs);
  
    // ✅ SNAP เข้าค่ามาตรฐานโดย “ไม่ animate รอบสอง”
    dice3dEl.style.transition = "none";
    await raf(); // สำคัญ กันบาง browser ยังจำ transition เก่า
  
    dice3dEl.style.transform =
      `rotateX(${normalizeDeg(end.x)}deg) rotateY(${normalizeDeg(end.y)}deg) rotateZ(${normalizeDeg(end.z)}deg)`;
  
    await raf();
  
    // ✅ หมุนจบแล้ว แต่ยังไม่ให้ปิด (รอไปเปิดปุ่มหลัง commit สำเร็จ)
    if (diceHintEl) diceHintEl.textContent = `ได้แต้ม: ${finalRoll} (กำลังบันทึกผล…)`;
  
    return finalRoll;
  };

  function getStatusText(p) {
    if (p.finished) return "เข้าเส้นชัยแล้ว (ช่อง 30)";
    if (phase === "rolling") return p.hasRolled ? `ทอยแล้ว (${p.lastRoll ?? "-"} แต้ม)` : "ยังไม่ทอยลูกเต๋า";
    if (phase === "questionCountdown") return "รอคำถามรอบนี้";
    if (phase === "answering") {
      if (deadlineExpired) return p.answered ? "ตอบแล้ว (รอเฉลย)" : "ตอบไม่ทัน";
      return p.answered ? "ตอบแล้ว (รอเฉลย)" : "กำลังตอบ / ยังไม่ตอบ";
    }
    if (phase === "result") {
      const moveCorrectText = rewardCorrect >= 0 ? `+${rewardCorrect}` : `${rewardCorrect}`;
      const moveWrongText = penaltyWrong >= 0 ? `+${penaltyWrong}` : `${penaltyWrong}`;
      if (p.lastAnswerCorrect === true) return `ตอบถูก (${moveCorrectText} ช่อง)`;
      if (p.lastAnswerCorrect === false) return p.answered ? `ตอบผิด (${moveWrongText} ช่อง)` : `ตอบไม่ทัน (${moveWrongText} ช่อง)`;
      return "รอรอบถัดไป";
    }
    if (phase === "ended") return "เกมจบแล้ว";
    return "รอเริ่มรอบใหม่";
  }

  const statsArray = Object.values(perPlayer).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  let html = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>อันดับ</th>
            <th class="name-col">ผู้เล่น</th>
            <th>ตำแหน่ง</th>
            <th>ทอยเต๋า</th>
            <th>คำถาม</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
  `;

  statsArray.forEach((p, idx) => {
    const rank = idx + 1;  
  
    html += `
      <tr>
        <td>${rank}</td>
        <td class="name-col">${escapeHtml(p.name)}</td>
        <td>${p.position}</td>
        <td>${escapeHtml(p.rolls.join(" ") || "-")}</td>
        <td>${escapeHtml(p.answerSymbols.join(" ") || "-")}</td>
        <td>${escapeHtml(getStatusText(p))}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  playerListEl.innerHTML = html;
}

// ---------------- Host: Start Game (ไปโฟกัส GAME BOARD) ----------------
startGameBtn?.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;

  const roomData = snap.val();
  const players = roomData.players || {};
  const totalPlayers = Object.keys(players).length;

  if (roomData.status !== "lobby") {
    alert("ห้องนี้เริ่มเกมแล้ว");
    return;
  }
  if (totalPlayers <= 0) {
    alert("ยังไม่มีผู้เล่นเข้าห้อง");
    return;
  }

  await update(roomRef, {
    status: "inGame",
    phase: "idle",
    gameStartedAt: Date.now(),
  });


  // เลื่อนไป GAME BOARD ให้โฟกัสตามที่ต้องการ
  document.getElementById("gameArea")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---------------- Host: Start New Round (Transaction) ----------------
startRoundBtn.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room) return room;

    const phase = room.phase || "idle";
    if (phase === "ended") return; // abort
    
    // ✅ ไม่ให้ข้ามตอนกำลัง countdown/answering
    if (phase === "questionCountdown" || phase === "answering") return;
    
    // ✅ (แนะนำ) เริ่มรอบใหม่ได้เฉพาะตอน idle หรือ result เท่านั้น
    if (phase !== "idle" && phase !== "result") return;
    
    // ✅ (แนะนำ) ต้องอยู่สถานะ inGame ก่อนถึงเริ่มรอบได้
    if (room.status !== "inGame") return;
    
    const gs = room.gameSettings || {};
    const maxRounds = Math.max(1, gs.maxRounds ?? 10);
    const currentRound = room.currentRound || 0;
    if (currentRound >= maxRounds) return; // abort (should be ended by reveal)

    const players = room.players || {};
    const questionSetLen = getQuestionSetLengthForRoom(room);

    const newRound = currentRound + 1;
    room.currentRound = newRound;
    room.phase = "rolling";
    room.status = room.status === "lobby" ? "playing" : (room.status || "playing");
    room.questionIndex = (newRound - 1) % (questionSetLen || 1);
    room.questionCountdownStartAt = null;
    room.answerStartAt = null;
    room.answerTimeSeconds = null;
    room.answerDeadlineExpired = false;

    for (const [pid, p] of Object.entries(players)) {
      const posNow = clampPos(p.position);
      p.startOfRoundPos = posNow;

      if (p.finished || posNow >= BOARD_SIZE) {
        p.hasRolled = true; // finished players auto-rolled
      } else {
        p.lastRoll = null;
        p.hasRolled = false;
      }

      p.answered = false;
      p.answer = null;
      p.lastAnswerCorrect = null;
      players[pid] = p;
    }

    room.players = players;
    return room;
  });

  if (!result.committed) {
    alert("เริ่มรอบใหม่ไม่ได้ (อาจถึงรอบสูงสุดแล้ว หรืออยู่ในช่วงตอบ/นับถอยหลัง)");
  } else {
    clearTimer();
  }
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rotationForTopFace(roll){
  // ทำให้ TOP = แต้มที่ทอยได้ (และมุมข้างตรงมาตรฐาน)
  const map = {
    1: { x: 0,   y: 90,  z: 90  }, // TOP=1, front=5, right=4
    2: { x: 0,   y: 0,   z: 90  },
    3: { x: 0,   y: 0,   z: 0   },
    4: { x: 180, y: 0,   z: 0   }, // TOP=4, front=6, right=2
    5: { x: 0,   y: 0,   z: 270 }, // TOP=5, front=1, right=3
    6: { x: 0,   y: 270, z: 90  },
  };
  return map[roll] || map[3];
}

const rollDiceWithOverlay = async (durationMs = 5000) => {
  const finalRoll = Math.floor(Math.random() * 6) + 1;

  // ไม่มี element ก็คืนแต้มไปเลย (กันพัง)
  if (!diceOverlayEl || !dice3dEl) return finalRoll;

  showDiceOverlayRolling();
  if (diceHintEl) diceHintEl.textContent = "ลูกเต๋ากำลังกลิ้ง…";

  // ท่าเริ่ม
  dice3dEl.style.transition = "none";
  const startX = Math.floor(Math.random() * 360);
  const startY = Math.floor(Math.random() * 360);
  const startZ = Math.floor(Math.random() * 360);
  dice3dEl.style.transform = `rotateX(${startX}deg) rotateY(${startY}deg) rotateZ(${startZ}deg)`;
  void dice3dEl.offsetWidth;

  const end = rotationForTopFace(finalRoll);

  const extraX = 360 * (Math.floor(Math.random() * 4) + 6);
  const extraY = 360 * (Math.floor(Math.random() * 4) + 6);
  const extraZ = 360 * (Math.floor(Math.random() * 3) + 4); // ✅ ต้องเป็น 360 เท่านั้น
  
  dice3dEl.style.transition = `transform ${durationMs}ms cubic-bezier(.08,.85,.18,1)`;
  dice3dEl.style.transform =
    `rotateX(${end.x + extraX}deg) rotateY(${end.y + extraY}deg) rotateZ(${end.z + extraZ}deg)`;

  await sleep(durationMs);
  
  // ✅ snap ให้เป็นค่ามาตรฐาน โดยไม่ให้ animate อีกรอบ
  dice3dEl.style.transition = "none";
  dice3dEl.style.transform =
    `rotateX(${end.x}deg) rotateY(${end.y}deg) rotateZ(${end.z}deg)`;
  
  // optional: force reflow กันบาง browser ดื้อ
  void dice3dEl.offsetWidth;

  // ✅ หมุนจบแล้ว: โชว์ปุ่ม แต่ยังปิดไม่ได้จนกว่าจะ commit
  if (diceHintEl) diceHintEl.textContent = `ได้แต้ม: ${finalRoll} (กำลังบันทึกผล…)`;
  showDiceOverlayWaitingCommit();

  return finalRoll;
};

// debug กันหลอน: เช็คว่า “มีจริง” หลังโหลด
window.__SQ_rollDiceWithOverlay = rollDiceWithOverlay;
console.log("rollDiceWithOverlay typeof:", typeof rollDiceWithOverlay);

// ---------------- Player: Roll Dice (Transaction-safe) ----------------
rollDiceBtn.addEventListener("click", async () => {
  if (currentRole !== "player" || !currentRoomCode || !currentPlayerId) return;

  if (rollPending) return;
  rollPending = true;
  rollDiceBtn.disabled = true;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);

  // ✅ เพิ่ม: reset สถานะ overlay ทุกครั้งที่กดทอย
  diceIsRolling = false;
  diceCommitDone = false;

  // กันกรณีปุ่มปิดค้างจากรอบก่อน
  if (closeDiceOverlayBtn) {
    closeDiceOverlayBtn.style.display = "none";
    closeDiceOverlayBtn.disabled = true;
  }

  try {
    const snap = await get(roomRef);
    if (!snap.exists()) {
      rollPending = false;
      rollDiceBtn.disabled = false;
      return;
    }

    const roomData = snap.val();
    if (roomData.phase !== "rolling") {
      rollPending = false;
      rollDiceBtn.disabled = false;
      alert("ตอนนี้ยังไม่ใช่ช่วงทอยลูกเต๋า (รอครูเริ่มรอบ)");
      return;
    }

    const me = roomData.players?.[currentPlayerId];
    if (!me) {
      rollPending = false;
      rollDiceBtn.disabled = false;
      alert("ไม่พบข้อมูลผู้เล่นของคุณในห้อง");
      return;
    }

    const pos = me.position || 1;
    if (me.finished || pos >= BOARD_SIZE) {
      rollPending = false;
      rollDiceBtn.disabled = false;
      alert("คุณเข้าเส้นชัยแล้ว ไม่ต้องทอยลูกเต๋า");
      return;
    }

    if (me.hasRolled) {
      rollPending = false;
      rollDiceBtn.disabled = false;
      return;
    }

    // ✅ เพิ่ม: เริ่ม “ช่วงหมุน”
    diceIsRolling = true;
    diceCommitDone = false;

    // ✅ เรียก overlay 5 วิ แล้วค่อย commit
    const roll = await rollDiceWithOverlay(5000);

    // ✅ เพิ่ม: หมุนจบแล้ว (แต่ยังห้ามปิด เพราะยังไม่ commit)
    diceIsRolling = false;

    // commit ด้วย transaction
    await finalizeRollTransaction(roll);

    // ✅ เพิ่ม: commit สำเร็จแล้ว ถึงให้ปิดได้
    diceCommitDone = true;

    if (diceHintEl) diceHintEl.textContent = `ได้แต้ม: ${roll} (บันทึกแล้ว) กดปุ่มเพื่อกลับไปที่ GAME BOARD`;

    if (closeDiceOverlayBtn) {
      closeDiceOverlayBtn.style.display = "inline-flex";
      closeDiceOverlayBtn.disabled = false;
    }

    // ✅ success: ปล่อยให้ DB sync มาปลด rollPending ใน updateRoleControls()
  } catch (e) {
    console.error(e);

    // ✅ เพิ่ม: fail ต้อง reset flag
    diceIsRolling = false;
    diceCommitDone = false;

    // ✅ ปิด overlay + รีเซ็ตปุ่ม
    if (diceOverlayEl) diceOverlayEl.style.display = "none";
    if (closeDiceOverlayBtn) {
      closeDiceOverlayBtn.style.display = "none";
      closeDiceOverlayBtn.disabled = true;
    }

    rollPending = false;
    rollDiceBtn.disabled = false;
    alert("ทอยเต๋าไม่สำเร็จ (เครือข่าย/ระบบมีปัญหา ลองใหม่)");
  }
});

async function finalizeRollTransaction(roll) {
  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const now = Date.now();

  const tx = await runTransaction(roomRef, (room) => {
    if (!room) return room;

    if (room.phase !== "rolling") return;          // abort
    if ((room.currentRound || 0) <= 0) return;     // abort

    const players = room.players || {};
    const me = players[currentPlayerId];
    if (!me) return;                               // abort

    const pos = clampPos(me.position);
    const finished = !!me.finished || pos >= BOARD_SIZE;
    if (finished) return;                          // abort
    if (me.hasRolled) return;                       // abort

    const startPos = pos;
    const newPos = clampPos(startPos + roll);

    me.lastRoll = roll;
    me.position = newPos;
    me.hasRolled = true;

    if (newPos >= BOARD_SIZE) {
      me.finished = true;
      me.finishedRound = room.currentRound || 0;
      me.finishedBy = "dice";
    }

    const r = room.currentRound || 0;
    room.history = room.history || {};
    const roundKey = `round_${r}`;
    room.history[roundKey] = room.history[roundKey] || {};
    room.history[roundKey].diceMoves = room.history[roundKey].diceMoves || {};
    room.history[roundKey].diceMoves[currentPlayerId] = {
      playerId: currentPlayerId,
      playerName: me.name || "",
      fromPosition: startPos,
      toPosition: newPos,
      diceRoll: roll,
      pathCells: getPathCells(startPos, newPos),
      timestamp: now,
    };

    room.winners = Array.isArray(room.winners) ? room.winners : [];
    const winnerIds = new Set(room.winners.map((w) => w.playerId));
    if (newPos >= BOARD_SIZE && !winnerIds.has(currentPlayerId)) {
      room.winners.push({
        playerId: currentPlayerId,
        playerName: me.name || currentPlayerId,
        finishedRound: r,
        rank: room.winners.length + 1,
      });
    }

    const gs = room.gameSettings || {};
    const maxWinners = Math.max(1, gs.maxWinners ?? 5);
    const totalPlayers = Object.keys(players).length;
    const targetWinners = Math.min(maxWinners, totalPlayers);

    const finishedCount = Object.values(players).filter((p) => (p.finished || clampPos(p.position) >= BOARD_SIZE)).length;
    if (room.winners.length >= targetWinners || finishedCount === totalPlayers) {
      room.phase = "ended";
      room.status = "finished";
      room.endInfo = {
        endedAt: now,
        endReason: "winners",
        maxRounds: gs.maxRounds ?? 10,
        maxWinners,
        winnerCount: room.winners.length,
      };
    }

    players[currentPlayerId] = me;
    room.players = players;
    return room;
  });

  return !!tx.committed;
}

// ---------------- Host: Start Question (Transaction) ----------------
startQuestionBtn.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const now = Date.now();

  const tx = await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.phase !== "rolling") return;

    const players = room.players || {};
    const activePlayers = Object.values(players).filter((p) => !p.finished && clampPos(p.position) < BOARD_SIZE);
    const totalActive = activePlayers.length;
    const rolledCount = activePlayers.filter((p) => !!p.hasRolled).length;
    if (totalActive > 0 && rolledCount < totalActive) return; // abort

    const questionIndex = room.questionIndex ?? 0;
    const q = getQuestionFromRoom(room, questionIndex);
    if (!q) return;

    room.phase = "questionCountdown";
    room.questionCountdownStartAt = now;
    room.questionCountdownSeconds = 3;
    room.answerStartAt = null;
    room.answerTimeSeconds = q.timeLimit;
    room.answerDeadlineExpired = false;

    return room;
  });

  if (!tx.committed) {
  alert("เริ่มคำถามไม่ได้ (ยังมีคนไม่ทอย หรือ phase ไม่ถูกต้อง)");
  return;
}

// ✅ เคลียร์ timer เก่า + ตั้ง auto-advance กันค้าง
clearTimer();
countdownAutoTimeout = setTimeout(() => {
  moveCountdownToAnsweringTx().catch((e) => console.error("auto-advance failed:", e));
}, 3080); // 3s + buffer เล็กน้อย

});

// ---------------- Host: Reveal Answer & Move (Transaction) ----------------
revealAnswerBtn.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const now = Date.now();

  const tx = await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.phase !== "answering") return;

    const players = room.players || {};
    const gs = room.gameSettings || {};

    const rewardCorrect = Number.isFinite(gs.rewardCorrect) ? gs.rewardCorrect : 1;
    const penaltyWrong = Number.isFinite(gs.penaltyWrong) ? gs.penaltyWrong : -1;
    const maxRounds = Math.max(1, gs.maxRounds ?? 10);
    const maxWinners = Math.max(1, gs.maxWinners ?? 5);

    const questionIndex = room.questionIndex ?? 0;
    const q = getQuestionFromRoom(room, questionIndex);
    if (!q) return;

    const questionSetId = gs.questionSetId || "general";
    const currentRound = room.currentRound || 0;

    room.history = room.history || {};
    const roundKey = `round_${currentRound}`;
    room.history[roundKey] = room.history[roundKey] || {};
    room.history[roundKey].answers = room.history[roundKey].answers || {};

    room.winners = Array.isArray(room.winners) ? room.winners : [];
    const winnerIds = new Set(room.winners.map((w) => w.playerId));

    for (const [pid, p] of Object.entries(players)) {
      const basePos = clampPos(p.position);
      const alreadyFinished = !!p.finished || basePos >= BOARD_SIZE;

      let answered = !!p.answered;
      let ans = p.answer ?? null;

      let correct = null;
      let configuredMove = 0;
      let finalPos = basePos;

      if (!alreadyFinished) {
        correct = answered && ans === q.correctOption;
        configuredMove = correct ? rewardCorrect : penaltyWrong;
        finalPos = clampPos(basePos + configuredMove);

        p.position = finalPos;
        p.lastAnswerCorrect = correct;

        if (finalPos >= BOARD_SIZE) {
          p.finished = true;
          p.finishedRound = currentRound;
          p.finishedBy = "answer";
        }
      } else {
        // neutral record for finished players this round (no Q stats)
        answered = false;
        ans = null;
        correct = null;
        configuredMove = 0;
        finalPos = basePos;
      }

      // history record
      room.history[roundKey].answers[pid] = {
        playerId: pid,
        playerName: p.name || "",
        questionSetId,
        questionIndex,
        questionText: q.text,
        selectedOption: ans,
        correct,
        answered,
        diceRoll: p.lastRoll ?? null,
        basePosition: basePos,
        finalPosition: finalPos,
        configuredMove,
        actualDelta: finalPos - basePos,
        timestamp: now,
      };

      // winners update
      if (finalPos >= BOARD_SIZE && !winnerIds.has(pid)) {
        room.winners.push({
          playerId: pid,
          playerName: p.name || pid,
          finishedRound: p.finishedRound ?? currentRound,
          rank: room.winners.length + 1,
        });
        winnerIds.add(pid);
      }

      players[pid] = p;
    }

    room.players = players;

    // end game decision
    const totalPlayers = Object.keys(players).length;
    const targetWinners = Math.min(maxWinners, totalPlayers);

    let gameEnded = false;
    let endReason = null;

    if (room.winners.length >= targetWinners || room.winners.length === totalPlayers) {
      gameEnded = true;
      endReason = "winners";
    } else if (currentRound >= maxRounds) {
      gameEnded = true;
      endReason = "rounds";
    }

    if (gameEnded) {
      room.phase = "ended";
      room.status = "finished";
      room.endInfo = {
        endedAt: now,
        endReason,
        maxRounds,
        maxWinners,
        winnerCount: room.winners.length,
      };
    } else {
      room.phase = "result";
    }

    return room;
  });

  if (!tx.committed) alert("เฉลยไม่ได้ (phase ไม่ถูกต้อง)");
  clearTimer();
});

// ---------------- Game View ----------------
function updateGameView(roomData, players) {
  const round = roomData.currentRound || 0;
  const phase = roomData.phase || "idle";
  const deadlineExpired = roomData.answerDeadlineExpired === true;

  const status = roomData.status || "lobby";
  const showGameArea = (status === "inGame") || (round > 0) || (phase === "ended");
  
  if (gameAreaEl) gameAreaEl.style.display = showGameArea ? "block" : "none";
  
  const gameBarEl = document.getElementById("gameBar");
  if (gameBarEl) gameBarEl.style.display = showGameArea ? "flex" : "none";
  
  if (roundInfoEl) {
    if (round > 0) roundInfoEl.textContent = `รอบที่: ${round}`;
    else if (status === "inGame") roundInfoEl.textContent = `รอบที่: -`; // ยังไม่เริ่มรอบ
    else roundInfoEl.textContent = "ยังไม่ได้เริ่มรอบ";
  }

  // สถานะรอบ (ข้อความหลัก)
  let phaseText = "";
  switch (phase) {
    case "rolling": phaseText = "กำลังทอยลูกเต๋า"; break;
    case "questionCountdown": phaseText = "เตรียมคำถาม"; break;
    case "answering": phaseText = "กำลังตอบคำถาม"; break;
    case "result": phaseText = "สรุปผลคำถามรอบนี้"; break;
    case "ended": phaseText = "เกมจบแล้ว"; break;
    default: phaseText = "รอ Host เริ่มรอบใหม่";
  }

  // ✅ suffix เฉพาะ Host (ตาม format ที่ต้องการ)
  let hostSuffix = "";
  if (currentRole === "host") {
    const playerList = Object.values(players || {});
    const activePlayers = playerList.filter(p => !p.finished && (p.position || 1) < BOARD_SIZE);
    const totalActive = activePlayers.length;

    if (phase === "rolling") {
      const rolledActive = activePlayers.filter(p => !!p.hasRolled).length;
      hostSuffix = ` | ทอยแล้ว ${rolledActive}/${totalActive} คน`;
    } else if (phase === "answering") {
      const answeredActive = activePlayers.filter(p => !!p.answered).length;
      hostSuffix = ` | ตอบแล้ว ${answeredActive}/${totalActive} คน`;
      if (deadlineExpired) hostSuffix += " | หมดเวลาแล้ว";
    }
  }

  if (phaseInfoEl) {
    // host: [สถานะรอบ: ... | ...]
    // player: [สถานะรอบ: ...]
    phaseInfoEl.textContent = round > 0
      ? `[สถานะรอบ: ${phaseText}${hostSuffix}]`
      : "";
  }

  renderBoard(roomData, players);
  updateRoleControls(roomData, players);
  updateQuestionUI(roomData, players);

  // ✅ End game summary
  const ended = (phase === "ended") || (status === "finished");
  if (endGameAreaEl) endGameAreaEl.style.display = ended ? "block" : "none";
  if (ended) {
    renderEndGameSummary(roomData, players);
  }
}

// ---------------- Role Controls ----------------
function updateRoleControls(roomData, players) {
  const phase = roomData.phase || "idle";

  // 1) ปุ่มบนแถบ GAME BAR: แยก Host / Player ชัดเจน
  if (hostGameControlsEl) {
    hostGameControlsEl.style.display = (currentRole === "host") ? "flex" : "none";
    hostGameControlsEl.style.visibility = "visible";
    hostGameControlsEl.style.pointerEvents = (currentRole === "host") ? "auto" : "none";
  }

  if (playerGameControlsEl) {
    playerGameControlsEl.style.display = (currentRole === "player") ? "flex" : "none";
    playerGameControlsEl.style.visibility = "visible";
    playerGameControlsEl.style.pointerEvents = (currentRole === "player") ? "auto" : "none";
  }

  // 2) Player: คุมปุ่มทอยอย่างเดียว (ไม่มีข้อความสถานะใน card แล้ว)
  if (currentRole === "player") {
    const me = (players && currentPlayerId && players[currentPlayerId]) || {};
    const pos = me.position || 1;
    const finished = !!me.finished || pos >= BOARD_SIZE;
    const rolled = !!me.hasRolled;

    // ✅ ปลด pending เมื่อ DB บอกว่า hasRolled แล้ว หรือ phase ไม่ใช่ rolling
    if (rollPending && (rolled || roomData.phase !== "rolling" || finished)) {
      rollPending = false;
      if (rollDiceBtn) rollDiceBtn.textContent = "ทอยลูกเต๋า";
    }

    const rolledOrPending = rolled || rollPending;
    const canRoll = roomData.phase === "rolling" && !rolledOrPending && !finished;

    if (rollDiceBtn) {
      rollDiceBtn.disabled = !canRoll;
      rollDiceBtn.style.display = "inline-flex";
    }

  } else {
    // ไม่ใช่ player ก็ไม่ต้องเห็นปุ่มทอย
    if (rollDiceBtn) rollDiceBtn.style.display = "none";
  }

  // 3) Host: enable/disable ปุ่มควบคุม (ไม่มีข้อความ "คุณเป็น Host..." แล้ว)
  if (currentRole === "host") {
    const list = Object.values(players || {});
    const activePlayers = list.filter((p) => !p.finished && clampPos(p.position) < BOARD_SIZE);
    const totalActive = activePlayers.length;
    const rolledActive = activePlayers.filter((p) => p.hasRolled).length;

    startRoundBtn.disabled = (phase === "ended");
    startQuestionBtn.style.display = (phase === "ended") ? "none" : "inline-block";
    revealAnswerBtn.style.display = (phase === "ended") ? "none" : "inline-block";

    startQuestionBtn.disabled = !(phase === "rolling" && (totalActive === 0 || rolledActive === totalActive));
    revealAnswerBtn.disabled = (phase !== "answering");
  } else {
    // ไม่ใช่ host ก็ซ่อนปุ่ม host
    startRoundBtn.disabled = true;
    startQuestionBtn.style.display = "none";
    revealAnswerBtn.style.display = "none";
  }
}

// ---------------- Question UI + Timer ----------------
function updateQuestionUI(roomData, players) {
  const phase = roomData.phase || "idle";
  const round = roomData.currentRound || 0;
  const questionIndex = roomData.questionIndex;
  const question = questionIndex != null ? getQuestionFromRoom(roomData, questionIndex) : null;

  if (round === 0) {
    questionAreaEl.style.display = "none";
    countdownDisplayEl.textContent = "";
    clearTimer();
    return;
  }

  if (phase === "questionCountdown") {
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = `เตรียมคำถามรอบที่ ${round} …`;
    choicesContainerEl.innerHTML = "";
    ensureTimer(roomData, "questionCountdown");
    return;
  }

  if (phase === "answering" && question) {
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = question.text;

    const me = players?.[currentPlayerId] || {};
    const selectedOption = me.answer || null;

    // ✅ กันตอบหลังหมดเวลา แม้ flag ยัง false (เช่น host หลุด)
    const startAt = roomData.answerStartAt;
    const duration = roomData.answerTimeSeconds;
    const now = Date.now();
    const computedExpired =
      Number.isFinite(startAt) && Number.isFinite(duration)
        ? now > (startAt + duration * 1000)
        : false;

    const deadlineExpired = roomData.answerDeadlineExpired === true || computedExpired;
    const disableButtons = deadlineExpired || !!me.finished;

    renderChoicesForPhase(question, selectedOption, question.correctOption, false, disableButtons);
    ensureTimer(roomData, "answering");
    return;
  }

  if (phase === "result" && question) {
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = `เฉลยรอบที่ ${round}: ${question.text}`;
    countdownDisplayEl.textContent = "";

    let selectedOption = null;
    if (currentRole === "player") {
      const me = players?.[currentPlayerId] || {};
      selectedOption = me.answer || null;
    }

    renderChoicesForPhase(question, selectedOption, question.correctOption, true, true);
    clearTimer();
    return;
  }

  questionAreaEl.style.display = "none";
  countdownDisplayEl.textContent = "";
  clearTimer();
}

function renderChoicesForPhase(question, selectedOption, correctOption, showResultOnly, disableAnswerButtons = false) {
  choicesContainerEl.innerHTML = "";
  if (!question) return;

  for (const [key, text] of Object.entries(question.choices)) {
    const btn = document.createElement("button");
    btn.classList.add("choice-btn");
    btn.textContent = `${key}. ${text}`;

    if (showResultOnly) {
      if (key === correctOption) btn.classList.add("correct");
      if (selectedOption && selectedOption === key && selectedOption !== correctOption) btn.classList.add("wrong");
      btn.disabled = true;
    } else {
      if (selectedOption && key === selectedOption) btn.classList.add("selected");
      btn.disabled = disableAnswerButtons;

      if (!disableAnswerButtons && currentRole === "player") {
        btn.addEventListener("click", () => submitAnswerTx(key));
      }
    }

    choicesContainerEl.appendChild(btn);
  }
}

function ensureTimer(roomData, targetPhase) {
  const phase = roomData.phase || "idle";
  const round = roomData.currentRound || 0;

  if (phase !== targetPhase || round === 0) {
    clearTimer();
    countdownDisplayEl.textContent = "";
    return;
  }
  if (timerPhase === phase && timerRound === round && timerInterval) return;

  clearTimer();
  timerPhase = phase;
  timerRound = round;

  if (phase === "questionCountdown") {
    const start = roomData.questionCountdownStartAt || Date.now();
    const duration = roomData.questionCountdownSeconds || 3;
  
    timerInterval = setInterval(() => {
      const now = Date.now();
      let remaining = Math.ceil((start + duration * 1000 - now) / 1000);
      if (remaining < 0) remaining = 0;
  
      countdownDisplayEl.textContent = `เริ่มตอบใน ${remaining} วินาที`;
  
      if (remaining <= 0) {
        clearTimer();
        if (currentRole === "host" && currentRoomCode) {
          moveCountdownToAnsweringTx().catch((e) => console.error(e));
        }
      }
    }, 250);
  }

  if (phase === "answering") {
    const duration = roomData.answerTimeSeconds || 20;
  
    // ✅ fallback: ถ้า phase เป็น answering แต่ answerStartAt ไม่ถูกตั้ง
    if (!Number.isFinite(roomData.answerStartAt)) {
      if (currentRole === "host" && currentRoomCode) {
        update(ref(db), { [`rooms/${currentRoomCode}/answerStartAt`]: Date.now() })
          .catch((e) => console.error("fix answerStartAt failed:", e));
      }
      countdownDisplayEl.textContent = "รอเริ่มจับเวลา…";
      return;
    }
  
    const start = roomData.answerStartAt;
  
    timerInterval = setInterval(() => {
      const now = Date.now();
      let remaining = Math.ceil((start + duration * 1000 - now) / 1000);
      if (remaining < 0) remaining = 0;
  
      countdownDisplayEl.textContent = `เหลือเวลา ${remaining} วินาที`;
  
      if (remaining <= 0) {
        clearTimer();
  
        // Host set flag หมดเวลา (ไม่ใช้ async ใน interval)
        if (currentRole === "host" && currentRoomCode && roomData.answerDeadlineExpired !== true) {
          update(ref(db), { [`rooms/${currentRoomCode}/answerDeadlineExpired`]: true })
            .catch((e) => console.error("Error setting answerDeadlineExpired:", e));
        }
      }
    }, 250);
  }
}

// host: questionCountdown -> answering (Transaction)
async function moveToAnswering() {
  if (currentRole !== "host" || !currentRoomCode) return;

  const snap = await get(ref(db, `rooms/${currentRoomCode}`));
  if (!snap.exists()) return;

  const roomData = snap.val();
  if (roomData.phase !== "questionCountdown") return;

  const now = Date.now();
  await update(ref(db), {
    [`rooms/${currentRoomCode}/phase`]: "answering",
    [`rooms/${currentRoomCode}/answerStartAt`]: now,
    [`rooms/${currentRoomCode}/answerDeadlineExpired`]: false,
  });
}

// ---------------- “เลื่อน countdown → answering ----------------
async function moveCountdownToAnsweringTx() {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const now = Date.now();

  await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.phase !== "questionCountdown") return; // ไม่ใช่ countdown แล้วก็ไม่ต้องทำอะไร

    room.phase = "answering";
    room.answerStartAt = now;              // ✅ สำคัญมาก กัน “รอเริ่มจับเวลา…”
    room.answerDeadlineExpired = false;
    return room;
  });
}

// ---------------- Player: Submit Answer (Transaction-safe) ----------------
async function submitAnswerTx(optionKey) {
  if (currentRole !== "player" || !currentRoomCode || !currentPlayerId) return;
  if (answerPending) return;                 // ✅ กันกดรัว ๆ ระหว่างรอ transaction
  answerPending = true;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);

  try {
    const tx = await runTransaction(roomRef, (room) => {
      if (!room) return;                     // abort
      if (room.phase !== "answering") return; // abort

      const startAt = room.answerStartAt;
      const duration = room.answerTimeSeconds;

      // ถ้ายังไม่เริ่มจับเวลา -> ไม่ให้ตอบ (กันค้าง/ค่าไม่ครบ)
      if (!Number.isFinite(startAt) || !Number.isFinite(duration)) {
        return; // abort
      }

      const now = Date.now();
      const expired = now > (startAt + duration * 1000);

      // หมดเวลา -> ปัก flag แล้ว commit (ให้ทุกคนเห็นหมดเวลา)
      if (room.answerDeadlineExpired === true || expired) {
        room.answerDeadlineExpired = true;
        return room; // commit เฉพาะ flag
      }

      const players = room.players || {};
      const me = players[currentPlayerId];
      if (!me) return;                       // abort

      const pos = clampPos(me.position);
      if (me.finished || pos >= BOARD_SIZE) return; // abort
      if (me.answered) return;               // abort (ตอบไปแล้ว)

      me.answer = optionKey;
      me.answered = true;
      players[currentPlayerId] = me;
      room.players = players;

      return room; // commit
    });

    // ---- วิเคราะห์ผล หลัง transaction ----
    if (!tx.committed) {
      // ไม่ได้ commit = ส่วนใหญ่คือ abort (phase ไม่ใช่ answering / ตอบไปแล้ว / ยังไม่เริ่มเวลา ฯลฯ)
      // ใช้ get เพิ่มเพื่อบอกเหตุแบบตรง ๆ (ไม่แพงมากและช่วย UX)
      const snap = await get(roomRef);
      if (!snap.exists()) {
        alert("ส่งคำตอบไม่สำเร็จ (ไม่พบห้องแล้ว)");
        return;
      }

      const room = snap.val();
      if (room.phase !== "answering") {
        alert("ส่งคำตอบไม่สำเร็จ (ยังไม่ใช่ช่วงตอบคำถาม)");
        return;
      }

      const me = room.players?.[currentPlayerId];
      if (!me) {
        alert("ส่งคำตอบไม่สำเร็จ (ไม่พบข้อมูลผู้เล่น)");
        return;
      }

      if (room.answerDeadlineExpired === true) {
        alert("ส่งคำตอบไม่สำเร็จ (หมดเวลาแล้ว)");
        return;
      }

      const startAt = room.answerStartAt;
      const duration = room.answerTimeSeconds;
      if (!Number.isFinite(startAt) || !Number.isFinite(duration)) {
        alert("ส่งคำตอบไม่สำเร็จ (ระบบยังไม่เริ่มจับเวลา)");
        return;
      }

      if (me.answered) {
        // ไม่ต้อง alert ก็ได้ แต่ถ้าต้องการให้ชัด
        // alert("คุณตอบไปแล้ว");
        return;
      }

      alert("ส่งคำตอบไม่สำเร็จ (ลองใหม่)");
      return;
    }

    // tx.committed อาจเป็นการ commit แค่ flag หมดเวลา (ไม่ได้บันทึกคำตอบเรา)
    const after = tx.snapshot?.val?.() || null;
    const meAfter = after?.players?.[currentPlayerId] || null;

    if (after?.answerDeadlineExpired === true) {
      alert("ส่งคำตอบไม่สำเร็จ (หมดเวลาแล้ว)");
      return;
    }

    if (!meAfter || meAfter.answered !== true || meAfter.answer !== optionKey) {
      // commit เกิดขึ้น แต่ไม่ใช่การบันทึกคำตอบเรา (เช่น commit flag อื่น)
      alert("ส่งคำตอบไม่สำเร็จ (ลองใหม่)");
      return;
    }

    // ✅ สำเร็จจริง: ไม่ต้อง alert (ปล่อยให้ UI update เลือกคำตอบ/disable เอง)
  } catch (e) {
    console.error("submitAnswerTx failed:", e);
    alert("ส่งคำตอบไม่สำเร็จ (เครือข่าย/ระบบมีปัญหา ลองใหม่)");
  } finally {
    answerPending = false;
  }
}

// ---------------- Board Rendering ----------------
function renderBoard(roomData, players) {
  if (!boardEl) return;

  const currentRound = roomData.currentRound || 0;
  const history = roomData.history || {};

  boardEl.innerHTML = "";

  // label row (ให้ layout เหมือนแถวผู้เล่น: ไม่มี spacer ซ้าย)
  const labelRow = document.createElement("div");
  labelRow.className = "board-label-row";
  
  const labelTrack = document.createElement("div");
  labelTrack.className = "board-track";
  
  const startLabelCell = document.createElement("div");
  startLabelCell.className = "cell-card start-cell";
  startLabelCell.innerHTML = `<span class="cell-label">Start</span>`;
  labelTrack.appendChild(startLabelCell);
  
  for (let i = 1; i <= BOARD_SIZE; i++) {
    const c = document.createElement("div");
    c.className = "cell-card play-cell";
    c.innerHTML = `<span class="cell-label">${i}</span>`;
    labelTrack.appendChild(c);
  }
  
  const finishLabelCell = document.createElement("div");
  finishLabelCell.className = "cell-card finish-cell";
  finishLabelCell.innerHTML = `<span class="cell-label">Finish</span>`;
  labelTrack.appendChild(finishLabelCell);
  
  labelRow.appendChild(labelTrack);
  boardEl.appendChild(labelRow);

  function buildCellStateForPlayer(pid, p) {
    const state = new Array(BOARD_SIZE + 1).fill("none");
    const priority = { none: 0, past: 1, dice: 2, wrong: 3, correct: 4 };

    const setState = (pos, value) => {
      if (pos < 1 || pos > BOARD_SIZE) return;
      if (priority[value] > priority[state[pos]]) state[pos] = value;
    };

    const startOfRound = clampPos(p.startOfRoundPos ?? 1);
    const currentPos = clampPos(p.position);

    for (let pos = 1; pos <= Math.min(startOfRound, BOARD_SIZE); pos++) setState(pos, "past");

    const currKey = `round_${currentRound}`;
    const currRoundData = history[currKey] || {};
    const recNow = (currRoundData.answers || {})[pid] || null;

    if (!recNow) {
      if (p.hasRolled && p.lastRoll != null) {
        const from = startOfRound;
        const to = currentPos;
        if (to >= from) for (let pos = from + 1; pos <= to; pos++) setState(pos, "dice");
      }
    } else {
      const basePos = clampPos(recNow.basePosition ?? startOfRound);
      const finalPos = clampPos(recNow.finalPosition ?? currentPos);

      for (let pos = startOfRound + 1; pos <= basePos; pos++) setState(pos, "dice");

      const moveType = recNow.correct ? "correct" : "wrong";
      const qStart = Math.min(basePos, finalPos);
      const qEnd = Math.max(basePos, finalPos);
      for (let pos = qStart + 1; pos <= qEnd; pos++) setState(pos, moveType);
    }

    return state;
  }

  const sorted = Object.entries(players || {}).sort(([,a],[,b]) => String(a.name||"").localeCompare(String(b.name||"")));

  for (const [pid, p] of sorted) {
    const row = document.createElement("div");
    row.className = "player-row";

    const track = document.createElement("div");
    track.className = "board-track";

    // ✅ start cell แสดงชื่อผู้เล่น
    const startCell = document.createElement("div");
    startCell.className = "cell-card start-cell";
    startCell.textContent = p.name || pid;   // หรือใส่เป็น HTML span ก็ได้
    track.appendChild(startCell);

    const cellState = buildCellStateForPlayer(pid, p);
    const playerPos = clampPos(p.position);

    for (let pos = 1; pos <= BOARD_SIZE; pos++) {
      const cell = document.createElement("div");
      cell.className = "cell-card play-cell";

      if (cellState[pos] === "past") cell.classList.add("cell-past");
      if (cellState[pos] === "dice") cell.classList.add("cell-dice");
      if (cellState[pos] === "wrong") cell.classList.add("cell-wrong");
      if (cellState[pos] === "correct") cell.classList.add("cell-correct");

      if (playerPos === pos) {
        const token = document.createElement("div");
        token.className = "token";
        token.style.backgroundColor = p.color || "#ffb300";

        const inner = document.createElement("div");
        inner.className = "token-inner";
        inner.textContent = String(p.name || "?").charAt(0);

        token.appendChild(inner);
        cell.appendChild(token);
      }

      track.appendChild(cell);
    }

    const finishCell = document.createElement("div");
    finishCell.className = "cell-card finish-cell";
    track.appendChild(finishCell);
  
    row.appendChild(track);
    boardEl.appendChild(row);
  }
}

// ---------------- End Game Summary (ใช้ของเดิมได้ แต่เพิ่ม wrapper + escape) ----------------
function renderEndGameSummary(roomData, players) {
  const history = roomData.history || {};
  const winners = Array.isArray(roomData.winners) ? roomData.winners : [];
  const endInfo = roomData.endInfo || {};
  const gs = roomData.gameSettings || {};
  const maxRounds = gs.maxRounds ?? "-";
  const maxWinners = gs.maxWinners ?? "-";
  const endReason = endInfo.endReason || "unknown";

  // ---------- reason text ----------
  let reasonText = "เกมจบแล้ว";
  if (endReason === "winners") {
    reasonText = `เกมจบเพราะมีผู้เข้าเส้นชัยครบ ${Math.min(
      Number(maxWinners) || 0,
      Object.keys(players || {}).length
    )} คน`;
  } else if (endReason === "rounds") {
    reasonText = `เกมจบเพราะเล่นครบ ${maxRounds} รอบแล้ว`;
  }

  // ---------- per-player base from players ----------
  const perPlayer = {};
  for (const [pid, p] of Object.entries(players || {})) {
    perPlayer[pid] = {
      id: pid,
      name: p.name || pid,
      finalPosition: p.position ?? 1,
      finished: !!p.finished || (p.position ?? 1) >= BOARD_SIZE,
      finishRound: p.finishedRound ?? null,
      finishBy: p.finishedBy ?? null, // "dice" | "answer" | null
      correct: 0,
      wrong: 0,
      timeout: 0,
      rolls: [],
      answerSymbols: [],
      pctCorrect: 0,
      rank: null,
    };
  }

  // ---------- enrich from history (if exists) ----------
  const roundKeys = Object.keys(history)
    .filter((k) => k.startsWith("round_"))
    .sort((a, b) => {
      const ra = parseInt(a.split("_")[1] || "0", 10);
      const rb = parseInt(b.split("_")[1] || "0", 10);
      return ra - rb;
    });

  for (const rk of roundKeys) {
    const roundData = history[rk] || {};
    const answers = roundData.answers || {};

    for (const [pid, rec] of Object.entries(answers)) {
      if (!perPlayer[pid]) {
        perPlayer[pid] = {
          id: pid,
          name: rec.playerName || pid,
          finalPosition: players?.[pid]?.position ?? 1,
          finished: !!players?.[pid]?.finished || (players?.[pid]?.position ?? 1) >= BOARD_SIZE,
          finishRound: players?.[pid]?.finishedRound ?? null,
          finishBy: players?.[pid]?.finishedBy ?? null,
          correct: 0,
          wrong: 0,
          timeout: 0,
          rolls: [],
          answerSymbols: [],
          pctCorrect: 0,
          rank: null,
        };
      }

      const s = perPlayer[pid];

      if (rec.diceRoll != null) s.rolls.push(rec.diceRoll);

      // เคส neutral: เข้าเส้นชัยด้วยลูกเต๋าและไม่ได้ตอบคำถาม
      const basePos = rec.basePosition ?? null;
      const finalPos = rec.finalPosition ?? null;
      const neutralFinishByDice =
        rec.correct == null &&
        rec.answered === false &&
        Number.isFinite(basePos) && Number.isFinite(finalPos) &&
        basePos >= BOARD_SIZE && finalPos >= BOARD_SIZE;

      if (!neutralFinishByDice) {
        if (rec.correct === true) {
          s.correct += 1;
          s.answerSymbols.push("✅");
        } else {
          if (rec.answered) s.wrong += 1;
          else s.timeout += 1;
          s.answerSymbols.push("❌");
        }
      }

      // อัปเดตตำแหน่งสุดท้ายจาก history ถ้ามี
      if (Number.isFinite(finalPos)) s.finalPosition = finalPos;
      if (finalPos >= BOARD_SIZE && s.finishRound == null) {
        const rn = parseInt(rk.split("_")[1] || "0", 10);
        s.finishRound = rn;
      }
    }
  }

  // pct correct
  for (const s of Object.values(perPlayer)) {
    const totalQ = s.correct + s.wrong + s.timeout;
    s.pctCorrect = totalQ > 0 ? (s.correct / totalQ) * 100 : 0;
  }

  // ---------- ranking ----------
  // ใช้ winners เป็นหลัก ถ้ามี
  const winMap = new Map();
  winners.forEach((w) => winMap.set(w.playerId, w));

  const stats = Object.values(perPlayer);

  stats.sort((a, b) => {
    const wa = winMap.has(a.id) ? (winMap.get(a.id).rank ?? 9999) : 9999;
    const wb = winMap.has(b.id) ? (winMap.get(b.id).rank ?? 9999) : 9999;
    if (wa !== wb) return wa - wb;

    // รอง: finishRound น้อยกว่า, position มากกว่า, % ถูกมากกว่า
    const fa = a.finishRound ?? 9999;
    const fb = b.finishRound ?? 9999;
    if (fa !== fb) return fa - fb;

    if (b.finalPosition !== a.finalPosition) return b.finalPosition - a.finalPosition;
    if (b.pctCorrect !== a.pctCorrect) return b.pctCorrect - a.pctCorrect;
    return (a.name || "").localeCompare(b.name || "");
  });

  stats.forEach((s, i) => (s.rank = i + 1));

  // ---------- build HTML ----------
  let html = `<p><strong>สรุปผลเกม</strong></p>`;
  html += `<p><strong>${reasonText}</strong></p>`;

  if (winners.length > 0) {
    html += `<p><strong>ผู้เข้าเส้นชัย</strong></p><ul>`;
    winners
      .slice()
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
      .forEach((w) => {
        html += `<li>อันดับเข้าเส้นชัย ${w.rank ?? "-"}: ${escapeHtml(w.playerName)} (รอบ ${w.finishedRound ?? "-"})</li>`;
      });
    html += `</ul>`;
  }

  html += `
    <h4>ตารางสรุปผลรายผู้เล่น</h4>
    <table>
      <thead>
        <tr>
          <th>อันดับ</th>
          <th class="name-col">ผู้เล่น</th>
          <th>ตำแหน่งสุดท้าย</th>
          <th>ถึงเส้นชัย?</th>
          <th>รอบที่ถึง</th>
          <th>วิธีถึง</th>
          <th>ถูก</th>
          <th>ผิด</th>
          <th>ไม่ทัน</th>
          <th>% ถูก</th>
          <th>ทอยลูกเต๋า</th>
          <th>ผลคำถาม</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const s of stats) {
    const pctText =
      (s.correct + s.wrong + s.timeout) > 0 ? `${Math.round(s.pctCorrect)}%` : "-";
    const rollsText = s.rolls.length ? s.rolls.join("") : "-";
    const ansText = s.answerSymbols.length ? s.answerSymbols.join("") : "-";
    const finishFlag = s.finished ? "✅" : "-";
    const finishRoundText = s.finishRound != null ? s.finishRound : "-";
    const finishByText = s.finished
      ? (s.finishBy === "dice" ? "ทอยถึง" : s.finishBy === "answer" ? "ตอบถึง" : "-")
      : "-";

    html += `
      <tr>
        <td>${s.rank ?? "-"}</td>
        <td class="name-col">${s.name}</td>
        <td>${s.finalPosition ?? "-"}</td>
        <td>${finishFlag}</td>
        <td>${finishRoundText}</td>
        <td>${finishByText}</td>
        <td>${s.correct}</td>
        <td>${s.wrong}</td>
        <td>${s.timeout}</td>
        <td>${pctText}</td>
        <td>${rollsText}</td>
        <td>${ansText}</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  endGameSummaryEl.innerHTML = html;
}

// ---------------- (สำคัญ) เปลี่ยน phase จาก questionCountdown -> answering โดยอัตโนมัติ ----------------
// (ทำผ่าน ensureTimer + moveToAnsweringTx)

// ---------------- เมื่อ role set แล้วให้เปิด lobby ----------------
function initUiIfReady() {
  if (currentRoomCode && currentRole) {
    enterLobbyView();
    subscribeRoom(currentRoomCode);
    lockEntryUIForRole(currentRole); // ✅ แทน lockEntryUI(true)
  }
}
initUiIfReady();

// ---------------- Reset UI กลับหน้าแรก ----------------
function resetToHome(message) {
  clearTimer();

  // stop listener
  if (roomUnsub) {
    try { roomUnsub(); } catch {}
    roomUnsub = null;
  }

  // clear session
  if (typeof clearSession === "function") clearSession();

  // clear state
  currentRoomCode = null;
  currentRole = null;
  currentPlayerId = null;

  // ---------- UI: hide in-room sections ----------
  const gameBarEl = document.getElementById("gameBar");
  if (gameBarEl) gameBarEl.style.display = "none";
  
  if (lobbyEl) lobbyEl.style.display = "none";
  if (gameAreaEl) gameAreaEl.style.display = "none";
  if (endGameAreaEl) endGameAreaEl.style.display = "none";
  if (questionAreaEl) questionAreaEl.style.display = "none";
  if (countdownDisplayEl) countdownDisplayEl.textContent = "";

  // clear dynamic areas
  if (playerListEl) playerListEl.innerHTML = "";
  if (boardEl) boardEl.innerHTML = "";
  if (roomInfoEl) roomInfoEl.textContent = ""; // (แม้จะซ่อนไว้ก็เคลียร์ได้)
  if (roleInfoEl) roleInfoEl.textContent = "";

  // lobby badges (ถ้ามี)
  if (lobbyBadgesEl) lobbyBadgesEl.innerHTML = "";

  // ---------- UI: show entry (Host/Player cards) ----------
  setEntryVisible(true);

  // reset host panel
  if (hostGameOptionsEl) hostGameOptionsEl.style.display = "none";

  // unlock inputs/buttons (entry)
  if (hostNameInput) hostNameInput.disabled = false;
  if (createRoomBtn) createRoomBtn.disabled = false;
  if (confirmCreateRoomBtn) confirmCreateRoomBtn.disabled = false;

  if (roomCodeInput) roomCodeInput.disabled = false;
  if (playerNameInput) playerNameInput.disabled = false;
  if (joinRoomBtn) joinRoomBtn.disabled = false;

  // header pills
  const uiRoomPill = document.getElementById("uiRoomPill");
  const uiRolePill = document.getElementById("uiRolePill");
  if (uiRoomPill) uiRoomPill.textContent = "Room: -";
  if (uiRolePill) uiRolePill.textContent = "Role: -";

  if (message) alert(message);
}

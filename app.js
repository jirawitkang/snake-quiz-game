// app.js
// Stable Multiplayer: transactions for dice/answer/host actions (patched)
// Refactor: grouped + ordered by flow (no core game logic changes)

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

/* =========================
   1) Firebase Config + Boot logs
========================= */
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

console.log("app.js loaded (Stable Transactions - patched)");

window.addEventListener("error", (e) => {
  console.error("[GLOBAL ERROR]", e.message, e.filename, e.lineno, e.colno);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[UNHANDLED PROMISE]", e.reason);
});

const app = firebaseInitializeApp(firebaseConfig);
const db = getDatabase(app);

/* =========================
   2) Constants / Enums / Storage
========================= */
const BOARD_SIZE = 30;

const STORAGE_KEY = "SQ_SESSION_V1";
const STORAGE = sessionStorage; // ✅ แยกต่อแท็บ

const STATUS = Object.freeze({
  LOBBY: "lobby",
  IN_GAME: "inGame",
  FINISHED: "finished",
});

const PHASE = Object.freeze({
  IDLE: "idle",
  ROLLING: "rolling",
  QUESTION_COUNTDOWN: "questionCountdown",
  ANSWERING: "answering",
  RESULT: "result",
  ENDED: "ended",
});

/* =========================
   3) Question Sets
========================= */
const QUESTION_SETS = {
  general: [
    {
      text: "ทำไมกาแฟถึงขม? (ตอบผิดไม่ดุ แต่อาจงอนนิดนึง)",
      choices: { A: "เพราะชีวิต", B: "เพราะน้ำตาลหมด", C: "เพราะเมล็ดกาแฟ", D: "เพราะแก้วมันเศร้า" },
      correctOption: "C",
      timeLimit: 10,
    },
    {
      text: "ถ้า Wi-Fi หลุดบ่อย เราควรทำอะไรก่อน?",
      choices: { A: "รีสตาร์ทเราเตอร์", B: "โทษชะตา", C: "เดินไปใกล้ ๆ แล้วทำเนียน", D: "อธิษฐานกับเสาสัญญาณ" },
      correctOption: "A",
      timeLimit: 10,
    },
    {
      text: "ข้อใดคือ ‘งานด่วน’ ที่แท้จริง?",
      choices: { A: "งานที่ต้องเสร็จเมื่อวาน", B: "งานที่หัวหน้าบอกว่าไม่รีบ", C: "งานที่ส่งแล้วแต่ยังต้องแก้", D: "งานที่ยังไม่เริ่มแต่ใกล้เดดไลน์" },
      correctOption: "A",
      timeLimit: 10,
    },
    {
      text: "ถ้าลืมรหัสผ่านบ่อย ควรตั้งรหัสใหม่ว่าอะไร?",
      choices: { A: "123456", B: "password", C: "ForgetMeNot2025!", D: "ชื่อแมว+วันเกิด+OTP" },
      correctOption: "C",
      timeLimit: 10,
    },
    {
      text: "เวลาพูดว่า ‘เดี๋ยวทำ’ โดยเฉลี่ยหมายถึง…",
      choices: { A: "ภายใน 5 นาที", B: "หลังอาหาร", C: "พรุ่งนี้แหละ", D: "เมื่อโลกสงบ" },
      correctOption: "C",
      timeLimit: 10,
    },
    {
      text: "ถ้าพบไฟล์ชื่อ final_v7_REALfinal จริง ๆ แล้วไฟล์ไหนคือไฟล์สุดท้าย?",
      choices: { A: "final", B: "final_v7_REALfinal", C: "final_v7_REALfinal_2", D: "ไฟล์ที่เปิดล่าสุด" },
      correctOption: "D",
      timeLimit: 10,
    },
    {
      text: "ข้อใดคือ ‘การออกกำลังกาย’ ของสายออฟฟิศ?",
      choices: { A: "เดินไปเข้าห้องน้ำ", B: "ยืดเส้นยืดสาย", C: "เดินไปหาเครื่องปริ้นท์แล้วเครื่องพัง", D: "ทั้งหมดที่กล่าวมา" },
      correctOption: "D",
      timeLimit: 10,
    },
    {
      text: "ถ้ากำลังจะชงมาม่า แต่หา ‘ซองพริก’ ไม่เจอ ควรทำยังไง?",
      choices: { A: "โทรแจ้งตำรวจ", B: "ทำใจแล้วกินแบบคลีน", C: "เขียนรายงานสาเหตุราก (RCA)", D: "เปิดซองอีกอันอย่างสง่างาม" },
      correctOption: "D",
      timeLimit: 10,
    },
    {
      text: "คำว่า ‘เดี๋ยวส่งให้ครับ/ค่ะ’ ในแชทงาน หมายถึงข้อใดมากที่สุด?",
      choices: { A: "ส่งทันที", B: "ส่งหลังประชุม", C: "ส่งก่อนเลิกงานถ้านึกได้", D: "ส่งเมื่อคุณทักมาครั้งที่ 3" },
      correctOption: "D",
      timeLimit: 10,
    },
    {
      text: "ถ้าตั้งนาฬิกาปลุก 10 อัน แต่ยังตื่นสาย สาเหตุคืออะไร?",
      choices: { A: "นาฬิกาปลุกผิด", B: "หมอนดูดวิญญาณ", C: "มือปิดเองแบบอัตโนมัติ (สกิลลับ)", D: "ทั้ง B และ C" },
      correctOption: "D",
      timeLimit: 10,
    },
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

/* =========================
   4) DOM Cache
========================= */
// ---------------- Admin Password Gate ----------------
const ADMIN_PIN = "8888";
const adminTopBtn = document.getElementById("adminTopBtn");
const adminPwOverlayEl = document.getElementById("adminPwOverlay");
const adminPwInputEl = document.getElementById("adminPwInput");
const adminPwErrorEl = document.getElementById("adminPwError");
const adminPwCancelBtn = document.getElementById("adminPwCancelBtn");

const headerHomeBtn = document.getElementById("headerHomeBtn");
const headerExitBtn = document.getElementById("headerExitBtn");

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
// NOTE: roomInfo ไม่มีใน index.html ล่าสุด → ไม่ใช้งาน
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

const startRoundBtn = document.getElementById("startRoundBtn");
const startQuestionBtn = document.getElementById("startQuestionBtn");
const revealAnswerBtn = document.getElementById("revealAnswerBtn");

const gameAreaEl = document.getElementById("gameArea");
const roundInfoEl = document.getElementById("roundInfo");
const phaseInfoEl = document.getElementById("phaseInfo");
const boardEl = document.getElementById("board");

const rollDiceBtn = document.getElementById("rollDiceBtn");

// Dice Overlay
const diceOverlayEl = document.getElementById("diceOverlay");
const dice3dEl = document.getElementById("dice3d");
const diceHintEl = document.getElementById("diceHint");
const closeDiceOverlayBtn = document.getElementById("closeDiceOverlayBtn");

const questionAreaEl = document.getElementById("questionArea");
const countdownDisplayEl = document.getElementById("countdownDisplay");
const questionTextEl = document.getElementById("questionText");
const choicesContainerEl = document.getElementById("choicesContainer");

const endGameAreaEl = document.getElementById("endGameArea");
const endGameSummaryEl = document.getElementById("endGameSummary");

const joinGameBtn = document.getElementById("joinGameBtn");
const entryLandingEl = document.getElementById("entryLanding");   // หน้าแรกปุ่ม Join Game
const adminEntryPageEl = document.getElementById("adminEntryPage");
const playerEntryPageEl = document.getElementById("playerEntryPage");
const backToLandingBtn1 = document.getElementById("backToLandingBtn1");
const backToLandingBtn2 = document.getElementById("backToLandingBtn2");

/* =========================
   5) Runtime State
========================= */
let didRestoreSession = false;

let currentRoomCode = null;
let currentRole = null; // "host" | "player"
let currentPlayerId = null;

let roomUnsub = null;

let timerInterval = null;
let timerPhase = null;
let timerRound = 0;
// (refactor) ให้ timer เป็นตัวขับ countdown → ไม่ใช้ autoTimeout ซ้ำ
let countdownAutoTimeout = null;

let rollPending = false; // ✅ กันกดทอยซ้ำระหว่างรอ DB sync
let answerPending = false;

// Dice overlay state
let diceOverlayState = "hidden"; // hidden | rolling | committing | done

/* =========================
   6) Utils
========================= */
const raf = () => new Promise((r) => requestAnimationFrame(r));
const rand360 = () => Math.floor(Math.random() * 360);
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

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
  if (hostNameInput) hostNameInput.disabled = lockHost;
  if (createRoomBtn) createRoomBtn.disabled = lockHost;
  if (confirmCreateRoomBtn) confirmCreateRoomBtn.disabled = lockHost;

  // Player block
  if (roomCodeInput) roomCodeInput.disabled = lockPlayer;
  if (playerNameInput) playerNameInput.disabled = lockPlayer;
  if (joinRoomBtn) joinRoomBtn.disabled = lockPlayer;
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

function updateHeaderActionsUI(roomData = null) {
  const onLanding = entryLandingEl && entryLandingEl.style.display !== "none";
  const onAdminEntry = adminEntryPageEl && adminEntryPageEl.style.display !== "none";
  const onPlayerEntry = playerEntryPageEl && playerEntryPageEl.style.display !== "none";

  const inEntry = !onLanding && (onAdminEntry || onPlayerEntry);

  const status = roomData?.status || null;
  const inRoom = !!currentRoomCode && !!currentRole; // เข้าห้องแล้ว (lobby/inGame/finished)

  // 1) Admin: เฉพาะหน้าแรกเท่านั้น
  if (adminTopBtn) adminTopBtn.style.display = onLanding ? "inline-flex" : "none";

  // 2) Exit: แสดงเมื่อ "เข้าห้องแล้ว" (รวม lobby ก่อนเริ่มเกมด้วย!)
  //    และให้ไปแทนที่ Home
  const showExit = inRoom && (status === STATUS.LOBBY || status === STATUS.IN_GAME || status === STATUS.FINISHED);

  if (headerExitBtn) {
    headerExitBtn.style.display = showExit ? "inline-flex" : "none";
    if (showExit) headerExitBtn.textContent = currentRole === "host" ? "ยกเลิกห้อง" : "ออกจากห้อง";
  }

  // 3) Home: แสดงเฉพาะตอนอยู่หน้า entry (adminEntry/playerEntry)
  //    แต่ถ้า showExit = true ให้ซ่อน Home (เพราะ Exit มาแทน)
  const showHome = inEntry && !showExit;

  if (headerHomeBtn) {
    headerHomeBtn.style.display = showHome ? "inline-flex" : "none";
  }
}

/* =========================
   7) Entry Navigation (SPA)
========================= */
function showEntryLanding() {
  if (entryLandingEl) entryLandingEl.style.display = "block";
  if (adminEntryPageEl) adminEntryPageEl.style.display = "none";
  if (playerEntryPageEl) playerEntryPageEl.style.display = "none";

  if (hostGameOptionsEl) hostGameOptionsEl.classList.remove("is-open");

  // enable entry inputs
  if (hostNameInput) hostNameInput.disabled = false;
  if (createRoomBtn) createRoomBtn.disabled = false;
  if (confirmCreateRoomBtn) confirmCreateRoomBtn.disabled = false;

  if (roomCodeInput) roomCodeInput.disabled = false;
  if (playerNameInput) playerNameInput.disabled = false;
  if (joinRoomBtn) joinRoomBtn.disabled = false;

  entryLandingEl?.scrollIntoView({ behavior: "smooth", block: "start" });

  updateHeaderActionsUI(null);
}

function showAdminEntryPage() {
  if (entryLandingEl) entryLandingEl.style.display = "none";
  if (adminEntryPageEl) adminEntryPageEl.style.display = "grid";
  if (playerEntryPageEl) playerEntryPageEl.style.display = "none";

  adminEntryPageEl?.scrollIntoView({ behavior: "smooth", block: "start" });

  updateHeaderActionsUI(null);
}

function showPlayerEntryPage() {
  if (entryLandingEl) entryLandingEl.style.display = "none";
  if (adminEntryPageEl) adminEntryPageEl.style.display = "none";
  if (playerEntryPageEl) playerEntryPageEl.style.display = "grid";

  playerEntryPageEl?.scrollIntoView({ behavior: "smooth", block: "start" });

  updateHeaderActionsUI(null);
}

/* =========================
   8) Admin PIN Overlay
========================= */
function openAdminPwOverlay() {
  if (!adminPwOverlayEl || !adminPwInputEl) {
    alert("ไม่พบหน้ากรอกรหัส Admin (#adminPwOverlay / #adminPwInput) กรุณาตรวจสอบ index.html");
    return;
  }

  adminPwInputEl.value = "";
  if (adminPwErrorEl) adminPwErrorEl.style.display = "none";

  adminPwOverlayEl.style.display = "flex";
  setTimeout(() => adminPwInputEl.focus(), 0);
}

function closeAdminPwOverlay() {
  if (adminPwOverlayEl) adminPwOverlayEl.style.display = "none";
  if (adminPwInputEl) adminPwInputEl.value = "";
  if (adminPwErrorEl) adminPwErrorEl.style.display = "none";
}

function failPin() {
  if (adminPwErrorEl) adminPwErrorEl.style.display = "block";
  if (adminPwInputEl) {
    adminPwInputEl.value = "";
    adminPwInputEl.focus();
  }
}

// Bind admin pin
adminTopBtn?.addEventListener("click", () => {
  if (currentRole === "host" && currentRoomCode) return;
  openAdminPwOverlay();
});
adminPwCancelBtn?.addEventListener("click", closeAdminPwOverlay);
adminPwOverlayEl?.addEventListener("click", (e) => {
  if (e.target === adminPwOverlayEl) closeAdminPwOverlay();
});
adminPwInputEl?.addEventListener("input", () => {
  let v = String(adminPwInputEl.value || "");
  v = v.replace(/\D/g, "").slice(0, 4);
  adminPwInputEl.value = v;

  if (adminPwErrorEl) adminPwErrorEl.style.display = "none";

  if (v.length === 4) {
    if (v === ADMIN_PIN) {
      closeAdminPwOverlay();
      showAdminEntryPage();
    } else {
      failPin();
    }
  }
});
adminPwInputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") e.preventDefault();
});

// ---- DEBUG DOM wiring ----
(function logEntryDomWiring() {
  const items = {
    adminTopBtn,
    joinGameBtn,
    entryLandingEl,
    adminEntryPageEl,
    playerEntryPageEl,
    backToLandingBtn1,
    backToLandingBtn2,
  };

  console.groupCollapsed("%c[ENTRY DOM] wiring check", "color:#5a4bb0;font-weight:900;");
  for (const [k, el] of Object.entries(items)) {
    console.log(k, el ? "✅ found" : "❌ MISSING", el || "");
  }
  console.groupEnd();
})();

// Landing events
joinGameBtn?.addEventListener("click", () => {
  console.log("[ENTRY] Join Game clicked -> playerEntryPage");
  if (!playerEntryPageEl) {
    alert("ไม่พบหน้า Player (#playerEntryPage) กรุณาตรวจสอบ id ใน index.html");
    return;
  }
  showPlayerEntryPage();
});

/* =========================
   9) Lobby View + Subscribe
========================= */
function enterLobbyView() {
  if (lobbyEl) lobbyEl.style.display = "block";
  setEntryVisible(false);

  if (cancelRoomBtn) cancelRoomBtn.style.display = "none";
  if (leaveRoomBtn) leaveRoomBtn.style.display = "none";

  if (roleInfoEl) roleInfoEl.textContent = "";
  setHeaderPills();
}

function subscribeRoom(roomCode) {
  if (roomUnsub) {
    try { roomUnsub(); } catch {}
    roomUnsub = null;
  }

  const roomRef = ref(db, `rooms/${roomCode}`);
  roomUnsub = onValue(roomRef, (snapshot) => {
    try {
      if (!snapshot.exists()) {
        resetToHome("ห้องนี้ถูกยกเลิก/ปิดแล้ว");
        return;
      }

      const roomData = snapshot.val();
      const players = roomData.players || {};

      updateHeaderActionsUI(roomData);
      
      // เงื่อนไข "เริ่มเล่นแล้ว" (ง่ายสุด = status inGame/finished)
      if (roomData.status === STATUS.IN_GAME || roomData.status === STATUS.FINISHED) {
        enterInGameLayout();
      } else {
        exitInGameLayout();
      }

      console.log("[ROOM UPDATE]", {
        roomCode,
        status: roomData.status,
        phase: roomData.phase,
        playerCount: Object.keys(players).length,
        currentRole,
      });

      renderLobbyBadges(roomData);
      renderPlayerList(roomData, players);
      updateGameView(roomData, players);
      updateStartGameButton(roomData, players);
    } catch (e) {
      console.error("[subscribeRoom] crashed:", e);
    }
  });
}

function updateStartGameButton(roomData, players) {
  if (!startGameBtn) return;

  const totalPlayers = Object.keys(players || {}).length;
  const shouldShow =
    currentRole === "host" &&
    currentRoomCode &&
    roomData?.status === "lobby" &&
    totalPlayers > 0;

  startGameBtn.style.display = shouldShow ? "inline-flex" : "none";
  startGameBtn.disabled = !shouldShow;
}

function enterInGameLayout() {
  document.body.classList.add("in-game");

  const lobby = document.getElementById("lobby");
  const lobbyCard = lobby ? lobby.querySelector(".lobby-card") : null;
  const host = document.getElementById("lobbyCardHost");
  if (lobbyCard && host && !host.contains(lobbyCard)) {
    host.appendChild(lobbyCard);
  }
}

function exitInGameLayout() {
  document.body.classList.remove("in-game");

  const lobby = document.getElementById("lobby");
  const lobbyCard = document.querySelector("#lobbyCardHost .lobby-card");
  const host = document.getElementById("lobbyCardHost");
  if (lobbyCard && lobby && host) {
    lobby.appendChild(lobbyCard);
  }
  if (host) host.style.display = "none"; // เผื่อ inline ถูกตั้งไว้
}

function isInGame(roomData) {
  // เกณฑ์ที่ “ชัวร์” ว่าเริ่มเล่นแล้ว (คุณปรับได้ตามโครงสร้าง roomData ของคุณ)
  const round = Number(roomData?.currentRound || 0);
  const phase = roomData?.phase;
  return round > 0 || phase === PHASE.ROUND_READY || phase === PHASE.QUESTION_COUNTDOWN || phase === PHASE.ANSWERING || phase === PHASE.REVEALING || phase === PHASE.ROUND_RESULT || phase === PHASE.GAME_OVER;
}

headerHomeBtn?.addEventListener("click", () => {
  // ใช้ได้เฉพาะช่วง entry (ยังไม่เข้าห้อง)
  showEntryLanding();
  updateHeaderActionsUI(null);
});

headerExitBtn?.addEventListener("click", async () => {
  if (currentRole === "host") await cancelRoomFlow();
  else if (currentRole === "player") await leaveRoomFlow();
});

/* =========================
   10) Dice Overlay State Machine
========================= */
function setDiceOverlayState(state, rollValue = null, hint = null) {
  diceOverlayState = state;

  if (!diceOverlayEl) return;

  if (state === "hidden") {
    diceOverlayEl.style.display = "none";
    if (closeDiceOverlayBtn) closeDiceOverlayBtn.style.display = "none";
    return;
  }

  diceOverlayEl.style.display = "flex";

  if (diceHintEl) {
    if (hint != null) diceHintEl.textContent = hint;
    else {
      if (state === "rolling") diceHintEl.textContent = "ลูกเต๋ากำลังกลิ้ง…";
      else if (state === "committing") diceHintEl.textContent = `ได้แต้ม: ${rollValue ?? "-"} (กำลังบันทึกผล…)`;
      else if (state === "done") diceHintEl.textContent = rollValue != null ? `ได้แต้ม: ${rollValue}` : "เสร็จแล้ว";
    }
  }

  if (!closeDiceOverlayBtn) return;

  if (state === "rolling" || state === "committing") {
    closeDiceOverlayBtn.style.display = "inline-flex";
    closeDiceOverlayBtn.disabled = true;
  } else if (state === "done") {
    closeDiceOverlayBtn.style.display = "inline-flex";
    closeDiceOverlayBtn.disabled = false;
  }
}

closeDiceOverlayBtn?.addEventListener("click", () => {
  if (diceOverlayState !== "done") return;
  setDiceOverlayState("hidden");
  document.getElementById("gameArea")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

/* =========================
   11) Restore Session + Boot (single entry point)
========================= */
async function attemptRestoreSession() {
  try {
    const raw = STORAGE.getItem(STORAGE_KEY);
    if (!raw) return false;

    let s = null;
    try {
      s = JSON.parse(raw);
    } catch {
      STORAGE.removeItem(STORAGE_KEY);
      return false;
    }

    if (!s?.room || !s?.role) return false;

    const roomCode = String(s.room).trim().toUpperCase();
    if (!roomCode) return false;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return false;

    const roomData = snap.val();
    const players = roomData.players || {};

    if (s.role === "host") {
      didRestoreSession = true;
      currentRoomCode = roomCode;
      currentRole = "host";
      currentPlayerId = null;

      console.log("[RESTORE] host", { roomCode });

      enterLobbyView();
      subscribeRoom(currentRoomCode);
      lockEntryUIForRole("host");
      return true;
    }

    if (s.role === "player") {
      const pid = s.pid ? String(s.pid) : null;
      if (!pid || !players[pid]) return false;

      didRestoreSession = true;
      currentRoomCode = roomCode;
      currentRole = "player";
      currentPlayerId = pid;

      console.log("[RESTORE] player", { roomCode, pid, name: players[pid]?.name });

      enterLobbyView();
      subscribeRoom(currentRoomCode);
      lockEntryUIForRole("player");
      return true;
    }

    return false;
  } catch (e) {
    console.warn("restore session failed:", e);
    return false;
  }
}

async function boot() {
  const restored = await attemptRestoreSession();
  if (!restored) {
    showEntryLanding();
  }
}
boot();

/* =========================
   12) Host Actions (Create room, Start game, Start round, Start question, Reveal)
========================= */
// Host: Step 1 – เปิด panel ตั้งค่าเกม
createRoomBtn?.addEventListener("click", () => {
  const hostName = (hostNameInput?.value || "").trim();

  if (!hostName) {
    alert("กรุณากรอกชื่อของ Host ก่อน");
    return;
  }

  if (hostNameInput) hostNameInput.disabled = true;
  if (createRoomBtn) createRoomBtn.disabled = true;

  if (!hostGameOptionsEl) {
    alert("ไม่พบแผงตั้งค่าเกม (#hostGameOptions) กรุณาตรวจสอบ id ใน index.html");
    if (hostNameInput) hostNameInput.disabled = false;
    if (createRoomBtn) createRoomBtn.disabled = false;
    return;
  }

  const card = createRoomBtn.closest(".card");
  if (card) {
    const h = card.getBoundingClientRect().height;
    card.classList.add("lock-height");
    card.style.height = `${h}px`;
  }

  hostGameOptionsEl.classList.add("is-open");
  hostGameOptionsEl.style.display = "block";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (card) {
        card.style.height = "";
        card.classList.remove("lock-height");
      }
    });
  });

  console.log("[UI] open hostGameOptions");
});

// Host Step 2: create room
confirmCreateRoomBtn?.addEventListener("click", async () => {
  const hostName = (hostNameInput?.value || "").trim();
  if (!hostName) {
    alert("กรุณากรอกชื่อของ Host");
    return;
  }

  const questionSetId = questionSetSelect?.value || "general";
  const maxRounds = Math.max(1, parseInt(maxRoundsInput?.value, 10) || 10);
  const maxWinners = Math.max(1, parseInt(maxWinnersInput?.value, 10) || 5);

  const rewardRaw = parseInt(rewardCorrectInput?.value, 10);
  const rewardCorrect = Number.isFinite(rewardRaw) ? rewardRaw : 1;

  const penaltyRaw = parseInt(penaltyWrongInput?.value, 10);
  const penaltyWrong = Number.isFinite(penaltyRaw) ? -Math.abs(penaltyRaw) : -1;

  const roomRefBase = (code) => ref(db, `rooms/${code}`);

  let roomCode = null;
  for (let i = 0; i < 6; i++) {
    const c = createRoomCode();
    const s = await get(roomRefBase(c));
    if (!s.exists()) { roomCode = c; break; }
  }
  if (!roomCode) {
    alert("สร้างห้องไม่สำเร็จ (รหัสชนกันหลายครั้ง) ลองใหม่อีกครั้ง");
    if (hostNameInput) hostNameInput.disabled = false;
    if (createRoomBtn) createRoomBtn.disabled = false;
    return;
  }

  const hostId = createId("host");

  currentRoomCode = roomCode;
  currentRole = "host";
  currentPlayerId = null;

  try {
    await set(roomRefBase(roomCode), {
      createdAt: Date.now(),
      status: STATUS.LOBBY,
      hostId,
      hostName,
      boardSize: BOARD_SIZE,
      currentRound: 0,
      phase: PHASE.IDLE,
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
        rewardCorrect,
        penaltyWrong,
      },
    });

    if (hostGameOptionsEl) hostGameOptionsEl.classList.remove("is-open");
    enterLobbyView();
    subscribeRoom(roomCode);
    lockEntryUIForRole("host");
    saveSession();

    alert(`สร้างห้องสำเร็จ!\nRoom Code: ${roomCode}\nแชร์รหัสนี้ให้นักเรียนใช้ Join ได้เลย`);
  } catch (err) {
    console.error("Error creating room:", err);
    alert("มีปัญหาในการสร้างห้อง ดู error ใน Console");
    if (hostNameInput) hostNameInput.disabled = false;
    if (createRoomBtn) createRoomBtn.disabled = false;
  }
});

// Host: Start Game
startGameBtn?.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;

  const roomData = snap.val();
  const players = roomData.players || {};
  const totalPlayers = Object.keys(players).length;

  if (roomData.status !== STATUS.LOBBY) {
    alert("ห้องนี้เริ่มเกมแล้ว");
    return;
  }
  if (totalPlayers <= 0) {
    alert("ยังไม่มีผู้เล่นเข้าห้อง");
    return;
  }

  await update(roomRef, {
    status: STATUS.IN_GAME,
    phase: PHASE.IDLE,
    gameStartedAt: Date.now(),
  });

  // ✅ INSERT ตรงนี้ (ให้ Host เปลี่ยน layout ทันที)
  enterInGameLayout();

  document.getElementById("gameArea")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Host: Start New Round (Transaction)
startRoundBtn?.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room) return room;

    const phase = room.phase || PHASE.IDLE;
    if (phase === PHASE.ENDED) return;

    if (phase === PHASE.QUESTION_COUNTDOWN || phase === PHASE.ANSWERING) return;
    if (phase !== PHASE.IDLE && phase !== PHASE.RESULT) return;
    if (room.status !== STATUS.IN_GAME) return;

    const gs = room.gameSettings || {};
    const maxRounds = Math.max(1, gs.maxRounds ?? 10);
    const currentRound = room.currentRound || 0;
    if (currentRound >= maxRounds) return;

    const players = room.players || {};
    const questionSetLen = getQuestionSetLengthForRoom(room);

    const newRound = currentRound + 1;
    room.currentRound = newRound;
    room.phase = PHASE.ROLLING;
    room.questionIndex = (newRound - 1) % (questionSetLen || 1);
    room.questionCountdownStartAt = null;
    room.answerStartAt = null;
    room.answerTimeSeconds = null;
    room.answerDeadlineExpired = false;

    for (const [pid, p] of Object.entries(players)) {
      const posNow = clampPos(p.position);
      p.startOfRoundPos = posNow;

      if (p.finished || posNow >= BOARD_SIZE) {
        p.hasRolled = true;
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

/* =========================
   13) Dice 3D Engine (as-is)
========================= */
function waitTransformEnd(el, timeoutMs = 6500) {
  return new Promise((resolve) => {
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      el.removeEventListener("transitionend", onEnd);
      clearTimeout(t);
      resolve();
    };

    const onEnd = (e) => {
      if (e.target === el && e.propertyName === "transform") cleanup();
    };

    el.addEventListener("transitionend", onEnd, { once: false });
    const t = setTimeout(cleanup, timeoutMs);
  });
}

const FACE_CLASS_TO_VALUE = {
  "face-1": 5, // FRONT
  "face-2": 4, // RIGHT
  "face-3": 1, // TOP
  "face-4": 6, // BOTTOM
  "face-5": 3, // LEFT
  "face-6": 2, // BACK
};

function getTopVisibleValue() {
  const faces = dice3dEl?.querySelectorAll(".face");
  if (!faces || faces.length === 0) return null;

  let best = { y: Infinity, value: null };

  faces.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const cy = rect.top + rect.height / 2;
    const cls = [...el.classList].find((c) => /^face-\d$/.test(c));
    const value = FACE_CLASS_TO_VALUE[cls];
    if (value != null && cy < best.y) best = { y: cy, value };
  });

  return best.value;
}

let TOP_VISIBLE_TO_POSES = null;

function genPoseList() {
  const A = [0, 90, 180, 270];
  const poses = [];
  for (const x of A) for (const y of A) for (const z of A) poses.push({ x, y, z, key: `${x}_${y}_${z}` });
  return poses;
}

async function buildTopVisiblePoseMap() {
  if (!dice3dEl) return null;

  const poses = genPoseList();
  const map = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  const prevTransition = dice3dEl.style.transition;
  const prevTransform = dice3dEl.style.transform;

  dice3dEl.style.transition = "none";

  for (const p of poses) {
    dice3dEl.style.transform = `rotateX(${p.x}deg) rotateY(${p.y}deg) rotateZ(${p.z}deg)`;
    await raf();
    const topVal = getTopVisibleValue();
    if (topVal >= 1 && topVal <= 6) map[topVal].push(p);
  }

  dice3dEl.style.transform = prevTransform;
  dice3dEl.style.transition = prevTransition;

  console.log("[DICE] TOP_VISIBLE_TO_POSES built:", Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, v.length])
  ));

  return map;
}

function prepDiceForAnimate(el) {
  if (!el) return;
  try { el.getAnimations().forEach((a) => a.cancel()); } catch {}
  el.style.transition = "none";
  el.getBoundingClientRect();
}

function nearestEquivalentDeg(currentDeg, targetDeg) {
  const c = Number(currentDeg) || 0;
  const t = Number(targetDeg) || 0;
  const n = Math.round((c - t) / 360);
  return t + 360 * n;
}

function easeOutPow(t, p = 3.2) {
  return 1 - Math.pow(1 - t, p);
}

async function animateRollToPick(el, pick, rollMs) {
  prepDiceForAnimate(el);

  const s = { x: randInt(-18, 18), y: rand360(), z: randInt(-18, 18) };
  const kx = randInt(1, 3);
  const ky = randInt(2, 4);
  const kz = randInt(1, 3);

  const end = { x: pick.x + 360 * kx, y: pick.y + 360 * ky, z: pick.z + 360 * kz };

  const T = [0, 0.22, 0.48, 0.72, 0.88, 1.0];
  const frames = T.map((tt) => {
    const f = easeOutPow(tt, 3.2);
    const ax = s.x + (end.x - s.x) * f;
    const ay = s.y + (end.y - s.y) * f;
    const az = s.z + (end.z - s.z) * f;
    return { offset: tt, transform: `rotateX(${ax}deg) rotateY(${ay}deg) rotateZ(${az}deg)` };
  });

  const anim = el.animate(frames, { duration: rollMs, easing: "linear", fill: "forwards" });
  await anim.finished;

  try { el.getAnimations().forEach((a) => a.cancel()); } catch {}
  el.style.transition = "none";
  el.style.transform = `rotateX(${end.x}deg) rotateY(${end.y}deg) rotateZ(${end.z}deg)`;

  return { s, end };
}

async function settleToPick(el, pick, settleMs, endAbs) {
  const targetAbs = {
    x: nearestEquivalentDeg(endAbs?.x ?? pick.x, pick.x),
    y: nearestEquivalentDeg(endAbs?.y ?? pick.y, pick.y),
    z: nearestEquivalentDeg(endAbs?.z ?? pick.z, pick.z),
  };

  const t = Math.max(0, Math.floor(settleMs));

  if (t > 0) {
    el.style.transition = `transform ${t}ms cubic-bezier(.18,.92,.22,1)`;
    el.style.transform = `rotateX(${targetAbs.x}deg) rotateY(${targetAbs.y}deg) rotateZ(${targetAbs.z}deg)`;
    await waitTransformEnd(el, t + 120);
  }

  el.style.transition = "none";
  el.style.transform = `rotateX(${pick.x}deg) rotateY(${pick.y}deg) rotateZ(${pick.z}deg)`;
  await raf();
}

function logDiceState(stage, finalRoll, endObj) {
  try {
    const cam = document.querySelector(".dice-cam");
    const dice = document.getElementById("dice3d");

    console.log(
      `%c[DICE LOG] ${stage}`,
      "color:#5a4bb0;font-weight:900;",
      {
        finalRoll,
        endObj,
        dice_style_transform: dice?.style?.transform || "",
        dice_computed_transform: dice ? getComputedStyle(dice).transform : "",
        cam_style_transform: cam?.style?.transform || "",
        cam_computed_transform: cam ? getComputedStyle(cam).transform : "",
        ts: Date.now(),
      }
    );
  } catch (e) {
    console.warn("[DICE LOG] failed:", e);
  }
}

const rollDiceWithOverlay = async (durationMs = 5000) => {
  const finalRoll = Math.floor(Math.random() * 6) + 1;
  logDiceState("before-roll", finalRoll, null);

  if (!diceOverlayEl || !dice3dEl) return finalRoll;

  setDiceOverlayState("rolling", null, "ลูกเต๋ากำลังกลิ้ง…");
  await raf(); await raf();

  prepDiceForAnimate(dice3dEl);
  await raf();

  if (!TOP_VISIBLE_TO_POSES) {
    TOP_VISIBLE_TO_POSES = await buildTopVisiblePoseMap();
  }
  const candidates = TOP_VISIBLE_TO_POSES?.[finalRoll] || [];
  const pick = candidates.length ? candidates[randInt(0, candidates.length - 1)] : { x: 0, y: 0, z: 0 };

  const rollMs = Math.max(2000, Math.floor(durationMs * 0.94));
  const settleMs = Math.max(80, durationMs - rollMs);

  logDiceState("computed-end-before-animate", finalRoll, { pick, rollMs, settleMs });

  const { end } = await animateRollToPick(dice3dEl, pick, rollMs);
  await settleToPick(dice3dEl, pick, settleMs, end);

  const seenTop = getTopVisibleValue?.();
  if (seenTop != null && seenTop !== finalRoll) {
    console.warn("[DICE SNAP MISMATCH]", { finalRoll, seenTop, pick });
  }
  logDiceState("after-snap-final", finalRoll, { pick, seenTop });

  return finalRoll;
};

// debug
window.__SQ_rollDiceWithOverlay = rollDiceWithOverlay;

/* =========================
   14) Player Actions (Join, Roll, Submit)
========================= */
// Player: Join Room
joinRoomBtn?.addEventListener("click", async () => {
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

  if (roomData.status !== STATUS.LOBBY || (roomData.currentRound || 0) > 0) {
    alert("ห้องนี้เริ่มเกมแล้ว ไม่สามารถ Join เพิ่มได้");
    return;
  }

  const hostNameKey = String(roomData.hostName || "").trim().toLowerCase();
  if (hostNameKey && hostNameKey === playerNameKey) {
    alert("ชื่อนี้ซ้ำกับชื่อ Host กรุณาใช้ชื่ออื่น");
    return;
  }

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

// Player: Roll Dice (Transaction-safe)
rollDiceBtn?.addEventListener("click", async () => {
  if (currentRole !== "player" || !currentRoomCode || !currentPlayerId) return;
  if (rollPending) return;

  rollPending = true;
  rollDiceBtn.disabled = true;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);

  try {
    const snap = await get(roomRef);
    if (!snap.exists()) {
      rollPending = false;
      rollDiceBtn.disabled = false;
      return;
    }

    const roomData = snap.val();
    if (roomData.phase !== PHASE.ROLLING) {
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

    const roll = await rollDiceWithOverlay(5000);

    setDiceOverlayState("committing", roll, `ได้แต้ม: ${roll} (กำลังบันทึกผล…)`);

    const ok = await finalizeRollTransaction(roll);
    if (!ok) {
      setDiceOverlayState("done", roll, "บันทึกผลไม่สำเร็จ (สถานะห้องเปลี่ยน) ลองกดทอยใหม่หรือรอ Host");
      rollPending = false;
      rollDiceBtn.disabled = false;
      return;
    }

    setDiceOverlayState("done", roll, `ได้แต้ม: ${roll}`);
    // ปล่อยให้ DB sync มาปลด rollPending ใน updateRoleControls
  } catch (e) {
    console.error(e);
    setDiceOverlayState("hidden");
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

    if (room.phase !== PHASE.ROLLING) return;
    if ((room.currentRound || 0) <= 0) return;

    const players = room.players || {};
    const me = players[currentPlayerId];
    if (!me) return;

    const pos = clampPos(me.position);
    const finished = !!me.finished || pos >= BOARD_SIZE;
    if (finished) return;
    if (me.hasRolled) return;

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
      room.phase = PHASE.ENDED;
      room.status = STATUS.FINISHED;
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

// Player: Submit Answer (Transaction-safe)
async function submitAnswerTx(optionKey) {
  if (currentRole !== "player" || !currentRoomCode || !currentPlayerId) return;
  if (answerPending) return;

  answerPending = true;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const now = Date.now();

  try {
    const tx = await runTransaction(roomRef, (room) => {
      if (!room) return;
      if (room.phase !== PHASE.ANSWERING) return;

      const startAt = room.answerStartAt;
      const duration = room.answerTimeSeconds;

      if (!Number.isFinite(startAt) || !Number.isFinite(duration)) return;

      const expired = now > (startAt + duration * 1000);

      if (room.answerDeadlineExpired === true || expired) {
        room.answerDeadlineExpired = true;
        return room;
      }

      const players = room.players || {};
      const me = players[currentPlayerId];
      if (!me) return;

      const pos = clampPos(me.position);
      if (me.finished || pos >= BOARD_SIZE) return;
      if (me.answered) return;

      me.answer = optionKey;
      me.answered = true;
      players[currentPlayerId] = me;
      room.players = players;

      return room;
    });

    if (!tx.committed) {
      const snap = await get(roomRef);
      if (!snap.exists()) {
        alert("ส่งคำตอบไม่สำเร็จ (ไม่พบห้องแล้ว)");
        return;
      }

      const room = snap.val();
      if (room.phase !== PHASE.ANSWERING) {
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

      if (me.answered) return;

      alert("ส่งคำตอบไม่สำเร็จ (ลองใหม่)");
      return;
    }

    const after = tx.snapshot?.val?.() || null;
    const meAfter = after?.players?.[currentPlayerId] || null;

    if (after?.answerDeadlineExpired === true) {
      alert("ส่งคำตอบไม่สำเร็จ (หมดเวลาแล้ว)");
      return;
    }

    if (!meAfter || meAfter.answered !== true || meAfter.answer !== optionKey) {
      alert("ส่งคำตอบไม่สำเร็จ (ลองใหม่)");
      return;
    }
  } catch (e) {
    console.error("submitAnswerTx failed:", e);
    alert("ส่งคำตอบไม่สำเร็จ (เครือข่าย/ระบบมีปัญหา ลองใหม่)");
  } finally {
    answerPending = false;
  }
}

/* =========================
   15) Host Question Flow (Start Question, Countdown->Answering, Reveal)
========================= */
startQuestionBtn?.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const now = Date.now();

  const tx = await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.phase !== PHASE.ROLLING) return;

    const players = room.players || {};
    const activePlayers = Object.values(players).filter((p) => !p.finished && clampPos(p.position) < BOARD_SIZE);
    const totalActive = activePlayers.length;
    const rolledCount = activePlayers.filter((p) => !!p.hasRolled).length;
    if (totalActive > 0 && rolledCount < totalActive) return;

    const questionIndex = room.questionIndex ?? 0;
    const q = getQuestionFromRoom(room, questionIndex);
    if (!q) return;

    room.phase = PHASE.QUESTION_COUNTDOWN;
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

  clearTimer();
  // (refactor) ให้ timer เป็นตัว advance เพียงทางเดียว
});

async function moveCountdownToAnsweringTx() {
  if (!currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const now = Date.now();

  await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.phase !== PHASE.QUESTION_COUNTDOWN) return; // ถ้าเลยไปแล้ว ไม่ต้องทำอะไร

    room.phase = PHASE.ANSWERING;
    room.answerStartAt = now;
    room.answerDeadlineExpired = false;

    return room;
  });
}

revealAnswerBtn?.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const now = Date.now();

  const tx = await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.phase !== PHASE.ANSWERING) return;

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
        answered = false;
        ans = null;
        correct = null;
        configuredMove = 0;
        finalPos = basePos;
      }

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
      room.phase = PHASE.ENDED;
      room.status = STATUS.FINISHED;
      room.endInfo = {
        endedAt: now,
        endReason,
        maxRounds,
        maxWinners,
        winnerCount: room.winners.length,
      };
    } else {
      room.phase = PHASE.RESULT;
    }

    return room;
  });

  if (!tx.committed) alert("เฉลยไม่ได้ (phase ไม่ถูกต้อง)");
  clearTimer();
});

/* =========================
   16) Leave / Cancel Room
========================= */
async function leaveRoomFlow() {
  if (currentRoomCode && currentPlayerId) {
    try {
      await remove(ref(db, `rooms/${currentRoomCode}/players/${currentPlayerId}`));
    } catch (e) {
      console.warn("remove player failed:", e);
    }
  }
  resetToHome("ออกจากห้องเรียบร้อย");
  updateHeaderActionsUI(null);
}

async function cancelRoomFlow() {
  if (currentRole !== "host" || !currentRoomCode) return;

  const ok = confirm("ต้องการยกเลิกห้องนี้ใช่ไหม? ผู้เล่นทุกคนจะถูกเตะออก");
  if (!ok) return;

  try {
    await set(ref(db, `rooms/${currentRoomCode}`), null);
  } catch (e) {
    console.error(e);
    alert("ยกเลิกห้องไม่สำเร็จ (ดู Console)");
    return;
  }
  resetToHome("ยกเลิกห้องเรียบร้อย");
  updateHeaderActionsUI(null);
}

leaveRoomBtn?.addEventListener("click", leaveRoomFlow);
cancelRoomBtn?.addEventListener("click", cancelRoomFlow);

/* =========================
   17) Render: Player List
========================= */
function renderPlayerList(roomData, playersObj) {
  if (!playerListEl) return;

  const players = playersObj || {};
  const entries = Object.entries(players);

  if (entries.length === 0) {
    playerListEl.innerHTML = `<div class="muted">ยังไม่มีผู้เล่นเข้าห้อง</div>`;
    return;
  }

  const history = roomData.history || {};

  const perPlayer = {};
  for (const [pid, p] of entries) {
    perPlayer[pid] = {
      id: pid,
      name: p.name || pid,
      position: clampPos(p.position),
      hasRolled: !!p.hasRolled,
      answered: !!p.answered,
      finished: !!p.finished || clampPos(p.position) >= BOARD_SIZE,
      rolls: [],
      answerSymbols: [],
    };
  }

  const roundKeys = Object.keys(history)
    .filter((k) => k.startsWith("round_"))
    .sort((a, b) => parseInt(a.split("_")[1] || "0", 10) - parseInt(b.split("_")[1] || "0", 10));

  for (const rk of roundKeys) {
    const roundData = history[rk] || {};
    const answers = roundData.answers || {};

    for (const [pid, rec] of Object.entries(answers)) {
      if (!perPlayer[pid]) continue;

      if (rec.diceRoll != null) perPlayer[pid].rolls.push(rec.diceRoll);

      const finalPos = rec.finalPosition ?? perPlayer[pid].position;
      const basePos = rec.basePosition ?? finalPos;
      const neutralFinishByDice =
        rec.correct == null &&
        rec.answered === false &&
        basePos >= BOARD_SIZE &&
        finalPos >= BOARD_SIZE;

      if (neutralFinishByDice) continue;

      if (rec.correct === true) perPlayer[pid].answerSymbols.push("✅");
      else perPlayer[pid].answerSymbols.push("❌");
    }
  }

  const list = Object.values(perPlayer).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  let html = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th class="name-col">ผู้เล่น</th>
          <th>ตำแหน่ง</th>
          <th>ทอยแล้ว</th>
          <th>ตอบแล้ว</th>
          <th>สถานะ</th>
          <th>ทอย (รวม)</th>
          <th>ผลคำถาม</th>
        </tr>
      </thead>
      <tbody>
  `;

  list.forEach((p, index) => {
    const rollsText = p.rolls.length ? p.rolls.join("") : "-";
    const ansText = p.answerSymbols.length ? p.answerSymbols.join("") : "-";

    html += `
      <tr>
        <td>${index + 1}</td>
        <td class="name-col">${escapeHtml(p.name)}</td>
        <td>${p.position}</td>
        <td>${p.hasRolled ? "🎲" : "-"}</td>
        <td>${p.answered ? "✍️" : "-"}</td>
        <td>${p.finished ? "🏁 เข้าเส้นชัย" : "-"}</td>
        <td>${rollsText}</td>
        <td>${ansText}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  playerListEl.innerHTML = html;
}

/* =========================
   18) Game View + Controls + Timer
========================= */
function updateGameView(roomData, players) {
  const round = roomData.currentRound || 0;
  const phase = roomData.phase || PHASE.IDLE;
  const deadlineExpired = roomData.answerDeadlineExpired === true;

  const status = roomData.status || STATUS.LOBBY;
  const showGameArea = (status === STATUS.IN_GAME) || (round > 0) || (phase === PHASE.ENDED);

  if (gameAreaEl) gameAreaEl.style.display = showGameArea ? "block" : "none";

  const gameBarEl = document.getElementById("gameBar");
  if (gameBarEl) gameBarEl.style.display = showGameArea ? "flex" : "none";

  if (roundInfoEl) {
    if (round > 0) roundInfoEl.textContent = `รอบที่: ${round}`;
    else if (status === STATUS.IN_GAME) roundInfoEl.textContent = `รอบที่: -`;
    else roundInfoEl.textContent = "ยังไม่ได้เริ่มรอบ";
  }

  let phaseText = "";
  switch (phase) {
    case PHASE.ROLLING: phaseText = "กำลังทอยลูกเต๋า"; break;
    case PHASE.QUESTION_COUNTDOWN: phaseText = "เตรียมคำถาม"; break;
    case PHASE.ANSWERING: phaseText = "กำลังตอบคำถาม"; break;
    case PHASE.RESULT: phaseText = "สรุปผลคำถามรอบนี้"; break;
    case PHASE.ENDED: phaseText = "เกมจบแล้ว"; break;
    default: phaseText = "รอ Host เริ่มรอบใหม่";
  }

  let hostSuffix = "";
  if (currentRole === "host") {
    const playerList = Object.values(players || {});
    const activePlayers = playerList.filter(p => !p.finished && (p.position || 1) < BOARD_SIZE);
    const totalActive = activePlayers.length;

    if (phase === PHASE.ROLLING) {
      const rolledActive = activePlayers.filter(p => !!p.hasRolled).length;
      hostSuffix = ` | ทอยแล้ว ${rolledActive}/${totalActive} คน`;
    } else if (phase === PHASE.ANSWERING) {
      const answeredActive = activePlayers.filter(p => !!p.answered).length;
      hostSuffix = ` | ตอบแล้ว ${answeredActive}/${totalActive} คน`;
      if (deadlineExpired) hostSuffix += " | หมดเวลาแล้ว";
    }
  }

  if (phaseInfoEl) {
    phaseInfoEl.textContent = round > 0 ? `[สถานะรอบ: ${phaseText}${hostSuffix}]` : "";
  }

  renderBoard(roomData, players);
  updateRoleControls(roomData, players);
  updateQuestionUI(roomData, players);

  const ended = (phase === PHASE.ENDED) || (status === STATUS.FINISHED);
  if (endGameAreaEl) endGameAreaEl.style.display = ended ? "block" : "none";
  if (ended) renderEndGameSummary(roomData, players);
}

function updateRoleControls(roomData, players) {
  const phase = roomData.phase || PHASE.IDLE;

  if (hostGameControlsEl) {
    hostGameControlsEl.style.display = currentRole === "host" ? "flex" : "none";
    hostGameControlsEl.style.visibility = "visible";
    hostGameControlsEl.style.pointerEvents = currentRole === "host" ? "auto" : "none";
  }

  if (playerGameControlsEl) {
    playerGameControlsEl.style.display = currentRole === "player" ? "flex" : "none";
    playerGameControlsEl.style.visibility = "visible";
    playerGameControlsEl.style.pointerEvents = currentRole === "player" ? "auto" : "none";
  }

  if (currentRole === "player") {
    const me = (players && currentPlayerId && players[currentPlayerId]) || {};
    const pos = me.position || 1;
    const finished = !!me.finished || pos >= BOARD_SIZE;
    const rolled = !!me.hasRolled;

    if (rollPending && (rolled || roomData.phase !== PHASE.ROLLING || finished)) {
      rollPending = false;
      if (rollDiceBtn) rollDiceBtn.textContent = "ทอยลูกเต๋า";
    }

    const rolledOrPending = rolled || rollPending;
    const canRoll = roomData.phase === PHASE.ROLLING && !rolledOrPending && !finished;

    if (rollDiceBtn) {
      rollDiceBtn.disabled = !canRoll;
      rollDiceBtn.style.display = "inline-flex";
    }
  } else {
    if (rollDiceBtn) rollDiceBtn.style.display = "none";
  }

  if (currentRole === "host") {
    const list = Object.values(players || {});
    const activePlayers = list.filter((p) => !p.finished && clampPos(p.position) < BOARD_SIZE);
    const totalActive = activePlayers.length;
    const rolledActive = activePlayers.filter((p) => p.hasRolled).length;

    if (startRoundBtn) startRoundBtn.disabled = (phase === PHASE.ENDED);

    if (startQuestionBtn) {
      startQuestionBtn.style.display = (phase === PHASE.ENDED) ? "none" : "inline-block";
      startQuestionBtn.disabled = !(phase === PHASE.ROLLING && (totalActive === 0 || rolledActive === totalActive));
    }

    if (revealAnswerBtn) {
      revealAnswerBtn.style.display = (phase === PHASE.ENDED) ? "none" : "inline-block";
      revealAnswerBtn.disabled = (phase !== PHASE.ANSWERING);
    }
  } else {
    if (startRoundBtn) startRoundBtn.disabled = true;
    if (startQuestionBtn) startQuestionBtn.style.display = "none";
    if (revealAnswerBtn) revealAnswerBtn.style.display = "none";
  }
}

function updateQuestionUI(roomData, players) {
  const phase = roomData.phase || PHASE.IDLE;
  const round = roomData.currentRound || 0;
  const questionIndex = roomData.questionIndex;
  const question = questionIndex != null ? getQuestionFromRoom(roomData, questionIndex) : null;

  if (round === 0) {
    if (questionAreaEl) questionAreaEl.style.display = "none";
    if (countdownDisplayEl) countdownDisplayEl.textContent = "";
    clearTimer();
    return;
  }

  if (phase === PHASE.QUESTION_COUNTDOWN) {
    if (questionAreaEl) questionAreaEl.style.display = "block";
    if (questionTextEl) questionTextEl.textContent = `เตรียมคำถามรอบที่ ${round} …`;
    if (choicesContainerEl) choicesContainerEl.innerHTML = "";
    ensureTimer(roomData, PHASE.QUESTION_COUNTDOWN);
    return;
  }

  if (phase === PHASE.ANSWERING && question) {
    if (questionAreaEl) questionAreaEl.style.display = "block";
    if (questionTextEl) questionTextEl.textContent = question.text;
  
    const me = players?.[currentPlayerId] || {};
    const selectedOption = me.answer || null;
  
    const startAt = roomData.answerStartAt;
    const duration = roomData.answerTimeSeconds;
  
    // ✅ fallback: phase เป็น answering แต่ยังไม่มีเวลาเริ่ม
    if (!Number.isFinite(startAt)) {
      if (countdownDisplayEl) countdownDisplayEl.textContent = "กำลังซิงค์เวลาเริ่ม…";
      // optional: เผื่อ DB ค้าง countdown จริง ๆ (tx จะไม่ทำอะไรถ้าไม่ใช่ countdown)
      if (currentRoomCode) moveCountdownToAnsweringTx().catch(() => {});
      // จะให้ตอบไม่ได้จนกว่า startAt มาจริง
      renderChoicesForPhase(question, selectedOption, question.correctOption, false, true);
      clearTimer();
      return;
    }
  
    const now = Date.now();
    const computedExpired =
      Number.isFinite(duration)
        ? now > (startAt + duration * 1000)
        : false;
  
    const deadlineExpired = roomData.answerDeadlineExpired === true || computedExpired;
    const disableButtons = deadlineExpired || !!me.finished;
  
    renderChoicesForPhase(question, selectedOption, question.correctOption, false, disableButtons);
    ensureTimer(roomData, PHASE.ANSWERING);
    return;
  }

  if (phase === PHASE.RESULT && question) {
    if (questionAreaEl) questionAreaEl.style.display = "block";
    if (questionTextEl) questionTextEl.textContent = `เฉลยรอบที่ ${round}: ${question.text}`;
    if (countdownDisplayEl) countdownDisplayEl.textContent = "";

    let selectedOption = null;
    if (currentRole === "player") {
      const me = players?.[currentPlayerId] || {};
      selectedOption = me.answer || null;
    }

    renderChoicesForPhase(question, selectedOption, question.correctOption, true, true);
    clearTimer();
    return;
  }

  if (questionAreaEl) questionAreaEl.style.display = "none";
  if (countdownDisplayEl) countdownDisplayEl.textContent = "";
  clearTimer();
}

function renderChoicesForPhase(question, selectedOption, correctOption, showResultOnly, disableAnswerButtons = false) {
  if (!choicesContainerEl) return;

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
  const phase = roomData.phase || PHASE.IDLE;
  const round = roomData.currentRound || 0;

  if (phase !== targetPhase || round === 0) {
    clearTimer();
    if (countdownDisplayEl) countdownDisplayEl.textContent = "";
    return;
  }
  if (timerPhase === phase && timerRound === round && timerInterval) return;

  clearTimer();
  timerPhase = phase;
  timerRound = round;

  if (phase === PHASE.QUESTION_COUNTDOWN) {
    const start = roomData.questionCountdownStartAt || Date.now();
    const duration = roomData.questionCountdownSeconds || 3;

    timerInterval = setInterval(() => {
      const now = Date.now();
      let remaining = Math.ceil((start + duration * 1000 - now) / 1000);
      if (remaining < 0) remaining = 0;

      if (countdownDisplayEl) countdownDisplayEl.textContent = `เริ่มตอบใน ${remaining} วินาที`;

      if (remaining <= 0) {
        clearTimer();
        if (currentRoomCode) {
          moveCountdownToAnsweringTx().catch((e) => console.error(e));
        }
      }
    }, 250);
  }

  if (phase === PHASE.ANSWERING) {
    const duration = roomData.answerTimeSeconds || 20;

    if (!Number.isFinite(roomData.answerStartAt)) {
      if (countdownDisplayEl) countdownDisplayEl.textContent = "กำลังรอ Host เริ่มจับเวลา…";
      return;
    }

    const start = roomData.answerStartAt;

    timerInterval = setInterval(() => {
      const now = Date.now();
      let remaining = Math.ceil((start + duration * 1000 - now) / 1000);
      if (remaining < 0) remaining = 0;

      if (countdownDisplayEl) countdownDisplayEl.textContent = `เหลือเวลา ${remaining} วินาที`;

      if (remaining <= 0) {
        clearTimer();

        if (currentRole === "host" && currentRoomCode && roomData.answerDeadlineExpired !== true) {
          const roomRef = ref(db, `rooms/${currentRoomCode}`);
          update(roomRef, { answerDeadlineExpired: true })
            .catch((e) => console.error("Error setting answerDeadlineExpired:", e));
        }
      }
    }, 250);
  }
}

/* =========================
   19) Board Rendering
========================= */
function renderBoard(roomData, players) {
  if (!boardEl) return;

  const currentRound = roomData.currentRound || 0;
  const history = roomData.history || {};

  boardEl.innerHTML = "";

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

  const sorted = Object.entries(players || {}).sort(([, a], [, b]) => String(a.name || "").localeCompare(String(b.name || "")));

  for (const [pid, p] of sorted) {
    const row = document.createElement("div");
    row.className = "player-row";

    const track = document.createElement("div");
    track.className = "board-track";

    const startCell = document.createElement("div");
    startCell.className = "cell-card start-cell";
    startCell.textContent = p.name || pid;
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

/* =========================
   20) End Game Summary
========================= */
function renderEndGameSummary(roomData, players) {
  const history = roomData.history || {};
  const winners = Array.isArray(roomData.winners) ? roomData.winners : [];
  const endInfo = roomData.endInfo || {};
  const gs = roomData.gameSettings || {};
  const maxRounds = gs.maxRounds ?? "-";
  const maxWinners = gs.maxWinners ?? "-";
  const endReason = endInfo.endReason || "unknown";

  let reasonText = "เกมจบแล้ว";
  if (endReason === "winners") {
    reasonText = `เกมจบเพราะมีผู้เข้าเส้นชัยครบ ${Math.min(
      Number(maxWinners) || 0,
      Object.keys(players || {}).length
    )} คน`;
  } else if (endReason === "rounds") {
    reasonText = `เกมจบเพราะเล่นครบ ${maxRounds} รอบแล้ว`;
  }

  const perPlayer = {};
  for (const [pid, p] of Object.entries(players || {})) {
    perPlayer[pid] = {
      id: pid,
      name: p.name || pid,
      finalPosition: p.position ?? 1,
      finished: !!p.finished || (p.position ?? 1) >= BOARD_SIZE,
      finishRound: p.finishedRound ?? null,
      finishBy: p.finishedBy ?? null,
      correct: 0,
      wrong: 0,
      timeout: 0,
      rolls: [],
      answerSymbols: [],
      pctCorrect: 0,
      rank: null,
    };
  }

  const roundKeys = Object.keys(history)
    .filter((k) => k.startsWith("round_"))
    .sort((a, b) => parseInt(a.split("_")[1] || "0", 10) - parseInt(b.split("_")[1] || "0", 10));

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

      if (Number.isFinite(finalPos)) s.finalPosition = finalPos;
      if (finalPos >= BOARD_SIZE && s.finishRound == null) {
        const rn = parseInt(rk.split("_")[1] || "0", 10);
        s.finishRound = rn;
      }
    }
  }

  for (const s of Object.values(perPlayer)) {
    const totalQ = s.correct + s.wrong + s.timeout;
    s.pctCorrect = totalQ > 0 ? (s.correct / totalQ) * 100 : 0;
  }

  const winMap = new Map();
  winners.forEach((w) => winMap.set(w.playerId, w));

  const stats = Object.values(perPlayer);

  stats.sort((a, b) => {
    const wa = winMap.has(a.id) ? (winMap.get(a.id).rank ?? 9999) : 9999;
    const wb = winMap.has(b.id) ? (winMap.get(b.id).rank ?? 9999) : 9999;
    if (wa !== wb) return wa - wb;

    const fa = a.finishRound ?? 9999;
    const fb = b.finishRound ?? 9999;
    if (fa !== fb) return fa - fb;

    if (b.finalPosition !== a.finalPosition) return b.finalPosition - a.finalPosition;
    if (b.pctCorrect !== a.pctCorrect) return b.pctCorrect - a.pctCorrect;
    return (a.name || "").localeCompare(b.name || "");
  });

  stats.forEach((s, i) => (s.rank = i + 1));

  let html = `<p><strong>สรุปผลเกม</strong></p>`;
  html += `<p><strong>${escapeHtml(reasonText)}</strong></p>`;

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
    const totalQ = s.correct + s.wrong + s.timeout;
    const pctText = totalQ > 0 ? `${Math.round(s.pctCorrect)}%` : "-";
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
        <td class="name-col">${escapeHtml(s.name)}</td>
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
  if (endGameSummaryEl) endGameSummaryEl.innerHTML = html;
}

/* =========================
   21) Reset / Cleanup
========================= */
function resetToHome(message) {
  clearTimer();

  if (roomUnsub) {
    try { roomUnsub(); } catch {}
    roomUnsub = null;
  }

  clearSession();

  currentRoomCode = null;
  currentRole = null;
  currentPlayerId = null;

  const gameBarEl = document.getElementById("gameBar");
  if (gameBarEl) gameBarEl.style.display = "none";

  if (lobbyEl) lobbyEl.style.display = "none";
  if (gameAreaEl) gameAreaEl.style.display = "none";
  if (endGameAreaEl) endGameAreaEl.style.display = "none";
  if (questionAreaEl) questionAreaEl.style.display = "none";
  if (countdownDisplayEl) countdownDisplayEl.textContent = "";

  if (playerListEl) playerListEl.innerHTML = "";
  if (boardEl) boardEl.innerHTML = "";
  if (roleInfoEl) roleInfoEl.textContent = "";

  if (lobbyBadgesEl) lobbyBadgesEl.innerHTML = "";

  setEntryVisible(true);
  showEntryLanding(); // (refactor) ให้กลับ landing ชัดเจน

  if (hostGameOptionsEl) hostGameOptionsEl.classList.remove("is-open");

  if (hostNameInput) hostNameInput.disabled = false;
  if (createRoomBtn) createRoomBtn.disabled = false;
  if (confirmCreateRoomBtn) confirmCreateRoomBtn.disabled = false;

  if (roomCodeInput) roomCodeInput.disabled = false;
  if (playerNameInput) playerNameInput.disabled = false;
  if (joinRoomBtn) joinRoomBtn.disabled = false;

  const uiRoomPill = document.getElementById("uiRoomPill");
  const uiRolePill = document.getElementById("uiRolePill");
  if (uiRoomPill) uiRoomPill.textContent = "Room: -";
  if (uiRolePill) uiRolePill.textContent = "Role: -";

  setDiceOverlayState("hidden");

  rollPending = false;
  answerPending = false;

  if (message) alert(message);
}

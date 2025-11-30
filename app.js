// app.js
// Step D: Round + Board + Dice + Question (Countdown + MCQ + Score)

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

console.log("app.js loaded (Step D)");
const app = firebaseInitializeApp(firebaseConfig);
const db = getDatabase(app);

// ---------------- ค่าคงที่ของเกม ----------------
const BOARD_SIZE = 30;

// ตัวอย่างคลังคำถาม (แก้ไข / เพิ่มได้เอง)
const QUESTIONS = [
  {
    text: "2 + 2 เท่ากับเท่าใด?",
    choices: {
      A: "3",
      B: "4",
      C: "5",
      D: "22",
    },
    correctOption: "B",
    timeLimit: 20, // วินาที
  },
  {
    text: "เมืองหลวงของประเทศไทยคือเมืองใด?",
    choices: {
      A: "เชียงใหม่",
      B: "ขอนแก่น",
      C: "กรุงเทพมหานคร",
      D: "ภูเก็ต",
    },
    correctOption: "C",
    timeLimit: 25,
  },
];

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
const startQuestionBtn = document.getElementById("startQuestionBtn");
const revealAnswerBtn = document.getElementById("revealAnswerBtn");

const gameAreaEl = document.getElementById("gameArea");
const roundInfoEl = document.getElementById("roundInfo");
const phaseInfoEl = document.getElementById("phaseInfo");
const boardEl = document.getElementById("board");

const rollDiceBtn = document.getElementById("rollDiceBtn");
const playerStatusEl = document.getElementById("playerStatus");

const questionAreaEl = document.getElementById("questionArea");
const countdownDisplayEl = document.getElementById("countdownDisplay");
const questionTextEl = document.getElementById("questionText");
const choicesContainerEl = document.getElementById("choicesContainer");

// ---------------- State ----------------
let currentRoomCode = null;
let currentRole = null; // "host" | "player"
let currentPlayerId = null;

let timerInterval = null;
let timerPhase = null;
let timerRound = 0;

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

function getQuestionByIndex(index) {
  if (QUESTIONS.length === 0) return null;
  const i = index % QUESTIONS.length;
  return QUESTIONS[i];
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerPhase = null;
  timerRound = 0;
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
      status: "lobby",
      hostId: hostId,
      hostName: hostName,
      boardSize: BOARD_SIZE,
      currentRound: 0,
      phase: "idle", // idle | rolling | questionCountdown | answering | result
      questionIndex: null,
      questionCountdownStartAt: null,
      questionCountdownSeconds: 3,
      answerStartAt: null,
      answerTimeSeconds: null,
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
      answer: null,
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
      "คุณเป็นผู้เล่น: รอครูเริ่มรอบใหม่ → ทอยลูกเต๋า → ตอบคำถาม";
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
    updateGameView(roomData, players);
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
  updates[`rooms/${currentRoomCode}/questionIndex`] =
    currentRound % (QUESTIONS.length || 1);
  updates[`rooms/${currentRoomCode}/questionCountdownStartAt`] = null;
  updates[`rooms/${currentRoomCode}/answerStartAt`] = null;
  updates[`rooms/${currentRoomCode}/answerTimeSeconds`] = null;

  for (const pid of Object.keys(players)) {
    updates[`rooms/${currentRoomCode}/players/${pid}/lastRoll`] = null;
    updates[`rooms/${currentRoomCode}/players/${pid}/hasRolled`] = false;
    updates[`rooms/${currentRoomCode}/players/${pid}/answered`] = false;
    updates[`rooms/${currentRoomCode}/players/${pid}/answer`] = null;
    updates[`rooms/${currentRoomCode}/players/${pid}/lastAnswerCorrect`] = null;
  }

  clearTimer();
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
  if (newPos < 0) newPos = 0;
  if (newPos > BOARD_SIZE) newPos = BOARD_SIZE;

  const updates = {};
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/lastRoll`] = roll;
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/position`] = newPos;
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/hasRolled`] = true;

  await update(ref(db), updates);
});

// ---------------- Host: Start Question (Countdown) ----------------
startQuestionBtn.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;

  const roomData = snap.val();
  const players = roomData.players || {};
  const phase = roomData.phase;
  const totalPlayers = Object.keys(players).length;
  const rolledCount = Object.values(players).filter((p) => p.hasRolled).length;

  if (phase !== "rolling") {
    alert("ต้องอยู่ในช่วงทอยลูกเต๋าก่อนจึงจะเริ่มคำถามได้");
    return;
  }
  if (totalPlayers === 0 || rolledCount < totalPlayers) {
    alert("ยังมีผู้เล่นที่ยังไม่ทอยลูกเต๋า");
    return;
  }

  const questionIndex =
    roomData.questionIndex ?? (roomData.currentRound - 1) % (QUESTIONS.length || 1);
  const question = getQuestionByIndex(questionIndex);
  if (!question) {
    alert("ยังไม่ได้ตั้งคำถามใน QUESTIONS");
    return;
  }

  const now = Date.now();
  const updates = {};
  updates[`rooms/${currentRoomCode}/phase`] = "questionCountdown";
  updates[`rooms/${currentRoomCode}/questionIndex`] = questionIndex;
  updates[`rooms/${currentRoomCode}/questionCountdownStartAt`] = now;
  updates[`rooms/${currentRoomCode}/questionCountdownSeconds`] = 3;
  updates[`rooms/${currentRoomCode}/answerStartAt`] = null;
  updates[`rooms/${currentRoomCode}/answerTimeSeconds`] = question.timeLimit;

  clearTimer();
  await update(ref(db), updates);
});

// ---------------- Host: Reveal Answer & Move Tokens ----------------
revealAnswerBtn.addEventListener("click", async () => {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;
  const roomData = snap.val();

  if (roomData.phase !== "answering") {
    alert("ต้องอยู่ในช่วงตอบคำถาม ก่อนเฉลย");
    return;
  }

  const players = roomData.players || {};
  const questionIndex = roomData.questionIndex ?? 0;
  const question = getQuestionByIndex(questionIndex);
  if (!question) {
    alert("ไม่พบข้อมูลคำถาม");
    return;
  }

  const updates = {};
  for (const [pid, p] of Object.entries(players)) {
    let pos = p.position || 0;
    const answered = !!p.answered;
    const ans = p.answer;
    let correct = false;

    if (answered && ans === question.correctOption) {
      pos += 1;
      correct = true;
    } else {
      // ผิด หรือไม่ตอบ = ถอยหลัง 1 ช่อง
      pos -= 1;
      correct = false;
    }

    if (pos < 0) pos = 0;
    if (pos > BOARD_SIZE) pos = BOARD_SIZE;

    updates[`rooms/${currentRoomCode}/players/${pid}/position`] = pos;
    updates[`rooms/${currentRoomCode}/players/${pid}/lastAnswerCorrect`] = correct;
    updates[`rooms/${currentRoomCode}/players/${pid}/answered`] = false;
    updates[`rooms/${currentRoomCode}/players/${pid}/answer`] = null;
  }

  updates[`rooms/${currentRoomCode}/phase`] = "result";

  clearTimer();
  await update(ref(db), updates);
});

// ---------------- Game View (Board + Question) ----------------
function updateGameView(roomData, players) {
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
      phaseText = "เตรียมคำถาม | นับถอยหลัง 3, 2, 1";
      break;
    case "answering":
      phaseText = "กำลังตอบคำถาม";
      break;
    case "result":
      phaseText = "สรุปผลคำถามรอบนี้";
      break;
    default:
      phaseText = "รอ Host เริ่มรอบใหม่";
  }
  phaseInfoEl.textContent = `สถานะรอบ: ${phaseText}`;

  renderBoard(players);
  updateRoleControls(roomData, players);
  updateQuestionUI(roomData, players);
}

// ---------------- ปุ่ม / Status ตามบทบาท ----------------
function updateRoleControls(roomData, players) {
  const phase = roomData.phase || "idle";
  const round = roomData.currentRound || 0;

  // ปุ่มของ Player
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
    } else if (phase === "answering") {
      playerStatusEl.textContent += " | กำลังตอบคำถาม";
    }
  } else if (currentRole === "host") {
    rollDiceBtn.style.display = "none";
    playerStatusEl.textContent =
      "คุณกำลังดูสถานะของนักเรียนทั้งหมด / ใช้ปุ่มด้านบนเพื่อควบคุมรอบและคำถาม";
  } else {
    rollDiceBtn.style.display = "none";
    playerStatusEl.textContent = "";
  }

  // ปุ่มของ Host
  if (currentRole === "host") {
    const totalPlayers = Object.keys(players).length;
    const rolledCount = Object.values(players).filter((p) => p.hasRolled).length;
    const answeredCount = Object.values(players).filter((p) => p.answered).length;

    // startRound: ใช้ได้เสมอ
    startRoundBtn.disabled = false;

    // startQuestion: ต้องอยู่ใน phase rolling และทุกคนทอยครบ
    startQuestionBtn.style.display = "inline-block";
    startQuestionBtn.disabled =
      !(phase === "rolling" && totalPlayers > 0 && rolledCount === totalPlayers);

    // revealAnswer: ใช้ได้เฉพาะตอน answering
    revealAnswerBtn.style.display = "inline-block";
    revealAnswerBtn.disabled = phase !== "answering";

    if (phase === "rolling") {
      phaseInfoEl.textContent += ` | ทอยแล้ว ${rolledCount}/${totalPlayers} คน`;
    } else if (phase === "answering") {
      phaseInfoEl.textContent += ` | ตอบแล้ว ${answeredCount}/${totalPlayers} คน`;
    }
  } else {
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
  const question = questionIndex != null ? getQuestionByIndex(questionIndex) : null;

  if (phase === "questionCountdown" && round > 0) {
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = `เตรียมคำถามรอบที่ ${round} …`;
    renderChoicesForPhase(null, null, null);
    ensureTimer(roomData, "questionCountdown");
  } else if (phase === "answering" && round > 0 && question) {
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = question.text;

    const me = players[currentPlayerId] || {};
    const selectedOption = me.answer || null;
    renderChoicesForPhase(question, selectedOption, question.correctOption, false);
    ensureTimer(roomData, "answering");
  } else if (phase === "result" && round > 0 && question) {
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = `เฉลยรอบที่ ${round}: ${question.text}`;
    countdownDisplayEl.textContent = "";
    // แสดงเฉลยด้วยการไฮไลต์ choice ที่ถูก/ผิด (เฉพาะใน UI ไม่เก็บเพิ่ม)
    renderChoicesForPhase(question, null, question.correctOption, true);
    clearTimer();
  } else {
    questionAreaEl.style.display = "none";
    countdownDisplayEl.textContent = "";
    clearTimer();
  }
}

function renderChoicesForPhase(question, selectedOption, correctOption, showResultOnly) {
  choicesContainerEl.innerHTML = "";

  if (!question) return;

  const entries = Object.entries(question.choices); // [ [A, "xxx"], [B,"yyy"] ... ]
  for (const [key, text] of entries) {
    const btn = document.createElement("button");
    btn.classList.add("choice-btn");
    btn.textContent = `${key}. ${text}`;

    if (showResultOnly) {
      // ตอน phase result
      if (key === correctOption) {
        btn.classList.add("correct");
      }
    } else {
      // ตอน answering
      if (selectedOption && key === selectedOption) {
        btn.classList.add("selected");
      }

      if (currentRole === "player") {
        btn.addEventListener("click", () => {
          submitAnswer(key);
        });
      }
    }

    choicesContainerEl.appendChild(btn);
  }
}

// ---------------- Timer สำหรับ countdown / answering ----------------
function ensureTimer(roomData, targetPhase) {
  const phase = roomData.phase || "idle";
  const round = roomData.currentRound || 0;

  if (phase !== targetPhase || round === 0) {
    clearTimer();
    countdownDisplayEl.textContent = "";
    return;
  }

  if (timerPhase === phase && timerRound === round && timerInterval) {
    return; // timer เดิมยังใช้งานได้ ไม่ต้องสร้างใหม่
  }

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
          // เปลี่ยน phase เป็น answering
          moveToAnswering(roomData);
        }
      }
    }, 250);
  } else if (phase === "answering") {
    const start = roomData.answerStartAt || Date.now();
    const duration = roomData.answerTimeSeconds || 20;

    timerInterval = setInterval(() => {
      const now = Date.now();
      let remaining = Math.ceil((start + duration * 1000 - now) / 1000);
      if (remaining < 0) remaining = 0;
      countdownDisplayEl.textContent = `เหลือเวลา ${remaining} วินาที`;

      if (remaining <= 0) {
        // หมดเวลาแล้วให้หยุด timer แต่ยังไม่เฉลยอัตโนมัติ
        clearTimer();
      }
    }, 250);
  }
}

// Host: เปลี่ยนจาก questionCountdown → answering
async function moveToAnswering(oldRoomData) {
  if (currentRole !== "host" || !currentRoomCode) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;

  const roomData = snap.val();
  if (roomData.phase !== "questionCountdown") return;

  const now = Date.now();
  const updates = {};
  updates[`rooms/${currentRoomCode}/phase`] = "answering";
  updates[`rooms/${currentRoomCode}/answerStartAt`] = now;
  // answerTimeSeconds ใช้ค่าที่ตั้งไว้แล้ว

  await update(ref(db), updates);
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

// ---------------- Player: ส่งคำตอบ ----------------
async function submitAnswer(optionKey) {
  if (currentRole !== "player" || !currentRoomCode || !currentPlayerId) return;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;
  const roomData = snap.val();

  if (roomData.phase !== "answering") {
    alert("ตอนนี้ยังไม่ใช่ช่วงตอบคำถาม");
    return;
  }

  const players = roomData.players || {};
  const me = players[currentPlayerId];
  if (!me) return;

  if (me.answered) {
    alert("คุณตอบคำถามรอบนี้ไปแล้ว");
    return;
  }

  const updates = {};
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/answer`] = optionKey;
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/answered`] = true;

  await update(ref(db), updates);
}

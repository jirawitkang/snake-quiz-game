// app.js
// Step D + Game Settings: Round + Board + Dice + Question Sets + Reward/Penalty

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

console.log("app.js loaded (Step D + settings)");
const app = firebaseInitializeApp(firebaseConfig);
const db = getDatabase(app);

// ---------------- ค่าคงที่ของเกม ----------------
const BOARD_SIZE = 30;

// ชุดคำถามหลายเซ็ต (ตัวอย่าง) — แก้ให้เป็นชุดของคุณเองได้
const QUESTION_SETS = {
  general: [
    {
      text: "2 + 2 เท่ากับเท่าใด?",
      choices: { A: "3", B: "4", C: "5", D: "22" },
      correctOption: "B",
      timeLimit: 20,
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
  ],
  setA: [
    {
      text: "HTML ย่อมาจากข้อใด?",
      choices: {
        A: "HyperText Markup Language",
        B: "HighText Machine Language",
        C: "Hyperlinks and Text Markup Language",
        D: "Home Tool Markup Language",
      },
      correctOption: "A",
      timeLimit: 25,
    },
    {
      text: "HTTP status code 404 หมายถึง?",
      choices: {
        A: "OK",
        B: "Not Found",
        C: "Forbidden",
        D: "Bad Request",
      },
      correctOption: "B",
      timeLimit: 20,
    },
  ],
  setB: [
    {
      text: "ข้อใดต่อไปนี้คือหน่วยของความถี่?",
      choices: { A: "นิวตัน", B: "วัตต์", C: "เฮิรตซ์", D: "จูล" },
      correctOption: "C",
      timeLimit: 20,
    },
    {
      text: "H2O คือสารใด?",
      choices: { A: "คาร์บอนไดออกไซด์", B: "น้ำ", C: "ไฮโดรเจน", D: "ออกซิเจน" },
      correctOption: "B",
      timeLimit: 15,
    },
  ],
};

function getQuestionSetById(id) {
  return QUESTION_SETS[id] || QUESTION_SETS["general"] || [];
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
  const i = index % set.length;
  return set[i];
}

// ---------------- DOM elements ----------------
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

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerPhase = null;
  timerRound = 0;
}

// ---------------- Host: Step 1 – เปิด panel ตั้งค่าเกม ----------------
createRoomBtn.addEventListener("click", () => {
  const hostName = hostNameInput.value.trim();
  if (!hostName) {
    alert("กรุณากรอกชื่อของ Host ก่อน");
    return;
  }

  // ล็อคชื่อ + แสดง panel ตั้งค่าเกม
  hostNameInput.disabled = true;
  createRoomBtn.disabled = true;
  hostGameOptionsEl.style.display = "block";
});

// ---------------- Host: Step 2 – ยืนยันสร้างห้อง ----------------
confirmCreateRoomBtn.addEventListener("click", async () => {
  const hostName = hostNameInput.value.trim();
  if (!hostName) {
    alert("กรุณากรอกชื่อของ Host");
    return;
  }

  const questionSetId = questionSetSelect.value || "general";
  const maxRounds = parseInt(maxRoundsInput.value, 10) || 10;
  const maxWinners = parseInt(maxWinnersInput.value, 10) || 5;
  const rewardCorrect = parseInt(rewardCorrectInput.value, 10) || 1;
  const penaltyWrong = parseInt(penaltyWrongInput.value, 10) || 1;

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
      answerDeadlineExpired: false,
      gameSettings: {
        questionSetId,
        maxRounds,
        maxWinners,
        rewardCorrect,  // เดินหน้าเมื่อตอบถูก
        penaltyWrong,   // ถอยหลังเมื่อตอบผิด/ไม่ทัน (positive number)
      },
    });

    console.log("Room created:", roomCode);
    hostGameOptionsEl.style.display = "none";
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
      "คุณเป็นผู้เล่น: รอครูเริ่มรอบใหม่ → ทอยลูกเต๋า → ตอบคำถามในแต่ละรอบ";
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

    renderPlayerList(roomData, players);
    updateGameView(roomData, players);
  });
}

// ---------------- Render Player List (สถานะผู้เล่น) ----------------
function renderPlayerList(roomData, playersObj) {
  playerListEl.innerHTML = "";

  const entries = Object.entries(playersObj);
  const phase = roomData.phase || "idle";
  const deadlineExpired = roomData.answerDeadlineExpired === true;

  entries.sort((a, b) => {
    const aJoined = a[1].joinedAt || 0;
    const bJoined = b[1].joinedAt || 0;
    return aJoined - bJoined;
  });

  for (const [pid, player] of entries) {
    const li = document.createElement("li");

    // สัญลักษณ์ตอบล่าสุด
    let answerSymbol = "-";
    if (player.lastAnswerCorrect === true) {
      answerSymbol = "✅";
    } else if (player.lastAnswerCorrect === false) {
      answerSymbol = "❌";
    }

    // สถานะผู้เล่นตาม phase
    let statusText = "";

    if (phase === "rolling") {
      if (!player.hasRolled) {
        statusText = "ยังไม่ทอยลูกเต๋า";
      } else {
        statusText = `ทอยแล้ว (ได้ ${player.lastRoll ?? "-"} แต้ม)`;
      }
    } else if (phase === "questionCountdown") {
      statusText = "รอคำถามรอบนี้";
    } else if (phase === "answering") {
      if (deadlineExpired) {
        if (player.answered) {
          statusText = "ตอบแล้ว (รอเฉลย)";
        } else {
          statusText = "ตอบไม่ทัน";
        }
      } else {
        if (player.answered) {
          statusText = "ตอบแล้ว (รอเฉลย)";
        } else {
          statusText = "กำลังหาคำตอบ / ยังไม่ตอบ";
        }
      }
    } else if (phase === "result") {
      if (player.lastAnswerCorrect === true) {
        statusText = "ตอบถูก (+ เดินหน้า)";
      } else if (player.lastAnswerCorrect === false) {
        if (player.answered) {
          statusText = "ตอบผิด (ถอยหลัง)";
        } else {
          statusText = "ตอบไม่ทัน (ถอยหลัง)";
        }
      } else {
        statusText = "รอรอบถัดไป";
      }
    } else {
      // idle หรืออื่น ๆ
      statusText = "รอเริ่มรอบใหม่";
    }

    li.innerHTML = `
      <span class="player-name">${player.name || pid}</span>
      <span class="player-meta">
        ช่องปัจจุบัน: <strong>${player.position ?? 0}</strong> |
        ทอยล่าสุด: <strong>${player.lastRoll ?? "-"}</strong> |
        ตอบล่าสุด: <strong>${answerSymbol}</strong> |
        สถานะผู้เล่น: <strong>${statusText}</strong>
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

  const questionSetLen = getQuestionSetLengthForRoom(roomData);

  const updates = {};
  updates[`rooms/${currentRoomCode}/currentRound`] = currentRound + 1;
  updates[`rooms/${currentRoomCode}/phase`] = "rolling";
  updates[`rooms/${currentRoomCode}/questionIndex`] =
    currentRound % (questionSetLen || 1);
  updates[`rooms/${currentRoomCode}/questionCountdownStartAt`] = null;
  updates[`rooms/${currentRoomCode}/answerStartAt`] = null;
  updates[`rooms/${currentRoomCode}/answerTimeSeconds`] = null;
  updates[`rooms/${currentRoomCode}/answerDeadlineExpired`] = false;

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
    roomData.questionIndex ??
    ((roomData.currentRound - 1) % getQuestionSetLengthForRoom(roomData));
  const question = getQuestionFromRoom(roomData, questionIndex);
  if (!question) {
    alert("ยังไม่ได้ตั้งคำถามในชุดที่เลือก");
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
  updates[`rooms/${currentRoomCode}/answerDeadlineExpired`] = false;

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
  const question = getQuestionFromRoom(roomData, questionIndex);
  if (!question) {
    alert("ไม่พบข้อมูลคำถาม");
    return;
  }

  const gs = roomData.gameSettings || {};
  const rewardCorrect = Number.isFinite(gs.rewardCorrect)
    ? gs.rewardCorrect
    : 1;
  const penaltyWrong = Number.isFinite(gs.penaltyWrong)
    ? gs.penaltyWrong
    : 1;

  const updates = {};
  for (const [pid, p] of Object.entries(players)) {
    let pos = p.position || 0;
    const answered = !!p.answered;
    const ans = p.answer;
    let correct = false;

    if (answered && ans === question.correctOption) {
      pos += rewardCorrect;
      correct = true;
    } else {
      pos -= penaltyWrong;
      correct = false;
    }

    if (pos < 0) pos = 0;
    if (pos > BOARD_SIZE) pos = BOARD_SIZE;

    updates[`rooms/${currentRoomCode}/players/${pid}/position`] = pos;
    updates[`rooms/${currentRoomCode}/players/${pid}/lastAnswerCorrect`] = correct;
    // answered / answer จะถูก reset ตอนเริ่มรอบใหม่ (startRound)
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
  const deadlineExpired = roomData.answerDeadlineExpired === true;

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
      if (deadlineExpired) {
        if (me.answered) {
          playerStatusEl.textContent += " | ตอบแล้ว รอ Host เฉลย";
        } else {
          playerStatusEl.textContent += " | หมดเวลา ไม่สามารถตอบได้แล้ว";
        }
      } else {
        playerStatusEl.textContent += " | กำลังตอบคำถาม";
      }
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

    startRoundBtn.disabled = false;

    startQuestionBtn.style.display = "inline-block";
    startQuestionBtn.disabled =
      !(phase === "rolling" && totalPlayers > 0 && rolledCount === totalPlayers);

    revealAnswerBtn.style.display = "inline-block";
    revealAnswerBtn.disabled = phase !== "answering";

    if (phase === "rolling") {
      phaseInfoEl.textContent += ` | ทอยแล้ว ${rolledCount}/${totalPlayers} คน`;
    } else if (phase === "answering") {
      phaseInfoEl.textContent += ` | ตอบแล้ว ${answeredCount}/${totalPlayers} คน`;
      if (roomData.answerDeadlineExpired === true) {
        phaseInfoEl.textContent += " | หมดเวลาแล้ว";
      }
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
  const question =
    questionIndex != null ? getQuestionFromRoom(roomData, questionIndex) : null;

  if (phase === "questionCountdown" && round > 0) {
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = `เตรียมคำถามรอบที่ ${round} …`;
    renderChoicesForPhase(null, null, null, false, true);
    ensureTimer(roomData, "questionCountdown");
  } else if (phase === "answering" && round > 0 && question) {
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = question.text;

    const me = players[currentPlayerId] || {};
    const selectedOption = me.answer || null;
    const deadlineExpired = roomData.answerDeadlineExpired === true;

    renderChoicesForPhase(
      question,
      selectedOption,
      question.correctOption,
      false,
      deadlineExpired
    );
    ensureTimer(roomData, "answering");
  } else if (phase === "result" && round > 0 && question) {
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = `เฉลยรอบที่ ${round}: ${question.text}`;
    countdownDisplayEl.textContent = "";

    let selectedOption = null;
    if (currentRole === "player") {
      const me = players[currentPlayerId] || {};
      selectedOption = me.answer || null;
    }

    renderChoicesForPhase(
      question,
      selectedOption,
      question.correctOption,
      true,
      false
    );
    clearTimer();
  } else {
    questionAreaEl.style.display = "none";
    countdownDisplayEl.textContent = "";
    clearTimer();
  }
}

function renderChoicesForPhase(
  question,
  selectedOption,
  correctOption,
  showResultOnly,
  disableAnswerButtons = false
) {
  choicesContainerEl.innerHTML = "";

  if (!question) return;

  const entries = Object.entries(question.choices);
  for (const [key, text] of entries) {
    const btn = document.createElement("button");
    btn.classList.add("choice-btn");
    btn.textContent = `${key}. ${text}`;

    if (showResultOnly) {
      if (key === correctOption) {
        btn.classList.add("correct");
      }
      if (
        selectedOption &&
        selectedOption === key &&
        selectedOption !== correctOption
      ) {
        btn.classList.add("wrong");
      }
    } else {
      if (selectedOption && key === selectedOption) {
        btn.classList.add("selected");
      }

      if (currentRole === "player" && !disableAnswerButtons) {
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
    return;
  }

  clearTimer();
  timerPhase = phase;
  timerRound = round;

  if (phase === "questionCountdown") {
    const start = roomData.questionCountdownStartAt || Date.now();
    const duration = roomData.questionCountdownSeconds || 3;

    timerInterval = setInterval(async () => {
      const now = Date.now();
      let remaining = Math.ceil((start + duration * 1000 - now) / 1000);
      if (remaining < 0) remaining = 0;
      countdownDisplayEl.textContent = `เริ่มตอบใน ${remaining} วินาที`;

      if (remaining <= 0) {
        clearTimer();
        if (currentRole === "host" && currentRoomCode) {
          await moveToAnswering(roomData);
        }
      }
    }, 250);
  } else if (phase === "answering") {
    const start = roomData.answerStartAt || Date.now();
    const duration = roomData.answerTimeSeconds || 20;

    timerInterval = setInterval(async () => {
      const now = Date.now();
      let remaining = Math.ceil((start + duration * 1000 - now) / 1000);
      if (remaining < 0) remaining = 0;
      countdownDisplayEl.textContent = `เหลือเวลา ${remaining} วินาที`;

      if (remaining <= 0) {
        clearTimer();

        if (
          currentRole === "host" &&
          currentRoomCode &&
          roomData.answerDeadlineExpired !== true
        ) {
          try {
            await update(ref(db), {
              [`rooms/${currentRoomCode}/answerDeadlineExpired`]: true,
            });
          } catch (e) {
            console.error("Error setting answerDeadlineExpired:", e);
          }
        }
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
  updates[`rooms/${currentRoomCode}/answerDeadlineExpired`] = false;

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

  if (roomData.answerDeadlineExpired === true) {
    alert("หมดเวลาตอบคำถามแล้ว");
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

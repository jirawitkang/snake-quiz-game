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
      timeLimit: 10,
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
      timeLimit: 10,
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
      timeLimit: 10,
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
      timeLimit: 10,
    },
  ],
  setB: [
    {
      text: "ข้อใดต่อไปนี้คือหน่วยของความถี่?",
      choices: { A: "นิวตัน", B: "วัตต์", C: "เฮิรตซ์", D: "จูล" },
      correctOption: "C",
      timeLimit: 10,
    },
    {
      text: "H2O คือสารใด?",
      choices: { A: "คาร์บอนไดออกไซด์", B: "น้ำ", C: "ไฮโดรเจน", D: "ออกซิเจน" },
      correctOption: "B",
      timeLimit: 10,
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

const endGameAreaEl = document.getElementById("endGameArea");
const endGameSummaryEl = document.getElementById("endGameSummary");

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

// คืนลิสต์เลขช่องที่หมาก "เดินผ่าน" จาก from → to (รวมปลายทาง ไม่รวมจุดเริ่ม)
// ใช้ได้ทั้งเดินหน้าและถอยหลัง
function getPathCells(from, to) {
  const cells = [];
  if (from === to) return cells;
  const step = from < to ? 1 : -1;
  let pos = from + step;
  while (true) {
    if (pos >= 1 && pos <= BOARD_SIZE) {
      cells.push(pos);
    }
    if (pos === to) break;
    pos += step;
  }
  return cells;
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
  let penaltyWrong = parseInt(penaltyWrongInput.value, 10);
  if (Number.isNaN(penaltyWrong)) {
    penaltyWrong = -1; // default ถ้าไม่ได้กรอก หรือกรอกมั่ว
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
  const playerNameRaw = playerNameInput.value.trim();

  if (!roomCode || !playerNameRaw) {
    alert("กรุณากรอกทั้ง Room Code และชื่อนักเรียน");
    return;
  }

  // ตัดช่องว่างหัวท้าย + normalize เป็นตัวพิมพ์เล็กไว้เช็คซ้ำ
  const playerName = playerNameRaw;
  const playerNameKey = playerNameRaw.toLowerCase();

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

  // ---------- เช็คชื่อซ้ำกับ Host ----------
  const hostName = (roomData.hostName || "").trim();
  const hostNameKey = hostName.toLowerCase();
  if (hostNameKey && hostNameKey === playerNameKey) {
    alert("ชื่อนี้ซ้ำกับชื่อ Host กรุณาใช้ชื่ออื่น");
    return;
  }

  // ---------- เช็คชื่อซ้ำกับ Player คนอื่น ----------
  const players = roomData.players || {};
  for (const [, p] of Object.entries(players)) {
    const existingName = (p.name || "").trim();
    if (existingName.toLowerCase() === playerNameKey) {
      alert("มีผู้เล่นใช้ชื่อนี้ในห้องแล้ว กรุณาใช้ชื่ออื่น");
      return;
    }
  }

  // ---------- ผ่านแล้วค่อยสร้างผู้เล่น ----------
  const playerId = createId("p");

  currentRoomCode = roomCode;
  currentRole = "player";
  currentPlayerId = playerId;

  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);

  try {
    await set(playerRef, {
      name: playerName,          // เก็บชื่อจริง (มีพิมพ์เล็ก/ใหญ่ตามที่พิมพ์)
      color: randomColor(),
      position: 0,
      lastRoll: null,
      hasRolled: false,
      answered: false,
      answer: null,
      lastAnswerCorrect: null,
      joinedAt: Date.now(),
      finished: false,
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
    const gs = roomData.gameSettings || {};

    if (currentRoomCode === roomCode) {
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

  const gs = roomData.gameSettings || {};
  const rewardCorrect = Number.isFinite(gs.rewardCorrect) ? gs.rewardCorrect : 1;
  const penaltyWrong = Number.isFinite(gs.penaltyWrong) ? gs.penaltyWrong : -1;

  const history = roomData.history || {};

  // เตรียมโครง per-player
  const perPlayer = {};
    for (const [pid, p] of entries) {
    perPlayer[pid] = {
      id: pid,
      name: p.name || pid,
      position: p.position || 0,
      lastRoll: p.lastRoll ?? null,
      hasRolled: !!p.hasRolled,
      answered: !!p.answered,
      lastAnswerCorrect: p.lastAnswerCorrect,
      finished: !!p.finished,
      rolls: [],
      answerSymbols: [],
    };
  }


  // ไล่ history เพื่อต่อ string ทอยเต๋า + ถูก/ผิด
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
          position: playersObj[pid]?.position || 0,
          lastRoll: playersObj[pid]?.lastRoll ?? null,
          hasRolled: !!playersObj[pid]?.hasRolled,
          answered: !!playersObj[pid]?.answered,
          lastAnswerCorrect: playersObj[pid]?.lastAnswerCorrect,
          rolls: [],
          answerSymbols: [],
        };
      }

      if (rec.diceRoll != null) {
        perPlayer[pid].rolls.push(rec.diceRoll);
      }

      if (rec.correct === true) {
        perPlayer[pid].answerSymbols.push("✅");
      } else {
        perPlayer[pid].answerSymbols.push("❌");
      }
    }
  }

  // helper: สถานะผู้เล่นตาม phase
  function getStatusText(p) {
    if (p.finished) {
      return "เข้าเส้นชัยแล้ว (ช่อง 30)";
    }
    if (phase === "rolling") {
      if (!p.hasRolled) return "ยังไม่ทอยลูกเต๋า";
      return `ทอยแล้ว (ได้ ${p.lastRoll ?? "-"} แต้ม)`;
    } else if (phase === "questionCountdown") {
      return "รอคำถามรอบนี้";
    } else if (phase === "answering") {
      if (deadlineExpired) {
        if (p.answered) return "ตอบแล้ว (รอเฉลย)";
        return "ตอบไม่ทัน";
      } else {
        if (p.answered) return "ตอบแล้ว (รอเฉลย)";
        return "กำลังหาคำตอบ / ยังไม่ตอบ";
      }
    } else if (phase === "result") {
      const moveCorrectText =
        rewardCorrect >= 0 ? `+${rewardCorrect}` : `${rewardCorrect}`;
      const moveWrongText =
        penaltyWrong >= 0 ? `+${penaltyWrong}` : `${penaltyWrong}`;

      if (p.lastAnswerCorrect === true) {
        return `ตอบถูก (${moveCorrectText} ช่อง)`;
      } else if (p.lastAnswerCorrect === false) {
        if (p.answered) {
          return `ตอบผิด (${moveWrongText} ช่อง)`;
        }
        return `ตอบไม่ทัน (${moveWrongText} ช่อง)`;
      }
      return "รอรอบถัดไป";
    } else if (phase === "ended") {
      return "เกมจบแล้ว";
    }
    return "รอเริ่มรอบใหม่";
  }

  // แปลงเป็น array ให้เรียงสวย ๆ
  const statsArray = Object.values(perPlayer).sort((a, b) => {
    // เรียงตามชื่อก่อนเพื่อให้อ่านง่าย
    return (a.name || "").localeCompare(b.name || "");
  });

  if (statsArray.length === 0) {
    playerListEl.textContent = "ยังไม่มีผู้เล่นเข้าห้อง";
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th class="name-col">ผู้เล่น</th>
          <th>ตำแหน่งปัจจุบัน</th>
          <th>ทอยลูกเต๋าทุกครั้ง</th>
          <th>ผลคำถามทุกข้อ</th>
          <th>สถานะผู้เล่น</th>
        </tr>
      </thead>
      <tbody>
  `;

  statsArray.forEach((p) => {
    const rollsText = p.rolls.join("") || "-";
    const answersText = p.answerSymbols.join("") || "-";
    const statusText = getStatusText(p);

    html += `
      <tr>
        <td class="name-col">${p.name}</td>
        <td>${p.position}</td>
        <td>${rollsText}</td>
        <td>${answersText}</td>
        <td>${statusText}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;

  playerListEl.innerHTML = html;
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

    for (const [pid, p] of Object.entries(players)) {
    // ถ้าเข้าเส้นชัยแล้ว → ไม่ต้องทอยในรอบใหม่ แต่ให้ถือว่า "ทอยแล้ว" เสมอ
    if (p.finished) {
      updates[`rooms/${currentRoomCode}/players/${pid}/hasRolled`] = true;
      // lastRoll จะเก็บค่ารอบล่าสุดไว้เฉย ๆ (จะ reset ก็ได้ แต่ไม่จำเป็น)
    } else {
      updates[`rooms/${currentRoomCode}/players/${pid}/lastRoll`] = null;
      updates[`rooms/${currentRoomCode}/players/${pid}/hasRolled`] = false;
    }

    // reset สถานะตอบคำถามทุกรอบ (ทั้งคนที่เข้าเส้นชัยแล้วและยังไม่เข้า)
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

  if (me.finished) {
    alert("คุณเข้าเส้นชัยแล้ว ไม่ต้องทอยลูกเต๋า");
    return;
  }

  if (me.hasRolled) {
    alert("คุณทอยลูกเต๋าในรอบนี้ไปแล้ว");
    return;
  }

  // เก็บตำแหน่งปัจจุบันไว้ใช้ตอนคำนวณหลังทอย
  const basePos = me.position || 0;

  // เริ่มแอนิเมชันทอยเต๋า + commit ผลลัพธ์ (ส่ง roomData ไปด้วย)
  await animateDiceAndCommitRoll(basePos, roomData);
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
    : -1;
  const maxRounds = gs.maxRounds || 10;
  const maxWinners = gs.maxWinners || 5;

  const questionSetId = gs.questionSetId || "general";
  const currentRound = roomData.currentRound || 0;

  const now = Date.now();
  const updates = {};

  let winners = roomData.winners || [];
  const winnerIds = new Set(winners.map((w) => w.playerId));

  // === วนผู้เล่นทีละคน เพื่อขยับตำแหน่ง + บันทึก history ===
  for (const [pid, p] of Object.entries(players)) {
    const alreadyFinished = !!p.finished;   // เข้าเส้นชัยไปแล้วหรือยัง
    const basePos = p.position || 0;

    let answered = !!p.answered;
    let ans = p.answer;
    let correct = null;
    let configuredMove = 0;
    let pos = basePos;

    if (!alreadyFinished) {
      // ----- ยังไม่เข้าเส้นชัย → คิดผลตามตอบถูก/ผิด -----
      configuredMove = penaltyWrong; // default = ผิด/ไม่ตอบ
      correct = false;

      if (answered && ans === question.correctOption) {
        configuredMove = rewardCorrect;
        correct = true;
      }

      pos = basePos + configuredMove;
      if (pos < 0) pos = 0;
      if (pos > BOARD_SIZE) pos = BOARD_SIZE;

      // ถ้ารอบนี้ทำให้ถึง/เกินช่อง 30 จาก "ตอบคำถาม"
      if (pos >= BOARD_SIZE) {
        updates[`rooms/${currentRoomCode}/players/${pid}/finished`] = true;
        updates[`rooms/${currentRoomCode}/players/${pid}/finishedRound`] =
          currentRound;
        updates[`rooms/${currentRoomCode}/players/${pid}/finishedBy`] = "answer";
      }
    } else {
      // ----- คนที่เข้าเส้นชัยไปแล้ว → ไม่ขยับตำแหน่ง / ไม่คิดถูกผิด / ไม่เก็บเป็น timeout -----
      answered = false;
      ans = null;
      configuredMove = 0;
      pos = basePos;
    }

    const actualDelta = pos - basePos;

    // อัปเดตตำแหน่ง
    updates[`rooms/${currentRoomCode}/players/${pid}/position`] = pos;

    // บันทึกว่ารอบนี้ "ถูก/ผิด" เฉพาะคนที่ยังเล่นอยู่
    if (correct === true || correct === false) {
      updates[`rooms/${currentRoomCode}/players/${pid}/lastAnswerCorrect`] = correct;
    }

    // เก็บ history ของรอบนี้
    // คนที่เข้าเส้นชัยไปแล้วแต่เราตั้ง answered=false / ans=null จะไม่ถูกนับเป็นถูก/ผิด/timeout
    const historyPath = `rooms/${currentRoomCode}/history/round_${currentRound}/answers/${pid}`;
    updates[historyPath] = {
      playerId: pid,
      playerName: p.name || "",
      questionSetId,
      questionIndex,
      questionText: question.text,
      selectedOption: ans ?? null,
      correct,
      answered,
      diceRoll: p.lastRoll ?? null,
      basePosition: basePos,
      finalPosition: pos,
      configuredMove,
      actualDelta,
      timestamp: now,
    };

    // เช็กเข้าเส้นชัยเพื่อบันทึกใน winners (ทั้งเคสเพิ่งถึง หรือเคสที่เคย mark finished ไว้แล้ว แต่ยังไม่อยู่ใน winners)
    if (pos >= BOARD_SIZE && !winnerIds.has(pid)) {
      winners.push({
        playerId: pid,
        playerName: p.name || pid,
        finishedRound: p.finishedRound ?? currentRound,
        rank: winners.length + 1,
      });
      winnerIds.add(pid);
    }
  }

  // เขียน winners กลับ DB
  updates[`rooms/${currentRoomCode}/winners`] = winners;

  const totalPlayers = Object.keys(players).length;
  const targetWinners = Math.min(maxWinners, totalPlayers);

  let gameEnded = false;
  let endReason = null;

  if (winners.length >= targetWinners || winners.length === totalPlayers) {
    gameEnded = true;
    endReason = "winners";
  } else if (currentRound >= maxRounds) {
    gameEnded = true;
    endReason = "rounds";
  }

  if (gameEnded) {
    updates[`rooms/${currentRoomCode}/phase`] = "ended";
    updates[`rooms/${currentRoomCode}/status`] = "finished";
    updates[`rooms/${currentRoomCode}/endInfo`] = {
      endedAt: now,
      endReason,
      maxRounds,
      maxWinners,
      winnerCount: winners.length,
    };
  } else {
    updates[`rooms/${currentRoomCode}/phase`] = "result";
  }

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

  renderBoard(roomData, players);
  updateRoleControls(roomData, players);
  updateQuestionUI(roomData, players);

  // แสดง/ซ่อนหน้า end game
  if (phase === "ended") {
    endGameAreaEl.style.display = "block";
    renderEndGameSummary(roomData, players);
  } else {
    endGameAreaEl.style.display = "none";
    endGameSummaryEl.innerHTML = "";
  }
}
// ---------------- End Game Summary ----------------
function renderEndGameSummary(roomData, players) {
  const history = roomData.history || {};
  const winners = roomData.winners || [];
  const gs = roomData.gameSettings || {};
  const maxRounds = gs.maxRounds || 10;
  const maxWinners = gs.maxWinners || 5;
  const endInfo = roomData.endInfo || {};
  const endReason = endInfo.endReason || "unknown";

  // เตรียมสถิติพื้นฐาน per player
  const perPlayer = {};
  for (const [pid, p] of Object.entries(players)) {
    perPlayer[pid] = {
      id: pid,
      name: p.name || pid,
      correct: 0,
      wrong: 0,
      timeout: 0,
      rolls: [],
      answerSymbols: [],
      finalPosition: p.position || 0,
      finishRound: null,
      finishViaDice: null, // true = ผ่านทอยลูกเต๋า, false = ผ่านตอบคำถาม
      rank: null,
    };
  }

  // ไล่ history ตามรอบเพื่อต่อข้อมูล
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
    const roundNumber = parseInt(rk.split("_")[1] || "0", 10);

    for (const [pid, rec] of Object.entries(answers)) {
      if (!perPlayer[pid]) {
        perPlayer[pid] = {
          id: pid,
          name: rec.playerName || pid,
          correct: 0,
          wrong: 0,
          timeout: 0,
          rolls: [],
          answerSymbols: [],
          finalPosition: players[pid]?.position || 0,
          finishRound: null,
          finishViaDice: null,
          rank: null,
        };
      }

      const stat = perPlayer[pid];

      // ทอยลูกเต๋า
      if (rec.diceRoll != null) {
        stat.rolls.push(rec.diceRoll);
      }

      // ถูก / ผิด / ไม่ตอบ
      if (rec.correct === true) {
        stat.correct += 1;
        stat.answerSymbols.push("✅");
      } else {
        if (rec.answered) {
          stat.wrong += 1;
        } else {
          stat.timeout += 1;
        }
        stat.answerSymbols.push("❌");
      }

      // เช็ก "รอบแรกที่เข้าเส้นชัย"
      const finalPos = rec.finalPosition ?? stat.finalPosition;
      const basePos = rec.basePosition ?? (finalPos - (rec.configuredMove || 0));

      if (
        finalPos >= BOARD_SIZE && // เข้าถึงช่อง 30 หรือมากกว่า
        (stat.finishRound == null || roundNumber < stat.finishRound)
      ) {
        stat.finishRound = roundNumber;
        // ถ้าก่อนตอบคำถาม (basePos) ก็ถึง 30 แล้ว → เข้าเส้นชัยด้วยการทอยลูกเต๋า
        stat.finishViaDice = basePos >= BOARD_SIZE;
      }
    }
  }

  // คำนวณ % ถูก และเตรียมแยกกลุ่ม finishers / nonFinishers
  const statsArray = Object.values(perPlayer).map((s) => {
    const totalQ = s.correct + s.wrong + s.timeout;
    const pct = totalQ > 0 ? (s.correct / totalQ) * 100 : 0;
    return {
      ...s,
      pctCorrect: pct, // 0–100
    };
  });

  const finishers = statsArray.filter((s) => s.finishRound != null);
  const nonFinishers = statsArray.filter((s) => s.finishRound == null);

  // ---------------- จัดอันดับกลุ่มคนที่ "ถึงเส้นชัย" ----------------
  // กฎ:
  // 1) รอบที่เข้าเส้นชัยน้อยกว่า (ถึงเร็วกว่า) ดีกว่า
  // 2) ถ้าอยู่รอบเดียวกัน → คนที่เข้าเส้นชัยด้วยการทอยลูกเต๋า (finishViaDice=true) มาก่อนตอบคำถาม
  // 3) ถ้ายังเท่ากัน → % ถูกมากกว่า ดีกว่า
  // 4) ถ้ายังเท่ากัน → อันดับร่วมกัน
  finishers.sort((a, b) => {
    if (a.finishRound !== b.finishRound) {
      return a.finishRound - b.finishRound;
    }
    if (a.finishViaDice !== b.finishViaDice) {
      // true มาก่อน false
      return a.finishViaDice ? -1 : 1;
    }
    if (b.pctCorrect !== a.pctCorrect) {
      return b.pctCorrect - a.pctCorrect;
    }
    return (a.name || "").localeCompare(b.name || "");
  });

  // ---------------- จัดอันดับกลุ่ม "ไม่ถึงเส้นชัย" ----------------
  // กฎ:
  // 1) ตำแหน่งสุดท้ายบนกระดานสูงกว่า ดีกว่า
  // 2) ถ้าตำแหน่งเท่ากัน → % ถูกมากกว่า ดีกว่า
  // 3) ถ้ายังเท่ากัน → อันดับร่วม
  nonFinishers.sort((a, b) => {
    if (b.finalPosition !== a.finalPosition) {
      return b.finalPosition - a.finalPosition;
    }
    if (b.pctCorrect !== a.pctCorrect) {
      return b.pctCorrect - a.pctCorrect;
    }
    return (a.name || "").localeCompare(b.name || "");
  });

  // รวมสองกลุ่มเข้าด้วยกัน (คนเข้าเส้นชัยมาก่อน)
  const combined = [...finishers, ...nonFinishers];

  // ---------------- ให้ค่า rank แบบ "อันดับร่วม + ข้ามอันดับ" ----------------
  let lastKey = null;
  let lastRank = 0;
  let index = 0;

  for (const s of combined) {
    index++;
    let key;
    if (s.finishRound != null) {
      // คนถึงเส้นชัย
      key = `F|${s.finishRound}|${s.finishViaDice ? 1 : 0}|${Math.round(
        s.pctCorrect
      )}`;
    } else {
      // คนไม่ถึงเส้นชัย
      key = `N|${s.finalPosition}|${Math.round(s.pctCorrect)}`;
    }

    if (key === lastKey) {
      s.rank = lastRank; // อันดับร่วม
    } else {
      s.rank = index; // อันดับใหม่
      lastRank = s.rank;
      lastKey = key;
    }
  }

  // ---------------- Host View ----------------
  if (currentRole === "host") {
    let reasonText = "";
    if (endReason === "winners") {
      reasonText = `เกมจบเพราะมีผู้เข้าเส้นชัยครบ ${Math.min(
        maxWinners,
        Object.keys(players).length
      )} คน`;
    } else if (endReason === "rounds") {
      reasonText = `เกมจบเพราะเล่นครบ ${maxRounds} รอบแล้ว`;
    } else {
      reasonText = "เกมจบแล้ว";
    }

    let html = `<p><strong>${reasonText}</strong></p>`;

    if (winners.length > 0) {
      html += `<p>ผู้เข้าเส้นชัย (ตามลำดับที่ถึงเส้นชัยจริง):</p><ul>`;
      winners
        .sort((a, b) => a.finishedRound - b.finishedRound || a.rank - b.rank)
        .forEach((w) => {
          html += `<li>อันดับเข้าเส้นชัย ${w.rank}: ${w.playerName} (รอบที่เข้าเส้นชัย: ${w.finishedRound})</li>`;
        });
      html += `</ul>`;
    }

    html += `
      <h4>สรุปผลรายผู้เล่น</h4>
      <table>
        <thead>
          <tr>
            <th>อันดับ</th>
            <th class="name-col">ผู้เล่น</th>
            <th>ตำแหน่งสุดท้าย</th>
            <th>ถึงเส้นชัย?</th>
            <th>รอบที่ถึง</th>
            <th>วิธีถึง (ทอย/ตอบ)</th>
            <th>ถูก</th>
            <th>ผิด/ไม่ทัน</th>
            <th>% ถูก</th>
            <th>ทอยลูกเต๋า (ทุกครั้ง)</th>
            <th>ผลคำถาม (ทุกข้อ)</th>
          </tr>
        </thead>
        <tbody>
    `;

    combined.forEach((s) => {
      const totalQ = s.correct + s.wrong + s.timeout;
      const totalWrongLike = s.wrong + s.timeout;
      const pctText =
        totalQ > 0 ? Math.round(s.pctCorrect).toString() + "%" : "-";
      const rollsText = s.rolls.join("") || "-";
      const answersText = s.answerSymbols.join("") || "-";
      const finishFlag = s.finishRound != null ? "✅" : "-";
      const finishRoundText = s.finishRound != null ? s.finishRound : "-";
      let finishMethod = "-";
      if (s.finishRound != null) {
        finishMethod = s.finishViaDice ? "ทอยถึง 30" : "ตอบถูกจนถึง 30";
      }

      html += `
        <tr>
          <td>${s.rank ?? "-"}</td>
          <td class="name-col">${s.name}</td>
          <td>${s.finalPosition}</td>
          <td>${finishFlag}</td>
          <td>${finishRoundText}</td>
          <td>${finishMethod}</td>
          <td>${s.correct}</td>
          <td>${totalWrongLike}</td>
          <td>${pctText}</td>
          <td>${rollsText}</td>
          <td>${answersText}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;

    endGameSummaryEl.innerHTML = html;
    return;
  }

  // ---------------- Player View ----------------
  if (currentRole === "player") {
    const meStat = combined.find((s) => s.id === currentPlayerId) || null;
    let html = "<p><strong>เกมจบแล้ว</strong></p>";

    if (meStat) {
      const totalQ = meStat.correct + meStat.wrong + meStat.timeout;
      const totalWrongLike = meStat.wrong + meStat.timeout;
      const pctText =
        totalQ > 0 ? Math.round(meStat.pctCorrect).toString() + "%" : "-";

      html += `<p>สรุปผลของคุณ: <strong>${meStat.name}</strong></p>`;
      html += `<ul>`;
      html += `<li>อันดับ: <strong>${meStat.rank ?? "-"}</strong></li>`;
      html += `<li>ตำแหน่งสุดท้ายบนกระดาน: <strong>${meStat.finalPosition}</strong></li>`;
      html += `<li>ถึงเส้นชัยหรือไม่: <strong>${
        meStat.finishRound != null ? "ถึง" : "ยังไม่ถึง"
      }</strong></li>`;
      if (meStat.finishRound != null) {
        html += `<li>รอบที่ถึงเส้นชัย: <strong>${meStat.finishRound}</strong></li>`;
        html += `<li>วิธีถึงเส้นชัย: <strong>${
          meStat.finishViaDice ? "ทอยลูกเต๋าได้ถึงช่อง 30" : "ตอบคำถามจนถึงช่อง 30"
        }</strong></li>`;
      }
      html += `<li>ตอบถูก: <strong>${meStat.correct}</strong> ข้อ</li>`;
      html += `<li>ตอบผิด/ไม่ทัน: <strong>${totalWrongLike}</strong> ข้อ</li>`;
      html += `<li>เปอร์เซ็นต์ตอบถูก: <strong>${pctText}</strong></li>`;
      html += `<li>ผลทอยลูกเต๋าทุกครั้ง: <strong>${
        meStat.rolls.join("") || "-"
      }</strong></li>`;
      html += `<li>ผลคำถามทุกข้อ: <strong>${
        meStat.answerSymbols.join("") || "-"
      }</strong></li>`;
      html += `</ul>`;
    }

    if (winners.length > 0) {
      html += `<p><strong>ผู้เข้าเส้นชัย</strong></p><ul>`;
      winners
        .sort((a, b) => a.finishedRound - b.finishedRound || a.rank - b.rank)
        .forEach((w) => {
          html += `<li>อันดับเข้าเส้นชัย ${w.rank}: ${w.playerName}</li>`;
        });
      html += `</ul>`;
    }

    endGameSummaryEl.innerHTML = html;
  }
}

// ---------------- ปุ่ม / Status ตามบทบาท ----------------
function updateRoleControls(roomData, players) {
  const phase = roomData.phase || "idle";
  const round = roomData.currentRound || 0;
  const deadlineExpired = roomData.answerDeadlineExpired === true;

  // ---------- ส่วนของ Player ----------
  if (currentRole === "player") {
    const me =
      (players && currentPlayerId && players[currentPlayerId]) || {};

    const finished = !!me.finished;
    const rolled = !!me.hasRolled;
    const canRoll = phase === "rolling" && !rolled && !finished;

    // ปุ่มทอยลูกเต๋าของผู้เล่น
    rollDiceBtn.style.display = "inline-block";
    rollDiceBtn.disabled = !canRoll;

    const posText =
      me.position != null ? me.position : 0;
    const lastRollText =
      me.lastRoll != null ? me.lastRoll : "-";

    playerStatusEl.textContent = `ตำแหน่งของคุณ: ${posText} | ทอยล่าสุด: ${lastRollText}`;

    if (finished) {
      playerStatusEl.textContent += " | คุณเข้าเส้นชัยแล้ว (ช่อง 30) รอดูเพื่อนเล่นต่อ";
      rollDiceBtn.disabled = true;
    } else if (phase === "idle" || round === 0) {
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
    } else if (phase === "ended") {
      playerStatusEl.textContent += " | เกมจบแล้ว ดูสรุปผลด้านล่าง";
      rollDiceBtn.style.display = "none";
    }
  }
  // ---------- ส่วนของ Host ----------
  else if (currentRole === "host") {
    rollDiceBtn.style.display = "none";
    playerStatusEl.textContent =
      "คุณกำลังดูสถานะของนักเรียนทั้งหมด / ใช้ปุ่มด้านบนเพื่อควบคุมรอบและคำถาม";
  }
  // ---------- คนที่ยังไม่เลือกบทบาท ----------
  else {
    rollDiceBtn.style.display = "none";
    playerStatusEl.textContent = "";
  }

  // ---------- ปุ่มควบคุมฝั่ง Host ----------
  if (currentRole === "host") {
    const playerList = Object.values(players || {});
    // activePlayers = ยังไม่เข้าเส้นชัย
    const activePlayers = playerList.filter((p) => !p.finished);
    const totalActive = activePlayers.length;
    const rolledActive = activePlayers.filter((p) => p.hasRolled).length;
    const answeredActive = activePlayers.filter((p) => p.answered).length;

    // ปุ่ม Host
    startRoundBtn.disabled = phase === "ended";

    startQuestionBtn.style.display = "inline-block";
    startQuestionBtn.disabled = !(
      phase === "rolling" &&
      totalActive > 0 &&
      rolledActive === totalActive
    );

    revealAnswerBtn.style.display = "inline-block";
    revealAnswerBtn.disabled = phase !== "answering";

    if (phase === "rolling") {
      phaseInfoEl.textContent += ` | ทอยแล้ว ${rolledActive}/${totalActive} คน`;
    } else if (phase === "answering") {
      phaseInfoEl.textContent += ` | ตอบแล้ว ${answeredActive}/${totalActive} คน`;
      if (deadlineExpired) {
        phaseInfoEl.textContent += " | หมดเวลาแล้ว";
      }
    } else if (phase === "ended") {
      startRoundBtn.disabled = true;
      startQuestionBtn.style.display = "none";
      revealAnswerBtn.style.display = "none";
      phaseInfoEl.textContent += " | เกมจบแล้ว";
    }
  } else {
    // ถ้าไม่ใช่ Host ให้ปิดปุ่มควบคุมทั้งหมด
    startRoundBtn.disabled = true;
    startQuestionBtn.style.display = "none";
    revealAnswerBtn.style.display = "none";
  }
}
// ---------------- Animate Dice And Commit Roll ----------------
async function animateDiceAndCommitRoll(basePosition, roomData) {
  return new Promise((resolve) => {
    // กัน user กดซ้ำระหว่างกำลังหมุนเต๋า
    rollDiceBtn.disabled = true;

    const totalDuration = 3000; // 3 วินาที
    const start = Date.now();
    let displayRoll = 1;

    function step() {
      const elapsed = Date.now() - start;
      const remaining = totalDuration - elapsed;

      if (remaining <= 0) {
        const finalRoll = displayRoll; // ใช้ค่าสุดท้ายที่โชว์เป็นผลจริง
        finalizeRoll(finalRoll, basePosition, roomData).then(resolve);
        return;
      }

      // สุ่ม 1–6 สำหรับแสดงผล
      displayRoll = Math.floor(Math.random() * 6) + 1;

      if (currentRole === "player") {
        // แสดงสถานะว่ากำลังหมุนเต๋า
        playerStatusEl.textContent = `กำลังทอยลูกเต๋า... ได้ ${displayRoll}`;
      }

      // กำหนดความถี่การสุ่มให้ช้าลงเรื่อย ๆ
      let delay;
      if (elapsed < 1000) {
        delay = 80;   // วินาทีแรก: เร็ว
      } else if (elapsed < 2000) {
        delay = 150;  // วินาทีที่สอง: เริ่มช้าลง
      } else {
        delay = 250;  // วินาทีสุดท้าย: ช้าลงอีกหน่อย
      }

      setTimeout(step, delay);
    }

    step();
  });
}

async function finalizeRoll(roll, basePosition) {
  let newPos = basePosition + roll;
  if (newPos < 0) newPos = 0;
  if (newPos > BOARD_SIZE) newPos = BOARD_SIZE;

  const updates = {};
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/lastRoll`] = roll;
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/position`] = newPos;
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/hasRolled`] = true;

  // ดึง currentRound มาเก็บ history การเดินด้วยลูกเต๋า
  try {
    const roomRef = ref(db, `rooms/${currentRoomCode}`);
    const snap = await get(roomRef);
    if (snap.exists()) {
      const roomData = snap.val();
      const currentRound = roomData.currentRound || 0;
      if (currentRound > 0) {
        const dicePath = getPathCells(basePosition, newPos);
        updates[
          `rooms/${currentRoomCode}/history/round_${currentRound}/diceMoves/${currentPlayerId}`
        ] = {
          playerId: currentPlayerId,
          playerName: roomData.players?.[currentPlayerId]?.name || "",
          fromPosition: basePosition,
          toPosition: newPos,
          diceRoll: roll,
          pathCells: dicePath,
          timestamp: Date.now(),
        };
      }
    }
  } catch (e) {
    console.error("Error logging dice move history:", e);
  }

  await update(ref(db), updates);
}

// ---------------- Question UI + Timer ----------------
function updateQuestionUI(roomData, players) {
  const phase = roomData.phase || "idle";
  const round = roomData.currentRound || 0;
  const questionIndex = roomData.questionIndex;
  const question =
    questionIndex != null ? getQuestionFromRoom(roomData, questionIndex) : null;

  // ถ้ายังไม่เริ่มรอบ ก็ไม่ต้องแสดง UI
  if (round === 0) {
    questionAreaEl.style.display = "none";
    countdownDisplayEl.textContent = "";
    clearTimer();
    return;
  }

  if (phase === "questionCountdown") {
    // ---------------- ช่วงนับถอยหลัง 3,2,1 ก่อนโชว์คำถาม ----------------
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = `เตรียมคำถามรอบที่ ${round} …`;
    // ยังไม่ต้องแสดงตัวเลือก
    choicesContainerEl.innerHTML = "";
    ensureTimer(roomData, "questionCountdown");
  } else if (phase === "answering" && question) {
    // ---------------- ช่วงให้ทุกคนตอบคำถาม ----------------
    questionAreaEl.style.display = "block";
    questionTextEl.textContent = question.text;

    const me = players[currentPlayerId] || {};
    const selectedOption = me.answer || null;
    const deadlineExpired = roomData.answerDeadlineExpired === true;
    const disableButtons = deadlineExpired || !!me.finished;

    renderChoicesForPhase(
      question,
      selectedOption,
      question.correctOption,
      false,
      disableButtons
    );
    ensureTimer(roomData, "answering");
  } else if (phase === "result" && question) {
    // ---------------- ช่วงเฉลย + ไฮไลต์ถูก/ผิด ----------------
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
      true  // result โชว์อย่างเดียว ไม่มีปุ่มให้กด
    );
    clearTimer();
  } else {
    // phase อื่น ๆ: ซ่อน UI คำถาม
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
      // โหมดเฉลย
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
      btn.disabled = true;
    } else {
      // โหมด answering
      if (selectedOption && key === selectedOption) {
        btn.classList.add("selected");
      }

      if (disableAnswerButtons) {
        btn.disabled = true;
      } else if (currentRole === "player") {
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

  // ถ้า timer เดิมของ phase เดิม + round เดิมยังรันอยู่ก็ไม่ต้องสร้างใหม่
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
          // ให้ Host เป็นคน trigger เปลี่ยน phase → answering
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
function renderBoard(roomData, players) {
  const phase = roomData.phase || "idle";
  const currentRound = roomData.currentRound || 0;
  const history = roomData.history || {};

  boardEl.innerHTML = "";

  // ---------- แถวบนสุด: label Start, 1–30, Finish ----------
  const labelRow = document.createElement("div");
  labelRow.className = "board-label-row";

  const startLabelCell = document.createElement("div");
  startLabelCell.className = "cell-card start-cell";
  const startSpan = document.createElement("span");
  startSpan.className = "cell-label";
  startSpan.textContent = "Start";
  startLabelCell.appendChild(startSpan);
  labelRow.appendChild(startLabelCell);

  for (let i = 1; i <= BOARD_SIZE; i++) {
    const labelCell = document.createElement("div");
    labelCell.className = "cell-card play-cell";
    const span = document.createElement("span");
    span.className = "cell-label";
    span.textContent = i;
    labelCell.appendChild(span);
    labelRow.appendChild(labelCell);
  }

  const finishLabelCell = document.createElement("div");
  finishLabelCell.className = "cell-card finish-cell";
  const finishSpan = document.createElement("span");
  finishSpan.className = "cell-label";
  finishSpan.textContent = "Finish";
  finishLabelCell.appendChild(finishSpan);
  labelRow.appendChild(finishLabelCell);

  boardEl.appendChild(labelRow);

  // helper: สร้าง state สีของช่อง 1–30 สำหรับผู้เล่น 1 คน
  function buildCellStateForPlayer(pid, p) {
    const state = new Array(BOARD_SIZE + 1).fill("none"); // index 1..30

    // 1) ทำสีเทาสำหรับ "รอบก่อนหน้า"
    for (const [rk, roundData] of Object.entries(history)) {
      const m = rk.match(/^round_(\d+)$/);
      if (!m) continue;
      const rNum = parseInt(m[1], 10);
      if (rNum >= currentRound) continue; // เอาเฉพาะรอบที่จบไปแล้ว

      const rec = (roundData.answers || {})[pid];
      if (!rec) continue;

      const base = rec.basePosition || 0;
      const final = rec.finalPosition || base;
      const start = Math.min(base, final) + 1;
      const end = Math.max(base, final);

      for (let pos = start; pos <= end; pos++) {
        if (pos >= 1 && pos <= BOARD_SIZE) {
          state[pos] = "past"; // cell-past → สีเทา
        }
      }
    }

    // 2) รอบปัจจุบัน: สีฟ้าจากลูกเต๋า (phase rolling / countdown / answering)
    if (
      phase === "rolling" ||
      phase === "questionCountdown" ||
      phase === "answering"
    ) {
      if (p.hasRolled && p.lastRoll != null && !p.finished) {
        const endPos = p.position || 0;
        let startPos = endPos - p.lastRoll;
        if (startPos < 0) startPos = 0;

        for (let pos = startPos + 1; pos <= endPos; pos++) {
          if (pos >= 1 && pos <= BOARD_SIZE) {
            state[pos] = "dice"; // cell-dice → สีฟ้า
          }
        }
      }
    }

    // 3) รอบปัจจุบัน: สีเขียว/แดงจากคำถาม (phase result / ended)
    const currKey = `round_${currentRound}`;
    const currRoundData = history[currKey] || {};
    const recNow = (currRoundData.answers || {})[pid];

    if ((phase === "result" || phase === "ended") && recNow) {
      const base = recNow.basePosition || 0;
      const final = recNow.finalPosition || base;
      const start = Math.min(base, final) + 1;
      const end = Math.max(base, final);
      const moveType = recNow.correct ? "correct" : "wrong";

      for (let pos = start; pos <= end; pos++) {
        if (pos >= 1 && pos <= BOARD_SIZE) {
          state[pos] = moveType; // cell-correct หรือ cell-wrong
        }
      }
    }

    return state;
  }

  // ---------- สร้างแถวสำหรับผู้เล่นแต่ละคน ----------
  Object.entries(players || {}).forEach(([pid, p]) => {
    const row = document.createElement("div");
    row.className = "player-row";

    // ชื่อผู้เล่น (จำกัดความยาวด้วย CSS)
    const nameDiv = document.createElement("div");
    nameDiv.className = "player-row-name";
    nameDiv.textContent = p.name || pid;
    row.appendChild(nameDiv);

    const track = document.createElement("div");
    track.className = "board-track";

    // start cell
    const startCell = document.createElement("div");
    startCell.className = "cell-card start-cell";
    track.appendChild(startCell);

    // เตรียม state สีของช่อง
    const cellState = buildCellStateForPlayer(pid, p);

    // ช่อง 1–30
    for (let pos = 1; pos <= BOARD_SIZE; pos++) {
      const cell = document.createElement("div");
      cell.className = "cell-card play-cell";

      // ใส่สีตาม state
      switch (cellState[pos]) {
        case "dice":
          cell.classList.add("cell-dice");
          break;
        case "correct":
          cell.classList.add("cell-correct");
          break;
        case "wrong":
          cell.classList.add("cell-wrong");
          break;
        case "past":
          cell.classList.add("cell-past");
          break;
      }

      // ใส่หมาก (หยดน้ำ) ถ้าตำแหน่งตรงกัน
      if ((p.position || 0) === pos) {
        const token = document.createElement("div");
        token.className = "token";
        token.style.backgroundColor = p.color || "#ffb300";

        const inner = document.createElement("div");
        inner.className = "token-inner";
        inner.textContent = (p.name || "?").charAt(0);

        token.appendChild(inner);
        cell.appendChild(token);
      }

      track.appendChild(cell);
    }

    // finish cell
    const finishCell = document.createElement("div");
    finishCell.className = "cell-card finish-cell";
    track.appendChild(finishCell);

    row.appendChild(track);
    boardEl.appendChild(row);
  });
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

  if (me.finished) {
    alert("คุณเข้าเส้นชัยแล้ว ไม่ต้องตอบคำถาม");
    return;
  }

  if (me.answered) {
    alert("คุณตอบคำถามรอบนี้ไปแล้ว");
    return;
  }

  const updates = {};
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/answer`] = optionKey;
  updates[`rooms/${currentRoomCode}/players/${currentPlayerId}/answered`] = true;

  await update(ref(db), updates);
}

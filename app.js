// app.js
// Step A: Create / Join Room + Lobby realtime
// Host = ครู (ไม่เป็นผู้เล่น), Players = นักเรียน

import { initializeApp as firebaseInitializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
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
console.log("app.js loaded (Step A)");
const app = firebaseInitializeApp(firebaseConfig);
const db = getDatabase(app);

// 2) DOM elements
const createRoomBtn = document.getElementById("createRoomBtn");
const hostNameInput = document.getElementById("hostNameInput");

const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const playerNameInput = document.getElementById("playerNameInput");

const lobbyEl = document.getElementById("lobby");
const roomInfoEl = document.getElementById("roomInfo");
const roleInfoEl = document.getElementById("roleInfo");
const playerListEl = document.getElementById("playerList");

// 3) State ฝั่ง client
let currentRoomCode = null;
let currentRole = null; // "host" หรือ "player"
let currentPlayerId = null; // สำหรับ player
let unsubscribeRoom = null; // เผื่ออยากยกเลิก onValue (ยังไม่ใช้ตอนนี้)

// 4) ฟังก์ชันช่วยสุ่ม id ต่าง ๆ
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

// ---------------- Event: สร้างห้อง (Host) ----------------

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
  currentPlayerId = null; // host ไม่ใช่ผู้เล่น

  const roomRef = ref(db, `rooms/${roomCode}`);

  try {
    await set(roomRef, {
      createdAt: Date.now(),
      status: "lobby",
      hostId: hostId,
      hostName: hostName,
      // players จะถูกเติมเมื่อมีนักเรียน join
    });

    console.log("Room created:", roomCode);
    enterLobbyView();
    subscribeRoom(roomCode);
    alert(`สร้างห้องสำเร็จ!\nRoom Code: ${roomCode}\nแชร์รหัสนี้ให้นักเรียนใช้ Join ได้เลย`);
  } catch (err) {
    console.error("Error creating room:", err);
    alert("มีปัญหาในการสร้างห้อง ดู error ใน Console");
  }
});

// ---------------- Event: Join ห้อง (Player) ----------------

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
      position: 0,
      lastRoll: null,          // จะใช้ใน Step C
      answered: false,         // จะใช้ใน Step D
      lastAnswerCorrect: null, // จะใช้ใน Step D
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

// ---------------- ฟังก์ชัน UI: เข้า Lobby ----------------

function enterLobbyView() {
  lobbyEl.style.display = "block";

  if (currentRoomCode) {
    roomInfoEl.textContent = `Room Code: ${currentRoomCode}`;
  } else {
    roomInfoEl.textContent = "";
  }

  if (currentRole === "host") {
    roleInfoEl.textContent =
      "คุณเป็น Host (ครู): จอนี้จะแสดงรายชื่อผู้เล่นทุกคนตลอดทั้งเกม";
  } else if (currentRole === "player") {
    roleInfoEl.textContent =
      "คุณเป็นผู้เล่น: รอครูเริ่มเกม ระบบจะใช้ชื่อนี้ในกระดานเกม";
  } else {
    roleInfoEl.textContent = "";
  }
}

// ---------------- Subscribe ข้อมูลห้องแบบ realtime ----------------

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

    // อัปเดตข้อมูลห้อง (เผื่อ hostName เปลี่ยน เป็นต้น)
    if (currentRoomCode === roomCode) {
      roomInfoEl.textContent = `Room Code: ${roomCode} | Host: ${hostName}`;
    }

    // อัปเดตรายชื่อผู้เล่น
    renderPlayerList(players);
  });
}

// ---------------- Render รายชื่อผู้เล่นใน Lobby ----------------

function renderPlayerList(playersObj) {
  playerListEl.innerHTML = "";

  const entries = Object.entries(playersObj);

  // เรียงตามเวลาที่เข้าห้อง
  entries.sort((a, b) => {
    const aJoined = a[1].joinedAt || 0;
    const bJoined = b[1].joinedAt || 0;
    return aJoined - bJoined;
  });

  for (const [pid, player] of entries) {
    const li = document.createElement("li");

    li.innerHTML = `
      <div>
        <span class="player-name">${player.name}</span>
        <div class="player-meta">
          ช่องปัจจุบัน: <strong>${player.position}</strong> |
          ทอยลูกเต๋าล่าสุด: <strong>${player.lastRoll ?? "-"}</strong> |
          สถานะคำถาม: 
            <strong>${
              player.answered === false
                ? "ยังไม่ตอบ"
                : player.lastAnswerCorrect === true
                ? "ตอบถูก"
                : player.lastAnswerCorrect === false
                ? "ตอบผิด"
                : "ยังไม่ตอบ"
            }</strong>
        </div>
      </div>
    `;

    playerListEl.appendChild(li);
  }

  if (entries.length === 0) {
    const li = document.createElement("li");
    li.textContent = "ยังไม่มีผู้เล่นเข้าห้อง";
    playerListEl.appendChild(li);
  }
}

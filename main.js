// main.js (minimal version)
// ทดสอบสร้างห้อง + เขียนข้อมูลลง Firebase Realtime Database

import { initializeApp as firebaseInitializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
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
console.log("main.js loaded (minimal)");
const app = firebaseInitializeApp(firebaseConfig);
const db = getDatabase(app);

// 2) DOM elements
const createRoomBtn = document.getElementById("createRoomBtn");
const hostNameInput = document.getElementById("hostNameInput");

// เอาไว้ให้แน่ใจว่า element ถูกเจอจริง
console.log("createRoomBtn =", createRoomBtn);
console.log("hostNameInput =", hostNameInput);

// 3) ฟังก์ชันสุ่ม roomCode และ playerId แบบง่าย ๆ
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

// 4) Event: กดปุ่ม "สร้างห้อง"
createRoomBtn.addEventListener("click", async () => {
  console.log("createRoomBtn clicked");

  const name = hostNameInput.value.trim();
  if (!name) {
    alert("กรุณากรอกชื่อเล่นของ Host");
    return;
  }

  const playerId = createPlayerId();
  const roomCode = createRoomCode();

  console.log("Creating room with code:", roomCode, "for host:", name);

  const roomRef = ref(db, `rooms/${roomCode}`);

  try {
    await set(roomRef, {
      createdAt: Date.now(),
      status: "lobby",
      hostId: playerId,
      players: {
        [playerId]: {
          name: name,
          position: 0,
        },
      },
    });

    alert(`สร้างห้องสำเร็จ! Room Code: ${roomCode}`);
    console.log("Room created successfully");
  } catch (err) {
    console.error("Error creating room:", err);
    alert("มีปัญหาในการสร้างห้อง ดู error ใน Console");
  }
});

// (ยังไม่ทำ join / board / อื่น ๆ ในเวอร์ชัน minimal นี้)

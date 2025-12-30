/***********************
 * CONFIG
 ***********************/
const API = "http://127.0.0.1:8000";
const USER_ID = localStorage.getItem("user_id");
const EXAM_ID = localStorage.getItem("exam_id");

/***********************
 * LOGIN GUARD
 ***********************/
if (!USER_ID || !EXAM_ID) {
  localStorage.clear();
  window.location.replace("login.html");
}

/***********************
 * ELEMENTS
 ***********************/
const video = document.getElementById("video");
const notification = document.getElementById("notification");
const questionEl = document.querySelector(".question");
const questionNoEl = document.getElementById("questionNo");
const optionsEl = document.getElementById("options");

/***********************
 * QUESTIONS (10 MCQs)
 ***********************/
const questions = [
  { q: "What is Artificial Intelligence?", options: ["DBMS", "Making machines intelligent", "OS", "Compiler"], correct: 1 },
  { q: "Machine Learning is a subset of?", options: ["AI", "CN", "OS", "DBMS"], correct: 0 },
  { q: "Supervised learning uses?", options: ["Unlabeled data", "Random data", "Labeled data", "No data"], correct: 2 },
  { q: "Which language is popular for AI?", options: ["HTML", "CSS", "Python", "SQL"], correct: 2 },
  { q: "Neural Networks are inspired by?", options: ["CPU", "Human Brain", "RAM", "Hard Disk"], correct: 1 },
  { q: "Which is NOT AI application?", options: ["Chatbot", "Face recognition", "Calculator", "Self-driving car"], correct: 2 },
  { q: "Deep Learning uses?", options: ["No layers", "Single layer", "Multiple layers", "Files"], correct: 2 },
  { q: "Which algorithm is classification?", options: ["KNN", "Apriori", "K-Means", "PCA"], correct: 0 },
  { q: "Which is unsupervised learning?", options: ["Linear regression", "Decision tree", "K-Means", "Logistic regression"], correct: 2 },
  { q: "Main goal of AI is?", options: ["Store data", "Mimic human intelligence", "Compile code", "Print output"], correct: 1 }
];

let currentQuestion = 0;
const answers = {};

/***********************
 * STATE
 ***********************/
let started = false;
let examStartTime = 0;
let tabSwitchCount = 0;
const MAX_TAB_SWITCH = 4;
let violationLocked = false;
let faceMissingCount = 0;

/***********************
 * INIT
 ***********************/
loadQuestion();

/***********************
 * UI HELPERS
 ***********************/
function showNotification(msg) {
  notification.innerText = msg;
  notification.classList.remove("hidden");
  setTimeout(() => notification.classList.add("hidden"), 3000);
}

/***********************
 * QUESTION RENDER
 ***********************/
function loadQuestion() {
  const q = questions[currentQuestion];
  questionNoEl.innerText = `Question ${currentQuestion + 1} / ${questions.length}`;
  questionEl.innerText = q.q;

  optionsEl.innerHTML = "";
  q.options.forEach((opt, idx) => {
    const checked = answers[currentQuestion] === idx ? "checked" : "";
    optionsEl.innerHTML += `
      <label class="option">
        <input type="radio" name="mcq" ${checked}
          onclick="selectOption(${idx})">
        ${opt}
      </label>
    `;
  });

  const nextBtn = document.getElementById("nextBtn");
  nextBtn.innerText =
    currentQuestion === questions.length - 1 ? "Submit" : "Next";
}

function selectOption(i) {
  answers[currentQuestion] = i;
}

function nextQuestion() {
  if (currentQuestion === questions.length - 1) {
    submitExam();
    return;
  }
  currentQuestion++;
  loadQuestion();
}

function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    loadQuestion();
  }
}

/***********************
 * FULLSCREEN
 ***********************/
function enterFullscreen() {
  document.documentElement.requestFullscreen?.();
}

/***********************
 * START EXAM
 ***********************/
async function startExam() {
  if (started) return;
  started = true;
  examStartTime = Date.now();

  enterFullscreen();

  await fetch(`${API}/start-exam?user_id=${USER_ID}&exam_id=${EXAM_ID}`, {
    method: "POST"
  });

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  addTabSwitchListener();
  addFullscreenListener();
  startFaceDetection();
}

/***********************
 * SUBMIT + RESULT
 ***********************/
function submitExam() {
  let score = 0;

  let html = `
    <div style="max-width:900px;margin:auto;padding:30px;font-family:Segoe UI">
      <h1>Exam Result</h1>
  `;

  questions.forEach((q, i) => {
    const ua = answers[i];
    if (ua === q.correct) score++;

    html += `
      <p><b>Q${i + 1}:</b> ${q.q}</p>
      <p>Your Answer: ${ua !== undefined ? q.options[ua] : "Not Answered"}</p>
      <p>Correct Answer: <b>${q.options[q.correct]}</b></p>
      <hr>
    `;
  });

  html += `
    <h2>Final Score: ${score} / ${questions.length}</h2>
    <button onclick="exitExam()" style="
      margin-top:20px;
      padding:12px 20px;
      background:#ef4444;
      color:white;
      border:none;
      border-radius:10px;
      cursor:pointer;">
      Exit Exam
    </button>
    </div>
  `;

  document.body.innerHTML = html;

  // 🔥 SAVE SCORE
  fetch(`${API}/submit-exam`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: USER_ID,
      exam_id: EXAM_ID,
      score: score
    })
  });
}

function exitExam() {
  localStorage.clear();
  window.location.href = "login.html";
}

/***********************
 * VIOLATIONS
 ***********************/
function handleViolation(msg) {
  if (violationLocked) return;
  violationLocked = true;
  setTimeout(() => violationLocked = false, 1000);

  tabSwitchCount++;
  if (tabSwitchCount > MAX_TAB_SWITCH) {
    terminateExam();
    return;
  }

  showNotification(`${msg} (${tabSwitchCount}/4)`);

  fetch(`${API}/violation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: USER_ID,
      exam_id: EXAM_ID,
      event_type: msg,
      risk: 30
    })
  });
}

function addTabSwitchListener() {
  document.addEventListener("visibilitychange", () => {
    if (!started) return;
    if (Date.now() - examStartTime < 2000) return;
    if (document.visibilityState === "hidden") {
      handleViolation("Tab switch detected");
    }
  });
}

function addFullscreenListener() {
  document.addEventListener("fullscreenchange", () => {
    if (started && !document.fullscreenElement) {
      handleViolation("Fullscreen exited");
    }
  });
}

/***********************
 * FACE DETECTION
 ***********************/
function startFaceDetection() {
  const fd = new FaceDetection({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${f}`
  });

  fd.setOptions({ model: "short", minDetectionConfidence: 0.6 });

  fd.onResults(r => {
    if (!started) return;
    if (!r.detections || r.detections.length === 0) {
      faceMissingCount++;
      if (faceMissingCount >= 3) {
        handleViolation("Face not detected");
        faceMissingCount = 0;
      }
    } else faceMissingCount = 0;
  });

  new Camera(video, {
    onFrame: async () => fd.send({ image: video }),
    width: 640,
    height: 480
  }).start();
}

/***********************
 * TERMINATE
 ***********************/
function terminateExam() {
  document.body.innerHTML = `
    <div style="
      height:100vh;
      display:flex;
      justify-content:center;
      align-items:center;
      flex-direction:column;
      background:#fee2e2;">
      <h1>Exam Terminated</h1>
      <p>Too many violations detected.</p>
    </div>
  `;
}

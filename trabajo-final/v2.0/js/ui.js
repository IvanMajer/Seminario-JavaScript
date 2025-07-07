// js/ui.js
import * as control from "./control.js"

export function renderSetup(onStart) {
  const root = document.getElementById("root")

  // HTML con animaciones y reglas
  const playersHtml = [0, 1]
    .map((i) => {
      return `
      <div class="jugador-setup animate-slide-in" data-jugador="${i}" style="animation-delay: ${i * 0.2}s">
        <div class="player-card">
          <h2 class="player-title">
            <span class="player-icon">🎮</span>
            Jugador ${i + 1}
          </h2>
          <div class="input-group">
            <input type="text" placeholder="Ingresa tu nombre" class="js-nombre fancy-input"/>
            <div class="input-underline"></div>
          </div>
          <div class="avatar-selection">
            <label class="avatar-label">Elige tu avatar:</label>
            <select class="js-avatar fancy-select">
              <option value="😎">😎 Cool</option>
              <option value="🤓">🤓 Nerd</option>
              <option value="🚀">🚀 Rocket</option>
              <option value="⭐">⭐ Star</option>
              <option value="🎯">🎯 Target</option>
              <option value="🔥">🔥 Fire</option>
            </select>
          </div>
          <div class="topics-section">
            <label class="topics-label">Selecciona 2 temas:</label>
            <div class="topics-grid">
              ${["Historia", "Ciencia", "Arte", "Deportes"]
                .map(
                  (t) => `
                  <label class="topic-card">
                    <input type="checkbox" value="${t}"/>
                    <div class="topic-content">
                      <span class="topic-icon">${getTopicIcon(t)}</span>
                      <span class="topic-name">${t}</span>
                    </div>
                  </label>
                `,
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `
    })
    .join("")

  // Inyección en el root con reglas
  root.innerHTML = `
    <div class="setup-container">
      <header class="game-header animate-fade-in">
        <h1 class="main-title">
          <span class="title-icon">⚡</span>
          Versus Preguntas
          <span class="title-icon">⚡</span>
        </h1>
        <p class="subtitle">¡El duelo de conocimientos más épico!</p>
      </header>

      <div class="rules-section animate-slide-up">
        <button class="rules-toggle" id="rules-toggle">
          <span class="rules-icon">📋</span>
          Ver Reglas del Juego
          <span class="arrow">▼</span>
        </button>
        <div class="rules-content" id="rules-content">
          <div class="rules-grid">
            <div class="rule-item">
              <span class="rule-icon">🎯</span>
              <h3>Objetivo</h3>
              <p>Reduce la vida de tu oponente a 0 respondiendo preguntas correctamente</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">🎲</span>
              <h3>Ruleta</h3>
              <p>La ruleta decide el tema de cada pregunta basado en los temas seleccionados</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">⏱️</span>
              <h3>Tiempo</h3>
              <p>Tienes tiempo limitado que disminuye cada ronda. ¡Responde rápido!</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">💔</span>
              <h3>Daño</h3>
              <p>Respuesta correcta: daña al rival. Incorrecta o timeout: te dañas a ti</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">🔄</span>
              <h3>Segunda Oportunidad</h3>
              <p>Si se acaba el tiempo, el otro jugador tiene una chance con menos daño</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">🏆</span>
              <h3>Victoria</h3>
              <p>El último jugador en pie gana la partida</p>
            </div>
          </div>
        </div>
      </div>

      <div class="players-section">
        ${playersHtml}
      </div>

      <div class="start-section animate-bounce-in">
        <button id="start-btn" class="start-button" disabled>
          <span class="btn-icon">🚀</span>
          <span class="btn-text">Iniciar Batalla</span>
          <div class="btn-glow"></div>
        </button>
      </div>
    </div>
  `

  const startBtn = document.getElementById("start-btn")
  const rulesToggle = document.getElementById("rules-toggle")
  const rulesContent = document.getElementById("rules-content")

  // Toggle de reglas
  rulesToggle.addEventListener("click", () => {
    const isOpen = rulesContent.classList.contains("open")
    rulesContent.classList.toggle("open")
    rulesToggle.querySelector(".arrow").textContent = isOpen ? "▼" : "▲"
  })

  // Validación de formulario
  root.addEventListener("input", () => {
    const ok = [0, 1].every((i) => {
      const p = root.querySelector(`.jugador-setup[data-jugador="${i}"]`)
      const nombre = p.querySelector(".js-nombre").value.trim()
      const topics = p.querySelectorAll("input:checked")
      return nombre && topics.length === 2
    })

    startBtn.disabled = !ok
    startBtn.classList.toggle("ready", ok)
  })

  startBtn.addEventListener("click", () => {
    startBtn.classList.add("loading")

    const players = [0, 1].map((i) => {
      const p = root.querySelector(`.jugador-setup[data-jugador="${i}"]`)
      return {
        nombre: p.querySelector(".js-nombre").value.trim(),
        avatar: p.querySelector(".js-avatar").value,
        topics: Array.from(p.querySelectorAll("input:checked")).map((ch) => ch.value),
      }
    })

    setTimeout(() => onStart(players), 1000)
  })
}

function getTopicIcon(topic) {
  const icons = {
    Historia: "🏛️",
    Ciencia: "🔬",
    Arte: "🎨",
    Deportes: "⚽",
  }
  return icons[topic] || "📚"
}

export function renderGame(partida) {
  const root = document.getElementById("root")
  root.innerHTML = `
    <div class="game-container animate-fade-in">
      <div class="game-header">
        <div id="p1-info" class="player-info left"></div>
        <div class="vs-indicator">
          <span class="vs-text">VS</span>
          <div class="vs-glow"></div>
        </div>
        <div id="p2-info" class="player-info right"></div>
      </div>
      
      <div class="game-body">
        <div id="spinner-container" class="spinner-container">
          <div id="spinner" class="spinner"></div>
          <div class="spinner-pointer"></div>
        </div>
        <div id="question-panel" class="question-panel"></div>
      </div>
    </div>
  `
  updateLifeBars(partida.jugadores)
}

export function updateLifeBars(jugadores) {
  jugadores.forEach((p, i) => {
    const el = document.getElementById(`p${i + 1}-info`)
    const pct = Math.round((p.vida / p.maxVida) * 100)
    const isLow = pct <= 25

    el.innerHTML = `
      <div class="player-avatar ${isLow ? "danger" : ""}">${p.avatar}</div>
      <div class="player-details">
        <span class="player-name">${p.nombre}</span>
        <div class="life-container">
          <div class="life-bar ${isLow ? "danger" : ""}">
            <div class="life-fill" style="width:${pct}%"></div>
            <div class="life-shine"></div>
          </div>
          <span class="life-text">${p.vida}/${p.maxVida}</span>
        </div>
      </div>
    `
  })
}

export function renderSpinner(topic, topicIndex, topics) {
  const spinEl = document.getElementById("spinner")
  spinEl.innerHTML = ""
  spinEl.classList.remove("spinning")

  const totalTopics = topics.length
  const segmentAngle = 360 / totalTopics

  // Colores para cada tema
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]

  const segmentsHtml = topics
    .map(
      (t, i) => `
    <div class="segment"
         style="
           transform: rotate(${i * segmentAngle}deg) skewY(${90 - segmentAngle}deg);
           background: linear-gradient(45deg, ${colors[i % colors.length]}, ${colors[(i + 1) % colors.length]});
         ">
      <span class="segment-label">${getTopicIcon(t)} ${t}</span>
    </div>
  `,
    )
    .join("")

  spinEl.innerHTML = segmentsHtml + '<div class="spinner-center">🎯</div>'

  // Animación de giro
  setTimeout(() => {
    spinEl.classList.add("spinning")
    const degs = 360 * 5 + topicIndex * segmentAngle + segmentAngle / 2
    spinEl.style.transform = `rotate(${degs}deg)`

    setTimeout(() => {
      spinEl.classList.remove("spinning")
      control.handleSpinEnd()
    }, 3000)
  }, 100)
}

export function renderQuestion(pregunta) {
  const panel = document.getElementById("question-panel")
  const difficultyStars = "⭐".repeat(pregunta.dificultad)

  panel.innerHTML = `
    <div class="question-container animate-slide-up">
      <div class="question-header">
        <div class="timer-container">
          <div class="timer-circle">
            <span id="timer">${pregunta.dificultad}</span>
          </div>
          <span class="timer-label">segundos</span>
        </div>
        <div class="difficulty">
          <span class="difficulty-label">Dificultad:</span>
          <span class="difficulty-stars">${difficultyStars}</span>
        </div>
      </div>
      
      <div class="question-content">
        <p class="question-text">${pregunta.text}</p>
        <div class="options-grid">
          ${pregunta.opciones
            .map(
              (opt, i) =>
                `<button class="option-btn animate-pop-in" data-idx="${i}" style="animation-delay: ${i * 0.1}s">
              <span class="option-letter">${String.fromCharCode(65 + i)}</span>
              <span class="option-text">${opt}</span>
              <div class="option-glow"></div>
            </button>`,
            )
            .join("")}
        </div>
      </div>
    </div>
  `

  panel.querySelectorAll(".option-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const idx = +e.currentTarget.dataset.idx
      btn.classList.add("selected")
      control.handleAnswer(idx)
    }),
  )
}

export function updateTimer(value) {
  const timer = document.getElementById("timer")
  if (timer) {
    timer.textContent = value
    timer.parentElement.classList.toggle("danger", value <= 3)
  }
}

export function showRoundResult(correct, damage, isTimeout = false, onClose) {
  const msg = isTimeout
    ? `⏰ ¡Se acabó el tiempo! -${damage} de vida`
    : correct
      ? `🎉 ¡Respuesta correcta! -${damage} al rival`
      : `❌ Respuesta incorrecta: -${damage} para ti`

  const icon = isTimeout ? "⏰" : correct ? "🎉" : "❌"
  const className = isTimeout ? "timeout" : correct ? "correct" : "incorrect"

  const modal = document.createElement("div")
  modal.className = "modal animate-fade-in"
  modal.innerHTML = `
    <div class="modal-content ${className} animate-bounce-in">
      <div class="result-icon">${icon}</div>
      <p class="result-message">${msg}</p>
      <button id="modal-ok" class="modal-button">
        <span>Continuar</span>
        <div class="button-shine"></div>
      </button>
    </div>
  `

  document.body.appendChild(modal)

  document.getElementById("modal-ok").addEventListener("click", () => {
    modal.classList.add("animate-fade-out")
    setTimeout(() => {
      document.body.removeChild(modal)
      onClose()
    }, 300)
  })
}

export function renderEnd({ winner, rounds }) {
  const root = document.getElementById("root")
  root.innerHTML = `
    <div class="end-screen animate-fade-in">
      <div class="victory-container animate-bounce-in">
        <div class="confetti"></div>
        <h1 class="victory-title">🏆 ¡Victoria! 🏆</h1>
        <div class="winner-info">
          <div class="winner-avatar">${winner.avatar}</div>
          <h2 class="winner-name">${winner.nombre}</h2>
          <p class="winner-subtitle">¡Eres el campeón del conocimiento!</p>
        </div>
        
        <div class="stats-container">
          <div class="stat-item">
            <span class="stat-icon">🎯</span>
            <span class="stat-label">Rondas jugadas</span>
            <span class="stat-value">${rounds}</span>
          </div>
        </div>
        
        <button id="restart" class="restart-button">
          <span class="btn-icon">🔄</span>
          <span class="btn-text">Jugar de Nuevo</span>
          <div class="btn-glow"></div>
        </button>
      </div>
    </div>
  `

  document.getElementById("restart").addEventListener("click", () => {
    window.location.reload()
  })

  // Efecto de confetti
  createConfetti()
}

function createConfetti() {
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"]

  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement("div")
    confetti.className = "confetti-piece"
    confetti.style.left = Math.random() * 100 + "%"
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
    confetti.style.animationDelay = Math.random() * 3 + "s"
    document.querySelector(".confetti").appendChild(confetti)
  }
}
// js/ui.js - Interfaz de usuario mejorada con pico visual y mejor precisión

import * as control from "./control.js"

// Variables globales para la ruleta
let wheelCanvas, wheelCtx, spinButton
let sectors = []
let isSpinning = false
let currentTopics = []
let targetTopic = ""
let animationId = null
let interactionEnabled = false

const PI = Math.PI
const TAU = 2 * PI
const rad = 200

// NUEVA FUNCIÓN: Habilitar/deshabilitar interacción - MEJORADA
export function enableInteraction(enabled) {
  interactionEnabled = enabled
  console.log("🎮 Interacción", enabled ? "habilitada" : "deshabilitada")

  // Actualizar estado visual de la ruleta
  if (spinButton) {
    // Verificar si hay una pregunta activa
    const questionPanel = document.getElementById("question-panel")
    const hasActiveQuestion = questionPanel && !questionPanel.classList.contains("hidden")

    if (enabled && !isSpinning && !hasActiveQuestion) {
      spinButton.style.opacity = "1"
      spinButton.style.cursor = "pointer"
      spinButton.style.pointerEvents = "auto"
      spinButton.textContent = "GIRAR"
      spinButton.style.background = "#DC143C"
    } else {
      spinButton.style.opacity = "0.5"
      spinButton.style.cursor = "not-allowed"
      spinButton.style.pointerEvents = "none"

      if (hasActiveQuestion) {
        spinButton.textContent = "RESPONDE PRIMERO"
        spinButton.style.background = "#ff9800"
      } else if (isSpinning) {
        spinButton.textContent = "GIRANDO..."
        spinButton.style.background = "#666"
      } else if (!enabled) {
        spinButton.textContent = "ESPERA"
        spinButton.style.background = "#666"
      }
    }
  }

  // Actualizar opciones de pregunta si existen
  const optionsContainer = document.getElementById("options-container")
  if (optionsContainer) {
    const options = optionsContainer.querySelectorAll(".option-item")
    options.forEach((option) => {
      if (enabled) {
        option.style.opacity = "1"
        option.style.cursor = "pointer"
        option.style.pointerEvents = "auto"
      } else {
        option.style.opacity = "0.5"
        option.style.cursor = "not-allowed"
        option.style.pointerEvents = "none"
      }
    })
  }
}

// Renderizar pantalla de espera
export function renderWaiting(message = "Conectando al servidor...") {
  const root = document.getElementById("root")

  root.innerHTML = `
    <div class="waiting-container">
      <div class="waiting-content">
        <div class="spinner"></div>
        <h2>🎮 Versus Preguntas</h2>
        <p>${message}</p>
      </div>
    </div>
  `
}

// Renderizar error
export function renderError(message) {
  const root = document.getElementById("root")

  root.innerHTML = `
    <div class="error-container">
      <div class="error-content">
        <h2>❌ Error</h2>
        <p>${message}</p>
        <button onclick="window.location.reload()" class="retry-button">
          🔄 Reintentar
        </button>
      </div>
    </div>
  `
}

// Mostrar mensaje de turno - MEJORADO
export function showTurnMessage(message, isMyTurn = false) {
  // Remover mensaje anterior si existe
  const existingMessage = document.querySelector(".turn-message")
  if (existingMessage) {
    existingMessage.remove()
  }

  const messageDiv = document.createElement("div")
  messageDiv.className = `turn-message ${isMyTurn ? "my-turn" : "other-turn"}`
  messageDiv.innerHTML = `
    <div class="turn-content ${isMyTurn ? "my-turn-content" : "other-turn-content"}">
      <p>${message}</p>
    </div>
  `

  document.body.appendChild(messageDiv)

  // Auto-remover después de 4 segundos
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove()
    }
  }, 4000)
}

// Función que renderiza la pantalla inicial de configuración
export function renderSetup(onStart, availableTopics) {
  const root = document.getElementById("root")

  root.innerHTML = `
    <div class="setup-container">
      <header class="game-header">
        <h1 class="main-title">🔥 Versus Preguntas 🔥</h1>
        <p class="subtitle">¡El duelo de conocimientos más épico!</p>
      </header>
      
      <div class="player-setup-single">
        <h2>⚙️ Configura tu Jugador</h2>
        
        <div class="input-group">
          <label>Nombre:</label>
          <input type="text" id="player-name" placeholder="Ingresa tu nombre" class="fancy-input"/>
        </div>
        
        <div class="avatar-group">
          <label>Elige tu avatar:</label>
          <div class="avatar-grid">
            ${generateAvatarOptions()}
          </div>
        </div>
        
        <div class="topics">
          <label>Selecciona exactamente 2 temas:</label>
          <div class="topics-grid">
            ${availableTopics
              .map(
                (tema) => `
                <label class="topic-card">
                  <input type="checkbox" value="${tema.nombre}"/> 
                  <span class="topic-icon">${tema.icono}</span>
                  <span>${tema.nombre}</span>
                </label>
              `,
              )
              .join("")}
          </div>
        </div>
        
        <button id="ready-btn" class="start-button" disabled>
          ✅ Estoy Listo
        </button>
      </div>
    </div>
  `

  const readyBtn = document.getElementById("ready-btn")
  const nameInput = document.getElementById("player-name")

  // Validación en tiempo real
  root.addEventListener("input", () => {
    const nombre = nameInput.value.trim()
    const avatar = root.querySelector('input[name="avatar"]:checked')
    const topics = root.querySelectorAll('input[type="checkbox"]:checked')

    const isValid = nombre && avatar && topics.length === 2
    readyBtn.disabled = !isValid
    readyBtn.classList.toggle("ready", isValid)
  })

  // Event listener para el botón de listo
  readyBtn.addEventListener("click", () => {
    const nombre = nameInput.value.trim()
    const avatar = root.querySelector('input[name="avatar"]:checked').value
    const topics = Array.from(root.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => checkbox.value)

    onStart({
      nombre: nombre,
      avatar: avatar,
      topics: topics,
    })
  })
}

// Generar opciones de avatar
function generateAvatarOptions() {
  const avatars = [
    { url: "/assets/avatars/avatar1.png", name: "Chica Rosa" },
    { url: "/assets/avatars/avatar2.png", name: "Chica Roja" },
    { url: "/assets/avatars/avatar3.png", name: "Chico Gorra" },
    { url: "/assets/avatars/avatar4.png", name: "Chico Rizado" },
  ]

  return avatars
    .map((avatar, index) => {
      return `
        <label class="avatar-option">
          <input type="radio" name="avatar" value="${avatar.url}">
          <img src="${avatar.url}" alt="Avatar ${avatar.name}" class="avatar-img">
        </label>
        `
    })
    .join("")
}

// Renderizar pantalla de juego
export function renderGame(gameData, availableTopics) {
  const root = document.getElementById("root")

  root.innerHTML = `
    <div class="game-container">
      <div id="p1-info" class="player-info player-top"></div>
      
      <div class="wheel-container">
        <div id="spin_the_wheel">
          <canvas id="wheel" width="400" height="400"></canvas>
          <div id="wheel-pointer" class="wheel-pointer">▼</div>
          <div id="spin">GIRAR</div>
        </div>
      </div>
      
      <div class="question-area">
        <div class="round-header">
          <h2>RONDA: <span id="round-number">${gameData.round}</span></h2>
        </div>
        
        <div id="question-panel" class="question-panel-new hidden">
          <div class="timer-section">
            <div class="timer-circle">
              <span id="timer">0</span>
            </div>
          </div>
          
          <div class="question-content-new">
            <div class="question-text-area">
              <p id="question-text">Esperando pregunta...</p>
            </div>
            
            <div class="question-layout">
              <div class="options-section">
                <div class="options-container" id="options-container">
                  <!-- Las opciones aparecerán aquí -->
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div id="waiting-turn" class="waiting-turn">
          <p>Esperando que gire la ruleta...</p>
        </div>
      </div>
      
      <div id="p2-info" class="player-info player-bottom"></div>
    </div>
  `

  // Actualizar información de jugadores
  updateLifeBars(gameData.jugadores)

  // Inicializar la ruleta
  setTimeout(() => {
    if (gameData.topicsEnJuego && gameData.topicsEnJuego.length > 0) {
      console.log("🎡 Inicializando ruleta con temas:", gameData.topicsEnJuego)
      initWheel(gameData.topicsEnJuego, availableTopics)
    }
  }, 500)

  console.log("🎮 Pantalla de juego renderizada")
}

// Actualizar barras de vida
export function updateLifeBars(jugadores) {
  jugadores.forEach((player, index) => {
    const playerInfoDiv = document.getElementById(`p${index + 1}-info`)
    if (!playerInfoDiv) return

    const lifePercentage = Math.round((player.vida / player.maxVida) * 100)
    const isLowLife = lifePercentage <= 25

    playerInfoDiv.innerHTML = `
      <div class="player-avatar ${isLowLife ? "danger" : ""}">
        <img src="${player.avatar}" alt="${player.nombre}" class="avatar-image"
             onerror="this.src='data:image/svg+xml;charset=utf-8,%3Csvg width=\'64\' height=\'64\' viewBox=\'0 0 64 64\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'32\' cy=\'32\' r=\'32\' fill=\'%23DC143C\'/%3E%3Ccircle cx=\'32\' cy=\'24\' r=\'8\' fill=\'white\'/%3E%3Cpath d=\'M20 48 Q32 40 44 48 L44 56 Q32 64 20 56 Z\' fill=\'white\'/%3E%3C/svg%3E'">
      </div>
      <div class="player-details">
        <span class="player-name">${player.nombre}</span>
        <div class="life-container">
          <div class="life-bar ${isLowLife ? "danger" : ""}">
            <div class="life-fill" style="width:${lifePercentage}%"></div>
          </div>
          <span class="life-text">${player.vida}/${player.maxVida}</span>
        </div>
      </div>
    `
  })
}

// Actualizar número de ronda
export function updateRoundNumber(round) {
  const roundElement = document.getElementById("round-number")
  if (roundElement) {
    roundElement.textContent = round
  }
}

// Inicializar ruleta - MEJORADO con mejor precisión
function initWheel(topics, availableTopics) {
  console.log("🎡 Inicializando ruleta con temas:", topics)

  currentTopics = [...topics]
  wheelCanvas = document.querySelector("#wheel")
  wheelCtx = wheelCanvas?.getContext("2d")
  spinButton = document.querySelector("#spin")

  if (!wheelCanvas || !wheelCtx || !spinButton) {
    console.error("❌ No se encontraron elementos de la ruleta")
    return
  }

  // Crear sectores basados en los temas
  sectors = topics.map((topicName, index) => {
    const temaInfo = availableTopics.find((t) => t.nombre === topicName)
    return {
      color: temaInfo ? temaInfo.color : "#DC143C",
      text: "#FFFFFF",
      label: `${temaInfo ? temaInfo.icono : "📚"} ${topicName}`,
      topicName: topicName,
    }
  })

  console.log("🎯 Sectores creados:", sectors)

  isSpinning = false
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // Dibujar ruleta inicial
  drawWheel(0)

  // Configurar botón de girar - MEJORADO
  const newSpinButton = spinButton.cloneNode(true)
  spinButton.parentNode.replaceChild(newSpinButton, spinButton)
  spinButton = newSpinButton

  spinButton.addEventListener("click", () => {
    if (!isSpinning && interactionEnabled) {
      console.log("🎲 Click en ruleta - intentando girar")
      control.spinWheel()
    } else {
      console.log("🎲 Click en ruleta ignorado - spinning:", isSpinning, "enabled:", interactionEnabled)
    }
  })

  // Aplicar estado inicial de interacción
  enableInteraction(interactionEnabled)

  console.log("🎯 Ruleta inicializada correctamente")
}

// Dibujar ruleta - MEJORADO con mejor precisión
function drawWheel(rotation) {
  if (!wheelCtx || !sectors.length) return

  wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height)
  const arc = TAU / sectors.length

  sectors.forEach((sector, i) => {
    const startAngle = arc * i + rotation

    wheelCtx.save()
    wheelCtx.beginPath()
    wheelCtx.fillStyle = sector.color
    wheelCtx.moveTo(rad, rad)
    wheelCtx.arc(rad, rad, rad, startAngle, startAngle + arc)
    wheelCtx.lineTo(rad, rad)
    wheelCtx.fill()

    // Dibujar borde entre sectores
    wheelCtx.strokeStyle = "#FFFFFF"
    wheelCtx.lineWidth = 3
    wheelCtx.beginPath()
    wheelCtx.moveTo(rad, rad)
    wheelCtx.lineTo(rad + rad * Math.cos(startAngle), rad + rad * Math.sin(startAngle))
    wheelCtx.stroke()

    wheelCtx.translate(rad, rad)
    wheelCtx.rotate(startAngle + arc / 2)
    wheelCtx.textAlign = "right"
    wheelCtx.fillStyle = sector.text
    wheelCtx.font = "bold 16px Arial"
    wheelCtx.fillText(sector.label, rad - 20, 6)

    wheelCtx.restore()
  })

  // Dibujar círculo exterior
  wheelCtx.beginPath()
  wheelCtx.arc(rad, rad, rad, 0, TAU)
  wheelCtx.strokeStyle = "#333"
  wheelCtx.lineWidth = 4
  wheelCtx.stroke()
}

// Renderizar animación de ruleta - MEJORADO
export function renderSpinner(topic, topicIndex, topics, availableTopics) {
  console.log(`🎲 Preparando ruleta para tema: ${topic} (índice: ${topicIndex})`)

  // Ocultar panel de pregunta y mostrar mensaje de espera
  const questionPanel = document.getElementById("question-panel")
  const waitingTurn = document.getElementById("waiting-turn")

  if (questionPanel) questionPanel.classList.add("hidden")
  if (waitingTurn) {
    waitingTurn.style.display = "block"
    waitingTurn.innerHTML = "<p>🎲 Girando la ruleta...</p>"
  }

  targetTopic = topic

  // Verificar que el índice sea correcto
  if (topicIndex >= 0 && topicIndex < topics.length && topics[topicIndex] === topic) {
    console.log(`✅ Índice correcto: ${topicIndex} -> ${topic}`)
  } else {
    console.error(`❌ Error de índice: ${topicIndex} no corresponde a ${topic}`)
    console.error("Topics array:", topics)
  }

  // Inicializar ruleta si es necesario
  if (!wheelCanvas || JSON.stringify(currentTopics) !== JSON.stringify(topics)) {
    initWheel(topics, availableTopics)
  } else {
    targetTopic = topic
  }

  // Iniciar animación de giro
  setTimeout(() => {
    startSpin(topicIndex)
  }, 500)
}

// Iniciar animación de giro - MEJORADO con precisión exacta
function startSpin(targetIndex) {
  if (isSpinning || !spinButton) return

  console.log(`🎲 Iniciando giro hacia índice: ${targetIndex} (${targetTopic})`)

  if (targetIndex === -1 || targetIndex >= currentTopics.length) {
    console.error("❌ Índice objetivo inválido:", targetIndex)
    return
  }

  isSpinning = true

  // Actualizar botón visualmente
  spinButton.textContent = "GIRANDO..."
  spinButton.style.background = "#666"
  spinButton.style.pointerEvents = "none"
  spinButton.style.opacity = "0.7"

  const arc = TAU / sectors.length

  // CÁLCULO MEJORADO: El pico apunta hacia arriba (12 o'clock = -PI/2)
  // Queremos que el sector targetIndex esté en la parte superior
  const targetAngle = -(targetIndex * arc + arc / 2) - PI / 2

  const duration = 3000
  const spins = 5
  const totalRotation = TAU * spins + targetAngle

  const startTime = Date.now()
  let currentRotation = 0

  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOut = 1 - Math.pow(1 - progress, 3)

    currentRotation = totalRotation * easeOut
    drawWheel(currentRotation)

    if (progress < 1) {
      animationId = requestAnimationFrame(animate)
    } else {
      finishSpin()
    }
  }

  animate()
}

// Terminar giro
function finishSpin() {
  isSpinning = false

  if (spinButton) {
    spinButton.textContent = "GIRAR"
    spinButton.style.background = "#DC143C"
    spinButton.style.color = "#FFFFFF"

    // Restaurar estado según interacción habilitada
    if (interactionEnabled) {
      spinButton.style.pointerEvents = "auto"
      spinButton.style.opacity = "1"
    } else {
      spinButton.style.pointerEvents = "none"
      spinButton.style.opacity = "0.5"
    }
  }

  // Ocultar mensaje de espera
  const waitingTurn = document.getElementById("waiting-turn")
  if (waitingTurn) {
    waitingTurn.style.display = "none"
  }

  console.log("🎯 Ruleta terminó de girar en:", targetTopic)
  control.handleSpinEnd()
}

// Renderizar pregunta - MEJORADO para deshabilitar ruleta
export function renderQuestion(pregunta, canAnswer = true) {
  console.log("❓ Renderizando pregunta:", pregunta.text, "Can answer:", canAnswer)
  console.log("📋 Tema de la pregunta:", pregunta.topic)

  const questionPanel = document.getElementById("question-panel")
  const waitingTurn = document.getElementById("waiting-turn")

  if (!questionPanel) {
    console.error("❌ No se encontró el panel de preguntas")
    return
  }

  // Ocultar mensaje de espera
  if (waitingTurn) {
    waitingTurn.style.display = "none"
  }

  // DESHABILITAR RULETA INMEDIATAMENTE cuando se muestra una pregunta
  if (spinButton) {
    spinButton.style.opacity = "0.3"
    spinButton.style.cursor = "not-allowed"
    spinButton.style.pointerEvents = "none"
    spinButton.textContent = canAnswer ? "RESPONDE PRIMERO" : "ESPERANDO..."
    spinButton.style.background = "#ff9800"
  }

  // Actualizar texto de la pregunta
  const questionText = document.getElementById("question-text")
  if (questionText) {
    questionText.textContent = pregunta.text
  }

  // Generar opciones
  const optionsContainer = document.getElementById("options-container")
  if (optionsContainer) {
    // Limpiar opciones anteriores
    optionsContainer.innerHTML = ""

    optionsContainer.innerHTML = pregunta.opciones
      .map(
        (opcion, i) => `
      <div class="option-item ${!canAnswer ? "disabled" : ""}" data-idx="${i}">
        <div class="option-checkbox"></div>
        <span class="option-text">${opcion}</span>
      </div>
    `,
      )
      .join("")

    // Agregar event listeners a las opciones solo si puede responder
    if (canAnswer) {
      optionsContainer.querySelectorAll(".option-item").forEach((item) => {
        item.addEventListener("click", (event) => {
          // Verificar que aún puede interactuar
          if (!interactionEnabled) {
            console.log("❌ Interacción deshabilitada")
            return
          }

          const selectedIndex = +event.currentTarget.dataset.idx

          // Marcar como seleccionada
          item.classList.add("selected")

          // Deshabilitar todas las opciones inmediatamente
          optionsContainer.querySelectorAll(".option-item").forEach((opt) => {
            opt.style.pointerEvents = "none"
            opt.classList.add("disabled")
          })

          console.log(`🤔 Opción seleccionada: ${selectedIndex} (${pregunta.opciones[selectedIndex]})`)
          control.handleAnswer(selectedIndex)
        })
      })
    }
  }

  // Aplicar estado de interacción
  enableInteraction(canAnswer)

  // Mostrar panel de preguntas
  questionPanel.classList.remove("hidden")
}

// NUEVA FUNCIÓN: Limpiar estado de pregunta
export function clearQuestionState() {
  console.log("🧹 Limpiando estado de pregunta")

  const questionPanel = document.getElementById("question-panel")
  if (questionPanel) {
    questionPanel.classList.add("hidden")
  }

  const waitingTurn = document.getElementById("waiting-turn")
  if (waitingTurn) {
    waitingTurn.style.display = "block"
    waitingTurn.innerHTML = "<p>Esperando siguiente acción...</p>"
  }

  // Restaurar estado de la ruleta si es el turno del jugador
  if (spinButton && interactionEnabled) {
    spinButton.style.opacity = "1"
    spinButton.style.cursor = "pointer"
    spinButton.style.pointerEvents = "auto"
    spinButton.textContent = "GIRAR"
    spinButton.style.background = "#DC143C"
  }
}

// Actualizar temporizador
export function updateTimer(value) {
  const timerElement = document.getElementById("timer")
  if (timerElement) {
    timerElement.textContent = value
    const timerCircle = timerElement.parentElement
    if (timerCircle) {
      timerCircle.classList.toggle("danger", value <= 3)
    }
  }
}

// Mostrar resultado de ronda - MEJORADO para segunda oportunidad
export function showRoundResult(correct, damage, isTimeout = false, onClose) {
  let message

  if (isTimeout) {
    message = `⏰ ¡Se acabó el tiempo! -${damage} de vida`
  } else if (correct) {
    message = `🎉 ¡Respuesta correcta! El rival pierde ${damage} de vida`
  } else {
    message = `❌ Respuesta incorrecta: Pierdes ${damage} de vida`
  }

  const icon = isTimeout ? "⏰" : correct ? "🎉" : "❌"
  const className = isTimeout ? "timeout" : correct ? "correct" : "incorrect"

  const modal = document.createElement("div")
  modal.className = "modal"
  modal.innerHTML = `
    <div class="modal-content ${className}">
      <div class="result-icon">${icon}</div>
      <p class="result-message">${message}</p>
      <button id="modal-ok" class="modal-button">Continuar</button>
    </div>
  `

  document.body.appendChild(modal)

  document.getElementById("modal-ok").addEventListener("click", () => {
    document.body.removeChild(modal)
    if (onClose) onClose()
  })
}

// Renderizar pantalla final
export function renderEnd({ winner, rounds }) {
  const root = document.getElementById("root")

  console.log("🏆 Juego terminado. Ganador:", winner.nombre)

  root.innerHTML = `
    <div class="end-screen">
      <div class="victory-container">
        <h1 class="victory-title">🏆 ¡Victoria! 🏆</h1>
        <div class="winner-info">
          <div class="winner-avatar">
            <img src="${winner.avatar}" alt="${winner.nombre}" class="winner-avatar-img"
                 onerror="this.src='data:image/svg+xml;charset=utf-8,%3Csvg width=\'64\' height=\'64\' viewBox=\'0 0 64 64\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'32\' cy=\'32\' r=\'32\' fill=\'%23DC143C\'/%3E%3Ccircle cx=\'32\' cy=\'24\' r=\'8\' fill=\'white\'/%3E%3Cpath d=\'M20 48 Q32 40 44 48 L44 56 Q32 64 20 56 Z\' fill=\'white\'/%3E%3C/svg%3E'">
          </div>
          <h2 class="winner-name">${winner.nombre}</h2>
          <p class="winner-subtitle">¡Eres el campeón del conocimiento!</p>
        </div>
        
        <div class="stats-container">
          <div class="stat-item">
            <span class="stat-icon">🎯</span>
            <span class="stat-label">Rondas jugadas:</span>
            <span class="stat-value">${rounds}</span>
          </div>
        </div>
        
        <button id="restart" class="restart-button">
          🔄 Jugar de Nuevo
        </button>
      </div>
    </div>
  `

  document.getElementById("restart").addEventListener("click", () => {
    window.location.reload()
  })
}

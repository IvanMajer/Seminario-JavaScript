// js/ui.js - Interfaz de usuario con gestión de salas

import * as control from "./control.js"

// Variables globales para la ruleta
let wheelCanvas, wheelCtx, spinButton
const sectors = []
const isSpinning = false
const currentTopics = []
const targetTopic = ""
const animationId = null
let interactionEnabled = false

const PI = Math.PI
const TAU = 2 * PI
const rad = 200

// Habilitar/deshabilitar interacción
export function enableInteraction(enabled) {
  interactionEnabled = enabled
  console.log("🎮 Interacción", enabled ? "habilitada" : "deshabilitada")

  // Actualizar estado visual de la ruleta
  if (spinButton) {
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

// NUEVA: Renderizar lobby de salas
export function renderLobby() {
  const root = document.getElementById("root")

  root.innerHTML = `
    <div class="lobby-container">
      <header class="lobby-header">
        <h1 class="main-title">🔥 Versus Preguntas 🔥</h1>
        <p class="subtitle">¡El duelo de conocimientos más épico!</p>
      </header>

      <div class="lobby-content">
        <div class="create-room-section">
          <h2>🏗️ Crear Nueva Sala</h2>
          <div class="create-room-form">
            <input 
              type="text" 
              id="room-name-input" 
              placeholder="Nombre de la sala (opcional)" 
              class="room-input"
              maxlength="20"
            />
            <button id="create-room-btn" class="create-room-button">
              ✨ Crear Sala
            </button>
          </div>
          <p class="create-room-hint">
            💡 Si no especificas un nombre, se generará un código automáticamente
          </p>
        </div>

        <div class="join-room-section">
          <h2>🚪 Unirse a Sala</h2>
          <div class="join-room-form">
            <input 
              type="text" 
              id="room-code-input" 
              placeholder="Código de la sala" 
              class="room-input"
              maxlength="20"
            />
            <button id="join-room-btn" class="join-room-button">
              🎯 Unirse
            </button>
          </div>
        </div>

        <div class="rooms-list-section">
          <div class="rooms-header">
            <h2>🏠 Salas Disponibles</h2>
            <button id="refresh-rooms-btn" class="refresh-button">
              🔄 Actualizar
            </button>
          </div>
          <div id="rooms-list" class="rooms-list">
            <div class="loading-rooms">
              <div class="spinner"></div>
              <p>Cargando salas...</p>
            </div>
          </div>
        </div>
      </div>

      <div class="server-stats" id="server-stats"></div>
    </div>
  `

  // Event listeners usando referencias directas a las funciones
  const createRoomBtn = document.getElementById("create-room-btn")
  const joinRoomBtn = document.getElementById("join-room-btn")
  const refreshRoomsBtn = document.getElementById("refresh-rooms-btn")
  const roomNameInput = document.getElementById("room-name-input")
  const roomCodeInput = document.getElementById("room-code-input")

  createRoomBtn.addEventListener("click", () => {
    const roomName = roomNameInput.value.trim() || null
    control.createRoom(roomName)
  })

  joinRoomBtn.addEventListener("click", () => {
    const roomCode = roomCodeInput.value.trim().toUpperCase()
    if (roomCode) {
      control.joinRoom(roomCode)
    } else {
      showError("Por favor ingresa un código de sala")
    }
  })

  refreshRoomsBtn.addEventListener("click", () => {
    control.requestRoomList()
  })

  // Enter key support
  roomNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      createRoomBtn.click()
    }
  })

  roomCodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      joinRoomBtn.click()
    }
  })

  // Auto-uppercase room code input
  roomCodeInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase()
  })

  // Solicitar estadísticas del servidor
  setTimeout(() => {
    control.requestServerStats()
    control.requestRoomList()
  }, 500)
}

// NUEVA: Actualizar lista de salas - CORREGIDO para usar event listeners
export function updateRoomList(rooms) {
  const roomsList = document.getElementById("rooms-list")
  if (!roomsList) return

  if (rooms.length === 0) {
    roomsList.innerHTML = `
      <div class="no-rooms">
        <p>🏜️ No hay salas disponibles</p>
        <p class="no-rooms-hint">¡Sé el primero en crear una!</p>
      </div>
    `
    return
  }

  roomsList.innerHTML = rooms
    .map(
      (room) => `
    <div class="room-card ${!room.canJoin ? "room-full" : ""}">
      <div class="room-info">
        <div class="room-name">
          <h3>${room.name}</h3>
          <span class="room-code">${room.code}</span>
        </div>
        <div class="room-details">
          <span class="room-players">👥 ${room.players}/${room.maxPlayers}</span>
          <span class="room-status ${room.canJoin ? "waiting" : "full"}">${room.status}</span>
        </div>
      </div>
      <div class="room-actions">
        <button 
          class="copy-code-btn" 
          data-room-code="${room.code}"
          title="Copiar código"
        >
          📋
        </button>
        <button 
          class="join-room-card-btn ${!room.canJoin ? "disabled" : ""}" 
          data-room-code="${room.code}"
          ${!room.canJoin ? "disabled" : ""}
        >
          ${room.canJoin ? "🎯 Unirse" : "🔒 Llena"}
        </button>
      </div>
    </div>
  `,
    )
    .join("")

  // Agregar event listeners después de crear el HTML
  const copyButtons = roomsList.querySelectorAll(".copy-code-btn")
  const joinButtons = roomsList.querySelectorAll(".join-room-card-btn")

  copyButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      const roomCode = e.target.getAttribute("data-room-code")
      control.copyRoomCode(roomCode)
    })
  })

  joinButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      if (!e.target.disabled) {
        const roomCode = e.target.getAttribute("data-room-code")
        control.joinRoom(roomCode)
      }
    })
  })
}

// NUEVA: Renderizar sala de espera
export function renderRoomWaiting(roomData, playerNumber) {
  const root = document.getElementById("root")

  root.innerHTML = `
    <div class="room-waiting-container">
      <header class="room-header">
        <div class="room-title">
          <h1>🏠 Sala: ${roomData.name || roomData.code}</h1>
          <div class="room-code-display">
            <span class="code-label">Código:</span>
            <span class="code-value">${roomData.code}</span>
            <button class="copy-code-button" id="copy-code-btn" data-room-code="${roomData.code}">
              📋 Copiar
            </button>
          </div>
        </div>
        <button class="leave-room-button" id="leave-room-btn">
          ← Volver al Lobby
        </button>
      </header>

      <div class="room-content">
        <div class="players-section">
          <h2>👥 Jugadores (${roomData.players || 1}/2)</h2>
          <div class="players-grid" id="players-grid">
            <div class="player-slot ${playerNumber === 0 ? "my-slot" : ""}">
              <div class="player-avatar-placeholder">
                <span class="player-number">1</span>
              </div>
              <div class="player-info">
                <span class="player-label">${playerNumber === 0 ? "Tú" : "Esperando..."}</span>
                <span class="player-status">${playerNumber === 0 ? "Listo" : "Vacío"}</span>
              </div>
            </div>
            <div class="player-slot ${playerNumber === 1 ? "my-slot" : ""}">
              <div class="player-avatar-placeholder">
                <span class="player-number">2</span>
              </div>
              <div class="player-info">
                <span class="player-label">${playerNumber === 1 ? "Tú" : "Esperando..."}</span>
                <span class="player-status">${playerNumber === 1 ? "Listo" : "Vacío"}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="waiting-message">
          <div class="spinner"></div>
          <h3>⏳ Esperando al segundo jugador...</h3>
          <p>Comparte el código <strong>${roomData.code}</strong> con un amigo para que se una</p>
        </div>
      </div>
    </div>
  `

  // Agregar event listeners
  const copyCodeBtn = document.getElementById("copy-code-btn")
  const leaveRoomBtn = document.getElementById("leave-room-btn")

  copyCodeBtn.addEventListener("click", (e) => {
    const roomCode = e.target.getAttribute("data-room-code")
    control.copyRoomCode(roomCode)
  })

  leaveRoomBtn.addEventListener("click", () => {
    control.returnToLobby()
  })
}

// NUEVA: Actualizar información de la sala
export function updateRoomInfo(roomData) {
  const playersGrid = document.getElementById("players-grid")
  if (!playersGrid) return

  // Actualizar información de jugadores si están disponibles
  if (roomData.players && roomData.players.length > 0) {
    roomData.players.forEach((player, index) => {
      const playerSlot = playersGrid.children[index]
      if (playerSlot) {
        const playerInfo = playerSlot.querySelector(".player-info")
        const playerLabel = playerInfo.querySelector(".player-label")
        const playerStatus = playerInfo.querySelector(".player-status")

        if (player.nombre) {
          playerLabel.textContent = player.nombre
          playerStatus.textContent = player.ready ? "Listo" : "Configurando..."
        }
      }
    })

    // Si ambos jugadores están listos, mostrar mensaje de inicio
    const allReady = roomData.players.length === 2 && roomData.players.every((p) => p.ready)
    if (allReady) {
      const waitingMessage = document.querySelector(".waiting-message")
      if (waitingMessage) {
        waitingMessage.innerHTML = `
          <div class="starting-game">
            <div class="spinner"></div>
            <h3>🚀 ¡Iniciando partida!</h3>
            <p>Ambos jugadores están listos</p>
          </div>
        `
      }
    }
  }

  // Si se unió el segundo jugador, mostrar configuración
  if (roomData.players && roomData.players.length === 2 && !roomData.gameStarted) {
    setTimeout(() => {
      renderSetup((playerData) => {
        control.configurePlayer(playerData)
      }, getDefaultTopics())
    }, 1000)
  }
}

// Obtener temas por defecto (temporal hasta que se carguen los datos)
function getDefaultTopics() {
  return [
    { nombre: "Historia", icono: "🏛️", color: "#8B4513" },
    { nombre: "Ciencia", icono: "🔬", color: "#4169E1" },
    { nombre: "Arte", icono: "🎨", color: "#9932CC" },
    { nombre: "Deportes", icono: "⚽", color: "#228B22" },
    { nombre: "Geografía", icono: "🌍", color: "#20B2AA" },
    { nombre: "Música", icono: "🎵", color: "#FF1493" },
  ]
}

// NUEVA: Mostrar error
export function showError(message) {
  // Remover error anterior si existe
  const existingError = document.querySelector(".error-message")
  if (existingError) {
    existingError.remove()
  }

  const errorDiv = document.createElement("div")
  errorDiv.className = "error-message"
  errorDiv.innerHTML = `
    <div class="error-content">
      <span class="error-icon">❌</span>
      <span class="error-text">${message}</span>
    </div>
  `

  document.body.appendChild(errorDiv)

  // Auto-remover después de 4 segundos
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove()
    }
  }, 4000)
}

// NUEVA: Actualizar estadísticas del servidor
export function updateServerStats(stats) {
  const statsElement = document.getElementById("server-stats")
  if (statsElement) {
    statsElement.innerHTML = `
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-number">${stats.totalRooms}</span>
          <span class="stat-label">Salas Totales</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${stats.activeGames}</span>
          <span class="stat-label">Partidas Activas</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${stats.waitingRooms}</span>
          <span class="stat-label">Salas Esperando</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${stats.totalPlayers}</span>
          <span class="stat-label">Jugadores Online</span>
        </div>
      </div>
    `
  }
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

// Mostrar mensaje de turno
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
        <div class="match-info">
          <p>✅ ¡Ambos jugadores conectados! Configura tu perfil para comenzar</p>
        </div>
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
    { url: "/placeholder.svg?height=64&width=64", name: "Avatar 1" },
    { url: "/placeholder.svg?height=64&width=64", name: "Avatar 2" },
    { url: "/placeholder.svg?height=64&width=64", name: "Avatar 3" },
    { url: "/placeholder.svg?height=64&width=64", name: "Avatar 4" },
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
      <div class="game-header-info">
        <div class="room-info">
          <span class="room-id">Sala: ${gameData.roomCode || "N/A"}</span>
          <span class="players-count">👥 2/2 jugadores</span>
        </div>
      </div>
      
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
  updateLifeBars(gameData.players)

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
             onerror="this.src='/placeholder.svg?height=64&width=64'">
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

// Inicializar ruleta
function initWheel(topics, availableTopics) {
  console.log("🎡 Inicializando ruleta con temas:", topics)

  currentTopics.length = 0
  currentTopics.push(...topics)
  wheelCanvas = document.querySelector("#wheel")
  wheelCtx = wheelCanvas?.getContext("2d")
  spinButton = document.querySelector("#spin")

  if (!wheelCanvas || !wheelCtx || !spinButton) {
    console.error("❌ No se encontraron elementos de la ruleta")
    return
  }

  // Crear sectores basados en los temas
  sectors.length = 0
  topics.forEach((topicName, index) => {
    const temaInfo = availableTopics.find((t) => t.nombre === topicName)
    sectors.push({
      color: temaInfo ? temaInfo.color : "#DC143C",
      text: "#FFFFFF",
      label: `${temaInfo ? temaInfo.icono : "📚"} ${topicName}`,
      topicName: topicName,
    })
  })

  console.log("🎯 Sectores creados:", sectors)

  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  // Dibujar ruleta inicial
  drawWheel(0)

  // Configurar botón de girar con event listener
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

// Dibujar ruleta
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

// Renderizar animación de ruleta
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

  // Inicializar ruleta si es necesario
  if (!wheelCanvas || JSON.stringify(currentTopics) !== JSON.stringify(topics)) {
    initWheel(topics, availableTopics)
  }

  // Iniciar animación de giro
  setTimeout(() => {
    startSpin(topicIndex, topic)
  }, 500)
}

// Iniciar animación de giro
function startSpin(targetIndex, targetTopicName) {
  if (isSpinning || !spinButton) return

  console.log(`🎲 Iniciando giro hacia índice: ${targetIndex} (${targetTopicName})`)

  if (targetIndex === -1 || targetIndex >= currentTopics.length) {
    console.error("❌ Índice objetivo inválido:", targetIndex)
    return
  }

  // Actualizar botón visualmente
  spinButton.textContent = "GIRANDO..."
  spinButton.style.background = "#666"
  spinButton.style.pointerEvents = "none"
  spinButton.style.opacity = "0.7"

  const arc = TAU / sectors.length
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
      requestAnimationFrame(animate)
    } else {
      finishSpin()
    }
  }

  animate()
}

// Terminar giro
function finishSpin() {
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

  console.log("🎯 Ruleta terminó de girar")
  control.handleSpinEnd()
}

// Renderizar pregunta
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

// Mostrar resultado de ronda
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
export function renderEnd({ winner, rounds, roomCode }) {
  const root = document.getElementById("root")

  console.log("🏆 Juego terminado. Ganador:", winner.nombre)

  root.innerHTML = `
    <div class="end-screen">
      <div class="victory-container">
        <h1 class="victory-title">🏆 ¡Victoria! 🏆</h1>
        <div class="winner-info">
          <div class="winner-avatar">
            <img src="${winner.avatar}" alt="${winner.nombre}" class="winner-avatar-img"
                 onerror="this.src='/placeholder.svg?height=120&width=120'">
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
          ${
            roomCode
              ? `
          <div class="stat-item">
            <span class="stat-icon">🏠</span>
            <span class="stat-label">Sala:</span>
            <span class="stat-value">${roomCode}</span>
          </div>
          `
              : ""
          }
        </div>
        
        <div class="end-actions">
          <button id="restart" class="restart-button">
            🔄 Volver al Lobby
          </button>
          <button id="stats" class="stats-button">
            📊 Ver Estadísticas del Servidor
          </button>
        </div>
      </div>
    </div>
  `

  document.getElementById("restart").addEventListener("click", () => {
    control.returnToLobby()
  })

  document.getElementById("stats").addEventListener("click", () => {
    control.requestServerStats()
  })
}

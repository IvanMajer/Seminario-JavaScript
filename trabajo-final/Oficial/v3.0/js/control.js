// js/control.js - Controlador para sistema de gestión de salas

import * as ui from "./ui.js"

// Variables del juego
let miNumeroJugador = null
let gameData = null
let timerInterval = null
let currentGameState = null
let gameSocket = null
let canInteract = false
let currentRoomCode = null
let isInRoom = false

// Función que se ejecuta cuando carga la página
export function init() {
  console.log("🎮 Iniciando cliente con gestión de salas...")

  // Cargar datos del juego primero
  loadGameData()
    .then(() => {
      // Configurar eventos de WebSocket después de cargar datos
      setupSocketEvents()
      // Mostrar lobby de salas
      ui.renderLobby()
    })
    .catch((error) => {
      console.error("❌ Error inicializando:", error)
      ui.renderError("Error cargando el juego")
    })
}

// Configurar eventos de WebSocket
function setupSocketEvents() {
  // Verificar que io esté disponible
  if (typeof window.io === "undefined") {
    console.error("❌ Socket.IO no está disponible")
    ui.renderError("Error de conexión: Socket.IO no disponible")
    return
  }

  // Crear conexión
  gameSocket = window.io()

  // Lista de salas actualizada
  gameSocket.on("room-list-updated", (rooms) => {
    console.log("🏠 Lista de salas actualizada:", rooms)
    if (!isInRoom) {
      ui.updateRoomList(rooms)
    }
  })

  // Resultado de creación de sala
  gameSocket.on("room-creation-result", (result) => {
    console.log("🏗️ Resultado creación de sala:", result)
    if (result.success) {
      currentRoomCode = result.roomCode
      miNumeroJugador = result.playerNumber
      isInRoom = true
      ui.renderRoomWaiting(result.room, result.playerNumber)
    } else {
      ui.showError(result.error)
    }
  })

  // Resultado de unirse a sala
  gameSocket.on("room-join-result", (result) => {
    console.log("🚪 Resultado unirse a sala:", result)
    if (result.success) {
      currentRoomCode = result.roomCode
      miNumeroJugador = result.playerNumber
      isInRoom = true
      ui.renderRoomWaiting(result.room, result.playerNumber)
    } else {
      ui.showError(result.error)
    }
  })

  // Sala unida exitosamente
  gameSocket.on("room-joined", (data) => {
    console.log("✅ Unido a sala:", data)
    currentRoomCode = data.roomCode
    miNumeroJugador = data.playerNumber
    isInRoom = true
    ui.renderRoomWaiting(data, data.playerNumber)
  })

  // Sala actualizada
  gameSocket.on("room-updated", (data) => {
    console.log("🔄 Sala actualizada:", data)
    if (isInRoom && data.roomCode === currentRoomCode) {
      ui.updateRoomInfo(data)
    }
  })

  // Juego iniciado
  gameSocket.on("game-started", (data) => {
    console.log(`🚀 Juego iniciado en sala ${data.roomCode}!`, data)
    currentGameState = data
    isInRoom = true

    // Renderizar pantalla de juego
    ui.renderGame(data, gameData.metadata.temas)

    // Mostrar mensaje inicial de turno
    setTimeout(() => {
      const isMyTurn = data.jugadorActual === miNumeroJugador
      canInteract = isMyTurn

      if (isMyTurn) {
        ui.showTurnMessage("¡Es tu turno! Gira la ruleta", true)
        ui.enableInteraction(true)
      } else {
        ui.showTurnMessage(`Turno de ${data.players[data.jugadorActual].nombre}`, false)
        ui.enableInteraction(false)
      }
    }, 1000)
  })

  // Turno actualizado
  gameSocket.on("turn-updated", (data) => {
    console.log(`🔄 Turno actualizado en sala ${data.roomCode}:`, data)
    currentGameState = data

    const isMyTurn = data.jugadorActual === miNumeroJugador
    canInteract = isMyTurn

    // Actualizar número de ronda si existe
    ui.updateRoundNumber(data.round)

    // Mostrar mensaje de turno y habilitar/deshabilitar interacción
    ui.showTurnMessage(data.message, isMyTurn)
    ui.enableInteraction(isMyTurn)
  })

  // Ruleta girada
  gameSocket.on("wheel-spun", (data) => {
    console.log(`🎲 Resultado de ruleta en sala ${data.roomCode}:`, data)

    // Deshabilitar interacción para todos mientras gira la ruleta
    canInteract = false
    ui.enableInteraction(false)

    // Mostrar mensaje apropiado
    if (data.jugadorQueGiro === miNumeroJugador) {
      ui.showTurnMessage("Has girado la ruleta... ¡Esperando pregunta!", false)
    } else {
      ui.showTurnMessage(`${currentGameState.players[data.jugadorQueGiro].nombre} ha girado la ruleta`, false)
    }

    ui.renderSpinner(data.topic, data.topicIndex, data.topics, gameData.metadata.temas)
  })

  // Mostrar pregunta
  gameSocket.on("question-shown", (data) => {
    console.log(`❓ Mostrando pregunta en sala ${data.roomCode}:`, data)

    const isMyTurn = data.jugadorActual === miNumeroJugador
    canInteract = isMyTurn

    // Mostrar mensaje apropiado
    if (isMyTurn) {
      if (data.isSecondChance) {
        ui.showTurnMessage("¡Segunda oportunidad! Es tu turno de responder", true)
      } else {
        ui.showTurnMessage("¡Es tu turno! Responde la pregunta", true)
      }
    } else {
      ui.showTurnMessage(`${currentGameState.players[data.jugadorActual].nombre} está respondiendo...`, false)
    }

    ui.renderQuestion(data, isMyTurn)

    if (isMyTurn) {
      startTimer(data)
    }
  })

  // Segunda oportunidad
  gameSocket.on("second-chance", (data) => {
    console.log(`🔄 Segunda oportunidad en sala ${data.roomCode}:`, data)
    clearInterval(timerInterval)

    const isMyTurn = data.nuevoJugadorActual === miNumeroJugador
    canInteract = isMyTurn

    ui.showRoundResult(false, data.damage, true, () => {
      ui.updateLifeBars(data.players)

      // Actualizar el estado actual del juego
      currentGameState = {
        ...currentGameState,
        jugadorActual: data.nuevoJugadorActual,
        players: data.players,
      }

      // Mostrar mensaje apropiado
      if (isMyTurn) {
        ui.showTurnMessage("¡Segunda oportunidad! Es tu turno", true)
        ui.enableInteraction(true)
        ui.renderQuestion(data.pregunta, true)
        startTimer(data.pregunta)
      } else {
        ui.showTurnMessage("Segunda oportunidad para el otro jugador", false)
        ui.enableInteraction(false)
        ui.renderQuestion(data.pregunta, false)
      }
    })
  })

  // Resultado de ronda
  gameSocket.on("round-result", (data) => {
    console.log(`📊 Resultado de ronda en sala ${data.roomCode}:`, data)
    clearInterval(timerInterval)
    timerInterval = null
    canInteract = false

    // Mensaje especial para segunda oportunidad
    let message = data.correct ? "¡Respuesta correcta!" : "Respuesta incorrecta"
    if (data.isSecondChance) {
      message = data.correct ? "¡Segunda oportunidad aprovechada!" : "Segunda oportunidad fallida"
    }

    ui.showRoundResult(data.correct, data.damage, false, () => {
      ui.updateLifeBars(data.players)

      // Ocultar panel de pregunta
      const questionPanel = document.getElementById("question-panel")
      if (questionPanel) {
        questionPanel.classList.add("hidden")
      }

      if (data.gameOver) {
        setTimeout(() => {
          ui.renderEnd({
            winner: data.winner,
            rounds: data.rounds,
            roomCode: data.roomCode,
          })
        }, 1000)
      }
    })
  })

  // Timeout final
  gameSocket.on("timeout-final", (data) => {
    console.log(`⏰ Timeout final en sala ${data.roomCode}:`, data)
    clearInterval(timerInterval)
    timerInterval = null
    canInteract = false

    ui.showRoundResult(false, data.damage, true, () => {
      ui.updateLifeBars(data.players)

      // Ocultar panel de pregunta
      const questionPanel = document.getElementById("question-panel")
      if (questionPanel) {
        questionPanel.classList.add("hidden")
      }

      if (data.gameOver) {
        setTimeout(() => {
          ui.renderEnd({
            winner: data.winner,
            rounds: data.rounds,
            roomCode: data.roomCode,
          })
        }, 1000)
      }
    })
  })

  // Mensaje de error
  gameSocket.on("error-message", (message) => {
    console.log("❌ Error:", message)
    ui.showTurnMessage(`❌ ${message}`, false)
  })

  // Jugador desconectado
  gameSocket.on("player-disconnected", (data) => {
    console.log(`👋 Jugador desconectado en sala ${data.roomCode}:`, data)
    ui.showTurnMessage("Un jugador se desconectó", false)

    // Si el juego no ha comenzado, volver al lobby
    if (!currentGameState || !currentGameState.gameStarted) {
      setTimeout(() => {
        returnToLobby()
      }, 3000)
    }
  })

  // Estadísticas del servidor
  gameSocket.on("server-stats", (stats) => {
    console.log("📊 Estadísticas del servidor:", stats)
    ui.updateServerStats(stats)
  })
}

// Cargar datos del juego
async function loadGameData() {
  try {
    console.log("📚 Cargando datos del juego...")
    const response = await fetch("data/preguntas.json")
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    gameData = await response.json()
    console.log("✅ Datos cargados:", gameData.preguntas.length, "preguntas")
  } catch (error) {
    console.error("❌ Error cargando datos:", error)
    throw error
  }
}

// Crear sala
export function createRoom(roomName = null) {
  console.log("🏗️ Creando sala:", roomName)
  if (gameSocket) {
    gameSocket.emit("create-room", { roomName: roomName })
  }
}

// Unirse a sala
export function joinRoom(roomCode) {
  console.log("🚪 Uniéndose a sala:", roomCode)
  if (gameSocket) {
    gameSocket.emit("join-room", { roomCode: roomCode })
  }
}

// Solicitar lista de salas
export function requestRoomList() {
  if (gameSocket) {
    gameSocket.emit("request-room-list")
  }
}

// Configurar jugador
export function configurePlayer(playerData) {
  console.log("⚙️ Configurando jugador:", playerData)
  if (gameSocket) {
    gameSocket.emit("configure-player", {
      nombre: playerData.nombre,
      avatar: playerData.avatar,
      topics: playerData.topics,
    })
  }
}

// Girar ruleta
export function spinWheel() {
  console.log("🎲 Intentando girar ruleta...")

  if (!canInteract) {
    console.log("❌ No puedo interactuar en este momento")
    ui.showTurnMessage("¡No es tu turno!", false)
    return
  }

  if (!gameSocket || !currentGameState) {
    console.log("❌ No hay conexión o estado del juego")
    return
  }

  if (currentGameState.jugadorActual !== miNumeroJugador) {
    console.log("❌ No es mi turno")
    ui.showTurnMessage("¡No es tu turno!", false)
    return
  }

  // Verificar si hay una pregunta visible
  const questionPanel = document.getElementById("question-panel")
  if (questionPanel && !questionPanel.classList.contains("hidden")) {
    console.log("❌ No puedo girar - hay una pregunta activa")
    ui.showTurnMessage("¡Debes responder la pregunta actual!", false)
    return
  }

  // Verificar si el temporizador está activo
  if (timerInterval) {
    console.log("❌ No puedo girar - hay un temporizador activo")
    ui.showTurnMessage("¡Debes responder la pregunta actual!", false)
    return
  }

  console.log("✅ Girando ruleta...")
  canInteract = false
  ui.enableInteraction(false)
  gameSocket.emit("spin-wheel")
}

// Responder pregunta
export function handleAnswer(choiceIdx) {
  console.log(`🤔 Intentando responder: ${choiceIdx}`)

  if (!canInteract) {
    console.log("❌ No puedo responder en este momento")
    return
  }

  if (!gameSocket || !currentGameState) {
    console.log("❌ No hay conexión o estado del juego")
    return
  }

  if (currentGameState.jugadorActual !== miNumeroJugador) {
    console.log("❌ No es mi turno para responder")
    return
  }

  console.log(`✅ Respondiendo: ${choiceIdx}`)
  clearInterval(timerInterval)
  canInteract = false
  ui.enableInteraction(false)
  gameSocket.emit("answer-question", { choiceIdx })
}

// Iniciar temporizador
function startTimer(pregunta) {
  const maxTime = getMaxTime(pregunta.dificultad)
  let timeLeft = maxTime

  console.log(`⏰ Iniciando temporizador: ${maxTime} segundos`)
  ui.updateTimer(timeLeft)

  timerInterval = setInterval(() => {
    timeLeft--
    ui.updateTimer(timeLeft)

    if (timeLeft <= 0) {
      clearInterval(timerInterval)
      if (canInteract && gameSocket && currentGameState && currentGameState.jugadorActual === miNumeroJugador) {
        console.log("⏰ Tiempo agotado, enviando timeout")
        canInteract = false
        ui.enableInteraction(false)
        gameSocket.emit("question-timeout")
      }
    }
  }, 1000)
}

// Calcular tiempo máximo según dificultad
function getMaxTime(dificultad) {
  return Math.max(10, 17 - dificultad * 2)
}

// Volver al lobby
export function returnToLobby() {
  console.log("🏠 Volviendo al lobby...")
  isInRoom = false
  currentRoomCode = null
  miNumeroJugador = null
  currentGameState = null
  canInteract = false

  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  ui.renderLobby()
  requestRoomList()
}

// Solicitar estadísticas del servidor
export function requestServerStats() {
  if (gameSocket) {
    gameSocket.emit("get-server-stats")
  }
}

// Copiar código de sala al portapapeles
export function copyRoomCode(roomCode) {
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(roomCode)
      .then(() => {
        ui.showTurnMessage(`📋 Código ${roomCode} copiado al portapapeles`, false)
      })
      .catch(() => {
        ui.showTurnMessage("❌ Error al copiar código", false)
      })
  } else {
    // Fallback para navegadores sin soporte de clipboard
    const textArea = document.createElement("textarea")
    textArea.value = roomCode
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand("copy")
      ui.showTurnMessage(`📋 Código ${roomCode} copiado al portapapeles`, false)
    } catch (err) {
      ui.showTurnMessage("❌ Error al copiar código", false)
    }
    document.body.removeChild(textArea)
  }
}

// Funciones legacy para compatibilidad
export function handleSpinEnd() {
  console.log("🎯 Ruleta terminó de girar")
}

export function nextTurn() {
  console.log("🔄 Siguiente turno manejado por servidor")
}

// SOLUCIÓN AL PROBLEMA: Exponer funciones al objeto global window
// Esto permite que los onclick handlers en HTML funcionen correctamente
if (typeof window !== "undefined") {
  // Crear objeto global control
  window.control = {
    createRoom,
    joinRoom,
    requestRoomList,
    configurePlayer,
    spinWheel,
    handleAnswer,
    returnToLobby,
    requestServerStats,
    copyRoomCode,
    handleSpinEnd,
    nextTurn,
  }

  console.log("🌐 Funciones de control expuestas globalmente")
}

// js/control.js - Controlador corregido

import * as ui from "./ui.js"

// Variables del juego
let miNumeroJugador = null
let gameData = null
let timerInterval = null
let currentGameState = null
let gameSocket = null

// Función que se ejecuta cuando carga la página
export function init() {
  console.log("🎮 Iniciando cliente del juego...")

  // Cargar datos del juego primero
  loadGameData()
    .then(() => {
      // Configurar eventos de WebSocket después de cargar datos
      setupSocketEvents()
      // Mostrar pantalla de espera
      ui.renderWaiting()
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

  // Jugador asignado
  gameSocket.on("jugador-asignado", (playerNumber) => {
    miNumeroJugador = playerNumber
    console.log(`👤 Soy el jugador ${miNumeroJugador + 1}`)

    if (playerNumber === 0) {
      ui.renderWaiting("Esperando al segundo jugador...")
    }
  })

  // Sala llena
  gameSocket.on("sala-llena", () => {
    ui.renderError("La sala está llena. Solo se permiten 2 jugadores.")
  })

  // Estado actualizado
  gameSocket.on("estado-actualizado", (state) => {
    currentGameState = state
    console.log("📊 Estado actualizado:", state)

    if (state.totalPlayers === 2 && !state.gameStarted) {
      if (!document.querySelector(".setup-container")) {
        ui.renderSetup((playerData) => startGame(playerData), gameData.metadata.temas)
      }
    }
  })

  // Juego iniciado
  gameSocket.on("juego-iniciado", (data) => {
    console.log("🚀 Juego iniciado!", data)
    currentGameState = data

    // Renderizar pantalla de juego
    ui.renderGame(data, gameData.metadata.temas)

    // Mostrar mensaje inicial de turno
    setTimeout(() => {
      if (data.jugadorActual === miNumeroJugador) {
        ui.showTurnMessage("¡Es tu turno! Gira la ruleta")
      } else {
        ui.showTurnMessage(`Turno de ${data.jugadores[data.jugadorActual].nombre}`)
      }
    }, 1000)
  })

  // Nuevo evento para manejar turnos
  gameSocket.on("turno-actualizado", (data) => {
    console.log("🔄 Turno actualizado:", data)
    currentGameState = data

    // Actualizar número de ronda si existe
    ui.updateRoundNumber(data.round)

    // Mostrar mensaje de turno
    ui.showTurnMessage(data.message)
  })

  // Ruleta girada
  gameSocket.on("ruleta-girada", (data) => {
    console.log("🎲 Resultado de ruleta:", data)
    ui.renderSpinner(data.topic, data.topicIndex, data.topics, gameData.metadata.temas)
  })

  // Mostrar pregunta
  gameSocket.on("mostrar-pregunta", (pregunta) => {
    console.log("❓ Mostrando pregunta:", pregunta)
    ui.renderQuestion(pregunta)
    startTimer(pregunta)
  })

  // Resultado de ronda
  gameSocket.on("resultado-ronda", (data) => {
    console.log("📊 Resultado de ronda:", data)
    clearInterval(timerInterval)

    ui.showRoundResult(data.correct, data.damage, false, () => {
      ui.updateLifeBars(data.jugadores)

      if (data.gameOver) {
        setTimeout(() => {
          ui.renderEnd({ winner: data.winner, rounds: data.rounds })
        }, 1000)
      }
    })
  })

  // Segunda oportunidad
  gameSocket.on("segunda-oportunidad", (data) => {
    console.log("🔄 Segunda oportunidad:", data)
    clearInterval(timerInterval)

    ui.showRoundResult(false, data.damage, true, () => {
      ui.updateLifeBars(data.jugadores)

      if (data.nuevoJugadorActual === miNumeroJugador) {
        ui.showTurnMessage("¡Segunda oportunidad! Es tu turno")
        ui.renderQuestion(data.pregunta)
        startTimer(data.pregunta)
      } else {
        ui.showTurnMessage("Segunda oportunidad para el otro jugador")
      }
    })
  })

  // Timeout final
  gameSocket.on("timeout-final", (data) => {
    console.log("⏰ Timeout final:", data)
    clearInterval(timerInterval)

    ui.showRoundResult(false, data.damage, true, () => {
      ui.updateLifeBars(data.jugadores)

      if (data.gameOver) {
        setTimeout(() => {
          ui.renderEnd({ winner: data.winner, rounds: data.rounds })
        }, 1000)
      }
    })
  })

  // Siguiente turno
  gameSocket.on("siguiente-turno", (data) => {
    console.log("➡️ Siguiente turno:", data)
    currentGameState = data

    // Actualizar número de ronda
    ui.updateRoundNumber(data.round)

    if (data.jugadorActual === miNumeroJugador) {
      ui.showTurnMessage(`¡Ronda ${data.round}! Es tu turno - Gira la ruleta`)
    } else {
      ui.showTurnMessage(`Ronda ${data.round} - Turno de ${data.jugadores[data.jugadorActual].nombre}`)
    }
  })

  // Jugador desconectado
  gameSocket.on("jugador-desconectado", () => {
    ui.renderError("El otro jugador se desconectó. Recargando...")
    setTimeout(() => {
      window.location.reload()
    }, 3000)
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

// Iniciar juego
function startGame(playerData) {
  console.log("⚙️ Configurando jugador:", playerData)

  if (gameSocket) {
    gameSocket.emit("configurar-jugador", {
      nombre: playerData.nombre,
      avatar: playerData.avatar,
      topics: playerData.topics,
    })

    ui.renderWaiting("Esperando a que el otro jugador termine su configuración...")
  }
}

// Girar ruleta
export function spinWheel() {
  console.log("🎲 Intentando girar ruleta...")
  console.log("Estado actual:", currentGameState)
  console.log("Mi número:", miNumeroJugador)

  if (gameSocket && currentGameState) {
    if (currentGameState.jugadorActual === miNumeroJugador) {
      console.log("✅ Es mi turno, girando ruleta...")
      gameSocket.emit("girar-ruleta")
    } else {
      console.log("❌ No es mi turno")
      ui.showTurnMessage("¡No es tu turno!")
    }
  } else {
    console.log("❌ No hay conexión o estado del juego")
  }
}

// Responder pregunta
export function handleAnswer(choiceIdx) {
  if (gameSocket && currentGameState && currentGameState.jugadorActual === miNumeroJugador) {
    console.log(`🤔 Respondiendo: ${choiceIdx}`)
    clearInterval(timerInterval)
    gameSocket.emit("responder", { choiceIdx })
  } else {
    console.log("❌ No es tu turno o no hay conexión")
  }
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
      if (gameSocket && currentGameState && currentGameState.jugadorActual === miNumeroJugador) {
        console.log("⏰ Tiempo agotado, enviando timeout")
        gameSocket.emit("timeout")
      }
    }
  }, 1000)
}

// Calcular tiempo máximo según dificultad
function getMaxTime(dificultad) {
  return Math.max(10, 17 - dificultad * 2)
}

// Funciones legacy para compatibilidad
export function handleSpinEnd() {
  console.log("🎯 Ruleta terminó de girar")
}

export function nextTurn() {
  console.log("🔄 Siguiente turno manejado por servidor")
}

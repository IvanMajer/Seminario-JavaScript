// js/control.js - Controlador mejorado con mejor control de turnos

import * as ui from "./ui.js"

// Variables del juego
let miNumeroJugador = null
let gameData = null
let timerInterval = null
let currentGameState = null
let gameSocket = null
let canInteract = false // NUEVO: controla si puedo interactuar

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
      const isMyTurn = data.jugadorActual === miNumeroJugador
      canInteract = isMyTurn

      if (isMyTurn) {
        ui.showTurnMessage("¡Es tu turno! Gira la ruleta", true)
        ui.enableInteraction(true)
      } else {
        ui.showTurnMessage(`Turno de ${data.jugadores[data.jugadorActual].nombre}`, false)
        ui.enableInteraction(false)
      }
    }, 1000)
  })

  // Turno actualizado - MEJORADO
  gameSocket.on("turno-actualizado", (data) => {
    console.log("🔄 Turno actualizado:", data)
    currentGameState = data

    const isMyTurn = data.jugadorActual === miNumeroJugador
    canInteract = isMyTurn

    // Actualizar número de ronda si existe
    ui.updateRoundNumber(data.round)

    // Mostrar mensaje de turno y habilitar/deshabilitar interacción
    ui.showTurnMessage(data.message, isMyTurn)
    ui.enableInteraction(isMyTurn)
  })

  // Ruleta girada - MEJORADO
  gameSocket.on("ruleta-girada", (data) => {
    console.log("🎲 Resultado de ruleta:", data)

    // Deshabilitar interacción para todos mientras gira la ruleta
    canInteract = false
    ui.enableInteraction(false)

    // Mostrar mensaje apropiado
    if (data.jugadorQueGiro === miNumeroJugador) {
      ui.showTurnMessage("Has girado la ruleta... ¡Esperando pregunta!", false)
    } else {
      ui.showTurnMessage(`${currentGameState.jugadores[data.jugadorQueGiro].nombre} ha girado la ruleta`, false)
    }

    ui.renderSpinner(data.topic, data.topicIndex, data.topics, gameData.metadata.temas)
  })

  // Mostrar pregunta - MEJORADO
  gameSocket.on("mostrar-pregunta", (data) => {
    console.log("❓ Mostrando pregunta:", data)

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
      ui.showTurnMessage(`${currentGameState.jugadores[data.jugadorActual].nombre} está respondiendo...`, false)
    }

    ui.renderQuestion(data, isMyTurn)

    if (isMyTurn) {
      startTimer(data)
    }
  })

  // Segunda oportunidad - MEJORADO
  gameSocket.on("segunda-oportunidad", (data) => {
    console.log("🔄 Segunda oportunidad:", data)
    clearInterval(timerInterval)

    const isMyTurn = data.nuevoJugadorActual === miNumeroJugador
    canInteract = isMyTurn

    ui.showRoundResult(false, data.damage, true, () => {
      ui.updateLifeBars(data.jugadores)

      // Actualizar el estado actual del juego
      currentGameState = {
        ...currentGameState,
        jugadorActual: data.nuevoJugadorActual,
        jugadores: data.jugadores,
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

  // Resultado de ronda - MEJORADO para segunda oportunidad
  gameSocket.on("resultado-ronda", (data) => {
    console.log("📊 Resultado de ronda:", data)
    clearInterval(timerInterval)
    timerInterval = null // LIMPIAR REFERENCIA
    canInteract = false

    // Mensaje especial para segunda oportunidad
    let message = data.correct ? "¡Respuesta correcta!" : "Respuesta incorrecta"
    if (data.isSecondChance) {
      message = data.correct ? "¡Segunda oportunidad aprovechada!" : "Segunda oportunidad fallida"
    }

    ui.showRoundResult(data.correct, data.damage, false, () => {
      ui.updateLifeBars(data.jugadores)

      // OCULTAR PANEL DE PREGUNTA
      const questionPanel = document.getElementById("question-panel")
      if (questionPanel) {
        questionPanel.classList.add("hidden")
      }

      if (data.gameOver) {
        setTimeout(() => {
          ui.renderEnd({ winner: data.winner, rounds: data.rounds })
        }, 1000)
      }
    })
  })

  // Timeout final
  gameSocket.on("timeout-final", (data) => {
    console.log("⏰ Timeout final:", data)
    clearInterval(timerInterval)
    timerInterval = null // LIMPIAR REFERENCIA
    canInteract = false

    ui.showRoundResult(false, data.damage, true, () => {
      ui.updateLifeBars(data.jugadores)

      // OCULTAR PANEL DE PREGUNTA
      const questionPanel = document.getElementById("question-panel")
      if (questionPanel) {
        questionPanel.classList.add("hidden")
      }

      if (data.gameOver) {
        setTimeout(() => {
          ui.renderEnd({ winner: data.winner, rounds: data.rounds })
        }, 1000)
      }
    })
  })

  // Error de turno - NUEVO
  gameSocket.on("error-turno", (message) => {
    console.log("❌ Error de turno:", message)
    ui.showTurnMessage(`❌ ${message}`, false)
  })

  // Jugador desconectado - MEJORADO
  gameSocket.on("jugador-desconectado", (data) => {
    console.log("👋 Jugador desconectado:", data)

    if (data && data.waitingForReconnection) {
      ui.renderWaiting("Un jugador se desconectó. Esperando reconexión...")
    } else {
      ui.renderError("El otro jugador se desconectó. Recargando...")
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    }
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

// Girar ruleta - MEJORADO con validaciones
export function spinWheel() {
  console.log("🎲 Intentando girar ruleta...")
  console.log("¿Puedo interactuar?", canInteract)
  console.log("Estado actual:", currentGameState)
  console.log("Mi número:", miNumeroJugador)

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

  // NUEVA VALIDACIÓN: Verificar si hay una pregunta visible
  const questionPanel = document.getElementById("question-panel")
  if (questionPanel && !questionPanel.classList.contains("hidden")) {
    console.log("❌ No puedo girar - hay una pregunta activa")
    ui.showTurnMessage("¡Debes responder la pregunta actual!", false)
    return
  }

  // NUEVA VALIDACIÓN: Verificar si el temporizador está activo
  if (timerInterval) {
    console.log("❌ No puedo girar - hay un temporizador activo")
    ui.showTurnMessage("¡Debes responder la pregunta actual!", false)
    return
  }

  console.log("✅ Girando ruleta...")
  canInteract = false // Deshabilitar inmediatamente
  ui.enableInteraction(false)
  gameSocket.emit("girar-ruleta")
}

// Responder pregunta - MEJORADO con validaciones
export function handleAnswer(choiceIdx) {
  console.log(`🤔 Intentando responder: ${choiceIdx}`)
  console.log("¿Puedo interactuar?", canInteract)

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
  gameSocket.emit("responder", { choiceIdx })
}

// Iniciar temporizador - MEJORADO
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

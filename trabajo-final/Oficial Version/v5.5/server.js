const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const fs = require("fs")
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = socketIo(server)

// Servir archivos estáticos
app.use(express.static(__dirname))

// Cargar preguntas
let preguntasData = null
try {
  const preguntasPath = path.join(__dirname, "data", "preguntas.json")
  preguntasData = JSON.parse(fs.readFileSync(preguntasPath, "utf8"))
  console.log("📚 Preguntas cargadas:", preguntasData.preguntas.length)
} catch (error) {
  console.error("❌ Error cargando preguntas:", error)
}

// Estado del juego
let gameState = {
  jugadores: [],
  round: 1,
  jugadorActualID: 0,
  isSecondChance: false,
  topicsEnJuego: [],
  currentTopic: null,
  currentQuestion: null,
  gameStarted: false,
  wheelSpinning: false,
  questionActive: false,
  jugadorOriginalTurno: null, // NUEVO: para recordar quién empezó el turno
}

io.on("connection", (socket) => {
  console.log("🔌 Jugador conectado:", socket.id)

  // Registrar jugador (máximo 2)
  if (gameState.jugadores.length < 2) {
    const playerNumber = gameState.jugadores.length
    const newPlayer = {
      id: socket.id,
      playerNumber: playerNumber,
      nombre: `Jugador ${playerNumber + 1}`,
      avatar: null,
      topics: [],
      vida: 100,
      maxVida: 100,
    }

    gameState.jugadores.push(newPlayer)
    socket.emit("jugador-asignado", playerNumber)
    console.log(`👤 Jugador ${playerNumber + 1} registrado`)
  } else {
    socket.emit("sala-llena")
    return
  }

  // Sincronizar estado
  io.emit("estado-actualizado", {
    jugadores: gameState.jugadores,
    gameStarted: gameState.gameStarted,
    totalPlayers: gameState.jugadores.length,
  })

  // Configurar jugador
  socket.on("configurar-jugador", (data) => {
    const player = gameState.jugadores.find((p) => p.id === socket.id)
    if (player) {
      player.nombre = data.nombre
      player.avatar = data.avatar
      player.topics = data.topics

      console.log(`⚙️ Jugador configurado: ${player.nombre}`)

      // Verificar si ambos están listos
      const allReady =
        gameState.jugadores.length === 2 &&
        gameState.jugadores.every((p) => p.nombre && p.avatar && p.topics.length === 2)

      if (allReady && !gameState.gameStarted) {
        iniciarJuego()
      }

      io.emit("estado-actualizado", {
        jugadores: gameState.jugadores,
        gameStarted: gameState.gameStarted,
        allReady: allReady,
      })
    }
  })

  // Girar ruleta - CORREGIDO para prevenir giro durante pregunta activa
  socket.on("girar-ruleta", () => {
    const player = gameState.jugadores.find((p) => p.id === socket.id)

    // Validaciones mejoradas
    if (!player) {
      console.log("❌ Jugador no encontrado")
      return
    }

    if (player.playerNumber !== gameState.jugadorActualID) {
      console.log(`❌ ${player.nombre} no puede girar - no es su turno (turno actual: ${gameState.jugadorActualID})`)
      socket.emit("error-turno", "No es tu turno para girar la ruleta")
      return
    }

    if (gameState.wheelSpinning) {
      console.log(`❌ ${player.nombre} no puede girar - ruleta ya está girando`)
      socket.emit("error-turno", "La ruleta ya está girando")
      return
    }

    // NUEVA VALIDACIÓN: Verificar si hay una pregunta activa
    if (gameState.questionActive) {
      console.log(`❌ ${player.nombre} no puede girar - hay una pregunta activa que debe responderse`)
      socket.emit("error-turno", "Debes responder la pregunta actual antes de girar nuevamente")
      return
    }

    // NUEVA VALIDACIÓN: Verificar si ya existe una pregunta sin responder
    if (gameState.currentQuestion && !gameState.wheelSpinning) {
      console.log(`❌ ${player.nombre} no puede girar - hay una pregunta pendiente`)
      socket.emit("error-turno", "Hay una pregunta pendiente que debe responderse")
      return
    }

    console.log(`🎲 ${player.nombre} gira la ruleta`)

    // Marcar ruleta como girando y recordar jugador original
    gameState.wheelSpinning = true
    gameState.jugadorOriginalTurno = gameState.jugadorActualID

    // Seleccionar tema aleatorio
    const randomIndex = Math.floor(Math.random() * gameState.topicsEnJuego.length)
    gameState.currentTopic = gameState.topicsEnJuego[randomIndex]

    console.log(`🎯 Tema seleccionado: ${gameState.currentTopic} (índice: ${randomIndex})`)

    // Seleccionar pregunta ANTES de enviar la ruleta
    seleccionarPregunta()

    // Enviar resultado de ruleta a TODOS los jugadores
    io.emit("ruleta-girada", {
      topic: gameState.currentTopic,
      topicIndex: randomIndex,
      topics: gameState.topicsEnJuego,
      jugadorQueGiro: player.playerNumber,
    })

    // Mostrar pregunta después de la animación
    setTimeout(() => {
      gameState.wheelSpinning = false
      gameState.questionActive = true

      if (gameState.currentQuestion) {
        console.log("📤 Enviando pregunta:", gameState.currentQuestion.text)
        console.log("📋 Tema de la pregunta:", gameState.currentQuestion.topic)
        console.log("🎯 Tema seleccionado por ruleta:", gameState.currentTopic)

        // Verificar que coincidan
        if (gameState.currentQuestion.topic !== gameState.currentTopic) {
          console.error("❌ ERROR: El tema de la pregunta no coincide con el tema de la ruleta!")
          console.error(`Ruleta: ${gameState.currentTopic}, Pregunta: ${gameState.currentQuestion.topic}`)
        }

        io.emit("mostrar-pregunta", {
          ...gameState.currentQuestion,
          jugadorActual: gameState.jugadorActualID,
          isSecondChance: gameState.isSecondChance,
        })
      } else {
        console.error("❌ No hay pregunta para mostrar")
        gameState.questionActive = false
      }
    }, 4000)
  })

  // Responder pregunta - CORREGIDO para segunda oportunidad
  socket.on("responder", (data) => {
    const player = gameState.jugadores.find((p) => p.id === socket.id)

    if (!player) {
      console.log("❌ Jugador no encontrado para respuesta")
      return
    }

    if (player.playerNumber !== gameState.jugadorActualID) {
      console.log(`❌ ${player.nombre} no puede responder - no es su turno`)
      socket.emit("error-turno", "No es tu turno para responder")
      return
    }

    if (!gameState.questionActive || !gameState.currentQuestion) {
      console.log(`❌ ${player.nombre} no puede responder - no hay pregunta activa`)
      return
    }

    console.log(`🤔 ${player.nombre} responde: ${data.choiceIdx} (Segunda oportunidad: ${gameState.isSecondChance})`)
    gameState.questionActive = false
    procesarRespuesta(data.choiceIdx, player)
  })

  // Timeout - MEJORADO
  socket.on("timeout", () => {
    const player = gameState.jugadores.find((p) => p.id === socket.id)

    if (!player) {
      console.log("❌ Jugador no encontrado para timeout")
      return
    }

    if (player.playerNumber !== gameState.jugadorActualID) {
      console.log(`❌ Timeout ignorado - no es turno de ${player.nombre}`)
      return
    }

    if (!gameState.questionActive) {
      console.log(`❌ Timeout ignorado - no hay pregunta activa`)
      return
    }

    console.log(`⏰ Timeout para ${player.nombre}`)
    gameState.questionActive = false
    procesarTimeout()
  })

  // Desconexión
  socket.on("disconnect", () => {
    console.log("❌ Jugador desconectado:", socket.id)

    const disconnectedPlayer = gameState.jugadores.find((p) => p.id === socket.id)
    if (disconnectedPlayer) {
      console.log(`👋 ${disconnectedPlayer.nombre} se desconectó`)
    }

    gameState.jugadores = gameState.jugadores.filter((p) => p.id !== socket.id)

    if (gameState.gameStarted && gameState.jugadores.length === 0) {
      // Si no quedan jugadores, reiniciar completamente
      reiniciarJuego()
      console.log("🔄 Juego reiniciado - no quedan jugadores")
    } else if (gameState.gameStarted && gameState.jugadores.length === 1) {
      // Si queda un jugador, notificar y esperar reconexión
      console.log("⏳ Esperando reconexión o nuevo jugador...")
      io.emit("jugador-desconectado", {
        message: "Un jugador se desconectó. Esperando...",
        waitingForReconnection: true,
      })
    } else {
      // Juego no iniciado, solo actualizar estado
      io.emit("estado-actualizado", {
        jugadores: gameState.jugadores,
        gameStarted: gameState.gameStarted,
        totalPlayers: gameState.jugadores.length,
      })
    }
  })
})

function iniciarJuego() {
  console.log("🚀 Iniciando juego...")

  // Combinar temas
  const allTopics = [...gameState.jugadores[0].topics, ...gameState.jugadores[1].topics]
  gameState.topicsEnJuego = [...new Set(allTopics)]

  gameState.gameStarted = true
  gameState.round = 1
  gameState.jugadorActualID = 0
  gameState.wheelSpinning = false
  gameState.questionActive = false
  gameState.jugadorOriginalTurno = null

  console.log("🎯 Temas en juego:", gameState.topicsEnJuego)
  console.log("👤 Jugador inicial:", gameState.jugadores[gameState.jugadorActualID].nombre)

  io.emit("juego-iniciado", {
    jugadores: gameState.jugadores,
    topicsEnJuego: gameState.topicsEnJuego,
    jugadorActual: gameState.jugadorActualID,
    round: gameState.round,
  })

  // Notificar turno después de un pequeño delay
  setTimeout(() => {
    io.emit("turno-actualizado", {
      jugadorActual: gameState.jugadorActualID,
      jugadores: gameState.jugadores,
      round: gameState.round,
      message: `Turno de ${gameState.jugadores[gameState.jugadorActualID].nombre} - ¡Gira la ruleta!`,
      canInteract: true,
    })
  }, 1000)
}

function seleccionarPregunta() {
  if (!preguntasData || !preguntasData.preguntas) {
    console.error("❌ No hay datos de preguntas")
    return
  }

  console.log(`🔍 Buscando preguntas para el tema: ${gameState.currentTopic}`)

  const availableQuestions = preguntasData.preguntas.filter((q) => q.topic === gameState.currentTopic && !q.used)

  console.log(`📊 Preguntas disponibles para ${gameState.currentTopic}: ${availableQuestions.length}`)

  if (availableQuestions.length === 0) {
    // Reiniciar preguntas del tema
    preguntasData.preguntas.forEach((q) => {
      if (q.topic === gameState.currentTopic) {
        q.used = false
      }
    })

    const resetQuestions = preguntasData.preguntas.filter((q) => q.topic === gameState.currentTopic && !q.used)

    if (resetQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * resetQuestions.length)
      gameState.currentQuestion = resetQuestions[randomIndex]
      gameState.currentQuestion.used = true
      console.log("🔄 Preguntas reiniciadas para tema:", gameState.currentTopic)
    } else {
      console.error(`❌ No hay preguntas para el tema: ${gameState.currentTopic}`)
    }
  } else {
    const randomIndex = Math.floor(Math.random() * availableQuestions.length)
    gameState.currentQuestion = availableQuestions[randomIndex]
    gameState.currentQuestion.used = true
  }

  if (gameState.currentQuestion) {
    console.log("❓ Pregunta seleccionada:", gameState.currentQuestion.text)
    console.log("📋 Tema de la pregunta:", gameState.currentQuestion.topic)
  }
}

// FUNCIÓN CORREGIDA: procesarRespuesta
function procesarRespuesta(choiceIdx, player) {
  const correct = choiceIdx === gameState.currentQuestion.respuesta
  let damage = 0

  console.log(`🎯 Procesando respuesta de ${player.nombre}:`)
  console.log(`   - Respuesta elegida: ${choiceIdx}`)
  console.log(`   - Respuesta correcta: ${gameState.currentQuestion.respuesta}`)
  console.log(`   - ¿Es correcta?: ${correct}`)
  console.log(`   - ¿Es segunda oportunidad?: ${gameState.isSecondChance}`)

  if (correct) {
    damage = Math.round(15 * getDamageFactor())
    const rival = gameState.jugadores.find((p) => p.id !== player.id)
    rival.vida = Math.max(0, rival.vida - damage)
    console.log(`✅ ${player.nombre} correcto! ${rival.nombre} pierde ${damage} vida (${rival.vida}/${rival.maxVida})`)
  } else {
    damage = Math.round(8 * getDamageFactor())
    player.vida = Math.max(0, player.vida - damage)
    console.log(`❌ ${player.nombre} incorrecto! Pierde ${damage} vida (${player.vida}/${player.maxVida})`)
  }

  const gameOver = gameState.jugadores.some((p) => p.vida <= 0)
  const winner = gameOver ? gameState.jugadores.find((p) => p.vida > 0) : null

  if (gameOver) {
    console.log(`🏆 Juego terminado! Ganador: ${winner.nombre}`)
  }

  // LIMPIAR ESTADO DE PREGUNTA INMEDIATAMENTE
  gameState.questionActive = false
  gameState.currentQuestion = null

  // Enviar resultado
  io.emit("resultado-ronda", {
    correct: correct,
    damage: damage,
    jugadores: gameState.jugadores,
    gameOver: gameOver,
    winner: winner,
    rounds: gameState.round,
    isSecondChance: gameState.isSecondChance,
  })

  if (!gameOver) {
    setTimeout(() => {
      siguienteTurno()
    }, 3000)
  }
}

function procesarTimeout() {
  const currentPlayer = gameState.jugadores[gameState.jugadorActualID]

  if (!gameState.isSecondChance) {
    // Primera vez - segunda oportunidad para el OTRO jugador
    gameState.isSecondChance = true
    const damage = Math.round(5 * getDamageFactor())
    currentPlayer.vida = Math.max(0, currentPlayer.vida - damage)

    // CAMBIAR AL OTRO JUGADOR para la segunda oportunidad
    gameState.jugadorActualID = 1 - gameState.jugadorActualID

    console.log(
      `⏰ Primera oportunidad perdida. ${currentPlayer.nombre} pierde ${damage} vida. Segunda oportunidad para ${gameState.jugadores[gameState.jugadorActualID].nombre}`,
    )

    // Reactivar la pregunta para el otro jugador
    gameState.questionActive = true

    io.emit("segunda-oportunidad", {
      damage: damage,
      jugadores: gameState.jugadores,
      nuevoJugadorActual: gameState.jugadorActualID,
      jugadorOriginal: gameState.jugadorOriginalTurno,
      pregunta: gameState.currentQuestion,
      message: `Segunda oportunidad para ${gameState.jugadores[gameState.jugadorActualID].nombre}`,
    })
  } else {
    // Segunda vez - ambos fallaron
    gameState.isSecondChance = false
    const damage = Math.round(5 * getDamageFactor())
    currentPlayer.vida = Math.max(0, currentPlayer.vida - damage)

    const gameOver = gameState.jugadores.some((p) => p.vida <= 0)
    const winner = gameOver ? gameState.jugadores.find((p) => p.vida > 0) : null

    console.log(`⏰ Segunda oportunidad perdida. ${currentPlayer.nombre} pierde ${damage} vida`)

    if (gameOver) {
      console.log(`🏆 Juego terminado por timeout! Ganador: ${winner.nombre}`)
    }

    io.emit("timeout-final", {
      damage: damage,
      jugadores: gameState.jugadores,
      gameOver: gameOver,
      winner: winner,
      rounds: gameState.round,
    })

    if (!gameOver) {
      setTimeout(() => {
        siguienteTurno()
      }, 3000)
    }
  }
}

// FUNCIÓN CORREGIDA: siguienteTurno
function siguienteTurno() {
  // Resetear estado de segunda oportunidad
  gameState.isSecondChance = false

  // Cambiar al siguiente jugador y aumentar ronda
  gameState.jugadorActualID = 1 - gameState.jugadorActualID
  gameState.round++

  // LIMPIEZA COMPLETA DEL ESTADO
  gameState.currentQuestion = null
  gameState.currentTopic = null
  gameState.wheelSpinning = false
  gameState.questionActive = false
  gameState.jugadorOriginalTurno = null

  console.log(`➡️ Siguiente turno: ${gameState.jugadores[gameState.jugadorActualID].nombre} (Ronda ${gameState.round})`)

  io.emit("turno-actualizado", {
    jugadorActual: gameState.jugadorActualID,
    jugadores: gameState.jugadores,
    round: gameState.round,
    message: `Ronda ${gameState.round} - Turno de ${gameState.jugadores[gameState.jugadorActualID].nombre}`,
    canInteract: true,
  })
}

function getDamageFactor() {
  return gameState.isSecondChance ? 0.5 : 1
}

function reiniciarJuego() {
  console.log("🔄 Reiniciando juego...")
  gameState = {
    jugadores: [],
    round: 1,
    jugadorActualID: 0,
    isSecondChance: false,
    topicsEnJuego: [],
    currentTopic: null,
    currentQuestion: null,
    gameStarted: false,
    wheelSpinning: false,
    questionActive: false,
    jugadorOriginalTurno: null,
  }

  if (preguntasData && preguntasData.preguntas) {
    preguntasData.preguntas.forEach((q) => (q.used = false))
  }
}

// Servir favicon para evitar errores 404
app.get("/favicon.ico", (req, res) => {
  res.status(204).send()
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
})

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

  // Girar ruleta
  socket.on("girar-ruleta", () => {
    const player = gameState.jugadores.find((p) => p.id === socket.id)
    if (player && player.playerNumber === gameState.jugadorActualID) {
      console.log(`🎲 ${player.nombre} gira la ruleta`)

      // Seleccionar tema aleatorio
      const randomIndex = Math.floor(Math.random() * gameState.topicsEnJuego.length)
      gameState.currentTopic = gameState.topicsEnJuego[randomIndex]

      // Seleccionar pregunta
      seleccionarPregunta()

      // Enviar resultado de ruleta
      io.emit("ruleta-girada", {
        topic: gameState.currentTopic,
        topicIndex: randomIndex,
        topics: gameState.topicsEnJuego,
      })

      // Mostrar pregunta después de la animación
      setTimeout(() => {
        if (gameState.currentQuestion) {
          console.log("📤 Enviando pregunta:", gameState.currentQuestion.text)
          io.emit("mostrar-pregunta", gameState.currentQuestion)
        } else {
          console.error("❌ No hay pregunta para mostrar")
        }
      }, 4000)
    } else {
      console.log(
        `❌ Jugador ${player?.nombre || "desconocido"} no puede girar (turno actual: ${gameState.jugadorActualID})`,
      )
    }
  })

  // Responder pregunta
  socket.on("responder", (data) => {
    const player = gameState.jugadores.find((p) => p.id === socket.id)
    if (player && player.playerNumber === gameState.jugadorActualID && gameState.currentQuestion) {
      console.log(`🤔 ${player.nombre} responde: ${data.choiceIdx}`)
      procesarRespuesta(data.choiceIdx, player)
    }
  })

  // Timeout
  socket.on("timeout", () => {
    const player = gameState.jugadores.find((p) => p.id === socket.id)
    if (player && player.playerNumber === gameState.jugadorActualID) {
      console.log(`⏰ Timeout para ${player.nombre}`)
      procesarTimeout()
    }
  })

  // Desconexión
  socket.on("disconnect", () => {
    console.log("❌ Jugador desconectado:", socket.id)
    gameState.jugadores = gameState.jugadores.filter((p) => p.id !== socket.id)

    if (gameState.gameStarted) {
      reiniciarJuego()
    }

    io.emit("jugador-desconectado")
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
    })
  }, 1000)
}

function seleccionarPregunta() {
  if (!preguntasData || !preguntasData.preguntas) {
    console.error("❌ No hay datos de preguntas")
    return
  }

  const availableQuestions = preguntasData.preguntas.filter((q) => q.topic === gameState.currentTopic && !q.used)

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
    }
  } else {
    const randomIndex = Math.floor(Math.random() * availableQuestions.length)
    gameState.currentQuestion = availableQuestions[randomIndex]
    gameState.currentQuestion.used = true
  }

  console.log("❓ Pregunta seleccionada:", gameState.currentQuestion?.text)
}

function procesarRespuesta(choiceIdx, player) {
  const correct = choiceIdx === gameState.currentQuestion.respuesta
  let damage = 0

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

  io.emit("resultado-ronda", {
    correct: correct,
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

function procesarTimeout() {
  const currentPlayer = gameState.jugadores[gameState.jugadorActualID]

  if (!gameState.isSecondChance) {
    // Primera vez - segunda oportunidad
    gameState.isSecondChance = true
    const damage = Math.round(5 * getDamageFactor())
    currentPlayer.vida = Math.max(0, currentPlayer.vida - damage)
    gameState.jugadorActualID = 1 - gameState.jugadorActualID

    console.log(
      `⏰ Primera oportunidad perdida. ${currentPlayer.nombre} pierde ${damage} vida. Turno para ${gameState.jugadores[gameState.jugadorActualID].nombre}`,
    )

    io.emit("segunda-oportunidad", {
      damage: damage,
      jugadores: gameState.jugadores,
      nuevoJugadorActual: gameState.jugadorActualID,
      pregunta: gameState.currentQuestion,
    })
  } else {
    // Segunda vez
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

function siguienteTurno() {
  if (!gameState.isSecondChance) {
    gameState.jugadorActualID = 1 - gameState.jugadorActualID
    gameState.round++
  }

  gameState.currentQuestion = null
  gameState.currentTopic = null

  console.log(`➡️ Siguiente turno: ${gameState.jugadores[gameState.jugadorActualID].nombre} (Ronda ${gameState.round})`)

  io.emit("turno-actualizado", {
    jugadorActual: gameState.jugadorActualID,
    jugadores: gameState.jugadores,
    round: gameState.round,
    message: `Ronda ${gameState.round} - Turno de ${gameState.jugadores[gameState.jugadorActualID].nombre}`,
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

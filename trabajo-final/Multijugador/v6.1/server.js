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

// Sistema de gestión de salas mejorado
class GameManager {
  constructor() {
    this.rooms = new Map() // roomCode -> GameRoom
    this.playerRooms = new Map() // socketId -> roomCode
    this.roomCounter = 0
  }

  // Generar código único para sala
  generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code = ""
    do {
      code = ""
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
    } while (this.rooms.has(code))
    return code
  }

  // Crear nueva sala
  createRoom(creatorSocket, roomName = null) {
    const roomCode = roomName || this.generateRoomCode()

    // Verificar que el código no exista
    if (this.rooms.has(roomCode)) {
      return { success: false, error: "El código de sala ya existe" }
    }

    const gameRoom = new GameRoom(roomCode, preguntasData)
    this.rooms.set(roomCode, gameRoom)

    // Agregar creador como jugador 1
    const result = gameRoom.addPlayer(creatorSocket, 0)
    if (result.success) {
      this.playerRooms.set(creatorSocket.id, roomCode)
      creatorSocket.join(roomCode)

      console.log(`🏠 Sala ${roomCode} creada por ${creatorSocket.id}`)
      this.broadcastRoomList()

      return {
        success: true,
        roomCode: roomCode,
        playerNumber: 0,
        room: gameRoom.getPublicInfo(),
      }
    } else {
      this.rooms.delete(roomCode)
      return result
    }
  }

  // Unirse a sala existente
  joinRoom(playerSocket, roomCode) {
    const room = this.rooms.get(roomCode)

    if (!room) {
      return { success: false, error: "La sala no existe" }
    }

    if (room.isFull()) {
      return { success: false, error: "La sala está llena" }
    }

    if (room.gameStarted) {
      return { success: false, error: "La partida ya comenzó" }
    }

    // Agregar como jugador 2
    const result = room.addPlayer(playerSocket, 1)
    if (result.success) {
      this.playerRooms.set(playerSocket.id, roomCode)
      playerSocket.join(roomCode)

      console.log(`👥 ${playerSocket.id} se unió a sala ${roomCode}`)
      this.broadcastRoomList()

      // Si la sala está llena, iniciar juego
      if (room.isFull()) {
        setTimeout(() => {
          room.startGame()
        }, 1000)
      }

      return {
        success: true,
        roomCode: roomCode,
        playerNumber: 1,
        room: room.getPublicInfo(),
      }
    }

    return result
  }

  // Obtener lista de salas públicas
  getPublicRooms() {
    const publicRooms = []

    for (const [code, room] of this.rooms) {
      if (!room.gameStarted) {
        publicRooms.push({
          code: code,
          name: room.roomName || code,
          players: room.getPlayerCount(),
          maxPlayers: 2,
          status: room.getPlayerCount() === 1 ? "Esperando jugador" : "Llena",
          canJoin: room.getPlayerCount() < 2,
          createdAt: room.createdAt,
        })
      }
    }

    // Ordenar por fecha de creación (más recientes primero)
    return publicRooms.sort((a, b) => b.createdAt - a.createdAt)
  }

  // Broadcast de lista de salas a todos los jugadores en lobby
  broadcastRoomList() {
    const roomList = this.getPublicRooms()
    io.emit("room-list-updated", roomList)
  }

  // Obtener sala de un jugador
  getPlayerRoom(socketId) {
    const roomCode = this.playerRooms.get(socketId)
    return roomCode ? this.rooms.get(roomCode) : null
  }

  // Manejar desconexión
  handleDisconnection(socketId) {
    const roomCode = this.playerRooms.get(socketId)
    if (roomCode) {
      const room = this.rooms.get(roomCode)
      if (room) {
        room.handlePlayerDisconnection(socketId)

        // Si la sala queda vacía o el juego no ha comenzado, eliminarla
        if (room.getPlayerCount() === 0 || (!room.gameStarted && room.getPlayerCount() === 1)) {
          this.rooms.delete(roomCode)
          console.log(`🗑️ Sala ${roomCode} eliminada`)
          this.broadcastRoomList()
        }
      }
      this.playerRooms.delete(socketId)
    }
  }

  // Obtener estadísticas
  getStats() {
    const activeGames = Array.from(this.rooms.values()).filter((room) => room.gameStarted).length
    const waitingRooms = Array.from(this.rooms.values()).filter((room) => !room.gameStarted).length
    const totalPlayers = Array.from(this.rooms.values()).reduce((sum, room) => sum + room.getPlayerCount(), 0)

    return {
      totalRooms: this.rooms.size,
      activeGames: activeGames,
      waitingRooms: waitingRooms,
      totalPlayers: totalPlayers,
    }
  }
}

// Clase para manejar una sala de juego individual (actualizada)
class GameRoom {
  constructor(roomCode, preguntasData) {
    this.roomCode = roomCode
    this.roomName = roomCode
    this.preguntasData = preguntasData
    this.createdAt = Date.now()
    this.gameStarted = false

    this.players = new Map() // socketId -> playerData
    this.gameState = {
      round: 1,
      jugadorActualID: 0,
      isSecondChance: false,
      topicsEnJuego: [],
      currentTopic: null,
      currentQuestion: null,
      wheelSpinning: false,
      questionActive: false,
      jugadorOriginalTurno: null,
    }
  }

  // Agregar jugador a la sala
  addPlayer(socket, playerNumber) {
    if (this.players.size >= 2) {
      return { success: false, error: "La sala está llena" }
    }

    if (this.gameStarted) {
      return { success: false, error: "La partida ya comenzó" }
    }

    const playerData = {
      id: socket.id,
      socket: socket,
      playerNumber: playerNumber,
      nombre: null,
      avatar: null,
      topics: [],
      vida: 100,
      maxVida: 100,
      ready: false,
      joinedAt: Date.now(),
    }

    this.players.set(socket.id, playerData)

    // Notificar al jugador su asignación
    socket.emit("room-joined", {
      roomCode: this.roomCode,
      playerNumber: playerNumber,
      players: this.getPublicPlayers(),
    })

    // Notificar a todos en la sala sobre el nuevo jugador
    this.broadcastToRoom("room-updated", {
      roomCode: this.roomCode,
      players: this.getPublicPlayers(),
      gameStarted: this.gameStarted,
    })

    console.log(`👤 Jugador ${socket.id} agregado a sala ${this.roomCode} como jugador ${playerNumber + 1}`)

    return { success: true }
  }

  // Verificar si la sala está llena
  isFull() {
    return this.players.size >= 2
  }

  // Obtener cantidad de jugadores
  getPlayerCount() {
    return this.players.size
  }

  // Obtener información pública de la sala
  getPublicInfo() {
    return {
      code: this.roomCode,
      name: this.roomName,
      players: this.getPlayerCount(),
      maxPlayers: 2,
      gameStarted: this.gameStarted,
      canJoin: !this.isFull() && !this.gameStarted,
      createdAt: this.createdAt,
    }
  }

  // Obtener jugadores sin información sensible
  getPublicPlayers() {
    return Array.from(this.players.values()).map((p) => ({
      playerNumber: p.playerNumber,
      nombre: p.nombre,
      avatar: p.avatar,
      topics: p.topics,
      vida: p.vida,
      maxVida: p.maxVida,
      ready: p.ready,
      joinedAt: p.joinedAt,
    }))
  }

  // Obtener jugadores activos (conectados)
  getActivePlayers() {
    return Array.from(this.players.values()).filter((p) => p.socket && p.socket.connected)
  }

  // Enviar mensaje a toda la sala
  broadcastToRoom(event, data) {
    for (const player of this.players.values()) {
      if (player.socket && player.socket.connected) {
        player.socket.emit(event, data)
      }
    }
  }

  // Encontrar jugador por socket ID
  findPlayer(socketId) {
    return this.players.get(socketId)
  }

  // Configurar jugador
  configurePlayer(socketId, data) {
    const player = this.findPlayer(socketId)
    if (!player) return

    player.nombre = data.nombre
    player.avatar = data.avatar
    player.topics = data.topics
    player.ready = true

    console.log(`⚙️ Jugador ${player.nombre} configurado en sala ${this.roomCode}`)

    // Verificar si ambos están listos
    const allReady = Array.from(this.players.values()).every((p) => p.ready) && this.players.size === 2

    this.broadcastToRoom("room-updated", {
      roomCode: this.roomCode,
      players: this.getPublicPlayers(),
      gameStarted: this.gameStarted,
      allReady: allReady,
    })

    if (allReady && !this.gameStarted) {
      setTimeout(() => {
        this.startGame()
      }, 1000)
    }
  }

  // Iniciar juego
  startGame() {
    if (this.gameStarted || this.players.size !== 2) return

    console.log(`🚀 Iniciando juego en sala ${this.roomCode}`)

    this.gameStarted = true

    // Combinar temas de ambos jugadores
    const playersArray = Array.from(this.players.values())
    const allTopics = [...playersArray[0].topics, ...playersArray[1].topics]
    this.gameState.topicsEnJuego = [...new Set(allTopics)]

    this.gameState.round = 1
    this.gameState.jugadorActualID = 0
    this.gameState.wheelSpinning = false
    this.gameState.questionActive = false
    this.gameState.jugadorOriginalTurno = null

    console.log(`🎯 Temas en juego (${this.roomCode}):`, this.gameState.topicsEnJuego)

    this.broadcastToRoom("game-started", {
      roomCode: this.roomCode,
      players: this.getPublicPlayers(),
      topicsEnJuego: this.gameState.topicsEnJuego,
      jugadorActual: this.gameState.jugadorActualID,
      round: this.gameState.round,
    })

    // Notificar turno después de un pequeño delay
    setTimeout(() => {
      const currentPlayer = Array.from(this.players.values())[this.gameState.jugadorActualID]
      this.broadcastToRoom("turn-updated", {
        jugadorActual: this.gameState.jugadorActualID,
        players: this.getPublicPlayers(),
        round: this.gameState.round,
        message: `Turno de ${currentPlayer.nombre} - ¡Gira la ruleta!`,
        canInteract: true,
        roomCode: this.roomCode,
      })
    }, 1000)
  }

  // Girar ruleta
  spinWheel(socketId) {
    const player = this.findPlayer(socketId)
    if (!player) return

    // Validaciones
    if (player.playerNumber !== this.gameState.jugadorActualID) {
      player.socket.emit("error-message", "No es tu turno para girar la ruleta")
      return
    }

    if (this.gameState.wheelSpinning) {
      player.socket.emit("error-message", "La ruleta ya está girando")
      return
    }

    if (this.gameState.questionActive) {
      player.socket.emit("error-message", "Debes responder la pregunta actual antes de girar nuevamente")
      return
    }

    console.log(`🎲 ${player.nombre} gira la ruleta en sala ${this.roomCode}`)

    // Marcar ruleta como girando
    this.gameState.wheelSpinning = true
    this.gameState.jugadorOriginalTurno = this.gameState.jugadorActualID

    // Seleccionar tema aleatorio
    const randomIndex = Math.floor(Math.random() * this.gameState.topicsEnJuego.length)
    this.gameState.currentTopic = this.gameState.topicsEnJuego[randomIndex]

    // Seleccionar pregunta
    this.selectQuestion()

    // Enviar resultado de ruleta
    this.broadcastToRoom("wheel-spun", {
      topic: this.gameState.currentTopic,
      topicIndex: randomIndex,
      topics: this.gameState.topicsEnJuego,
      jugadorQueGiro: player.playerNumber,
      roomCode: this.roomCode,
    })

    // Mostrar pregunta después de la animación
    setTimeout(() => {
      this.gameState.wheelSpinning = false
      this.gameState.questionActive = true

      if (this.gameState.currentQuestion) {
        this.broadcastToRoom("question-shown", {
          ...this.gameState.currentQuestion,
          jugadorActual: this.gameState.jugadorActualID,
          isSecondChance: this.gameState.isSecondChance,
          roomCode: this.roomCode,
        })
      } else {
        console.error(`❌ No hay pregunta para mostrar en sala ${this.roomCode}`)
        this.gameState.questionActive = false
      }
    }, 4000)
  }

  // Seleccionar pregunta
  selectQuestion() {
    if (!this.preguntasData || !this.preguntasData.preguntas) {
      console.error(`❌ No hay datos de preguntas en sala ${this.roomCode}`)
      return
    }

    const availableQuestions = this.preguntasData.preguntas.filter(
      (q) => q.topic === this.gameState.currentTopic && !q.used,
    )

    if (availableQuestions.length === 0) {
      // Reiniciar preguntas del tema
      this.preguntasData.preguntas.forEach((q) => {
        if (q.topic === this.gameState.currentTopic) {
          q.used = false
        }
      })

      const resetQuestions = this.preguntasData.preguntas.filter(
        (q) => q.topic === this.gameState.currentTopic && !q.used,
      )

      if (resetQuestions.length > 0) {
        const randomIndex = Math.floor(Math.random() * resetQuestions.length)
        this.gameState.currentQuestion = resetQuestions[randomIndex]
        this.gameState.currentQuestion.used = true
      }
    } else {
      const randomIndex = Math.floor(Math.random() * availableQuestions.length)
      this.gameState.currentQuestion = availableQuestions[randomIndex]
      this.gameState.currentQuestion.used = true
    }
  }

  // Responder pregunta
  answerQuestion(socketId, choiceIdx) {
    const player = this.findPlayer(socketId)
    if (!player) return

    if (player.playerNumber !== this.gameState.jugadorActualID) {
      player.socket.emit("error-message", "No es tu turno para responder")
      return
    }

    if (!this.gameState.questionActive || !this.gameState.currentQuestion) {
      return
    }

    console.log(`🤔 ${player.nombre} responde: ${choiceIdx} en sala ${this.roomCode}`)
    this.gameState.questionActive = false
    this.processAnswer(choiceIdx, player)
  }

  // Procesar respuesta
  processAnswer(choiceIdx, player) {
    const correct = choiceIdx === this.gameState.currentQuestion.respuesta
    let damage = 0

    if (correct) {
      damage = Math.round(15 * this.getDamageFactor())
      const rival = Array.from(this.players.values()).find((p) => p.id !== player.id)
      rival.vida = Math.max(0, rival.vida - damage)
    } else {
      damage = Math.round(8 * this.getDamageFactor())
      player.vida = Math.max(0, player.vida - damage)
    }

    const gameOver = Array.from(this.players.values()).some((p) => p.vida <= 0)
    const winner = gameOver ? Array.from(this.players.values()).find((p) => p.vida > 0) : null

    // Limpiar estado de pregunta
    this.gameState.questionActive = false
    this.gameState.currentQuestion = null

    this.broadcastToRoom("round-result", {
      correct: correct,
      damage: damage,
      players: this.getPublicPlayers(),
      gameOver: gameOver,
      winner: winner ? { nombre: winner.nombre, avatar: winner.avatar } : null,
      rounds: this.gameState.round,
      isSecondChance: this.gameState.isSecondChance,
      roomCode: this.roomCode,
    })

    if (!gameOver) {
      setTimeout(() => {
        this.nextTurn()
      }, 3000)
    }
  }

  // Manejar timeout
  handleTimeout(socketId) {
    const player = this.findPlayer(socketId)
    if (!player) return

    if (player.playerNumber !== this.gameState.jugadorActualID) {
      return
    }

    if (!this.gameState.questionActive) {
      return
    }

    console.log(`⏰ Timeout para ${player.nombre} en sala ${this.roomCode}`)
    this.gameState.questionActive = false
    this.processTimeout()
  }

  // Procesar timeout
  processTimeout() {
    const playersArray = Array.from(this.players.values())
    const currentPlayer = playersArray[this.gameState.jugadorActualID]

    if (!this.gameState.isSecondChance) {
      // Primera vez - segunda oportunidad
      this.gameState.isSecondChance = true
      const damage = Math.round(5 * this.getDamageFactor())
      currentPlayer.vida = Math.max(0, currentPlayer.vida - damage)

      // Cambiar al otro jugador
      this.gameState.jugadorActualID = 1 - this.gameState.jugadorActualID

      // Reactivar la pregunta
      this.gameState.questionActive = true

      this.broadcastToRoom("second-chance", {
        damage: damage,
        players: this.getPublicPlayers(),
        nuevoJugadorActual: this.gameState.jugadorActualID,
        jugadorOriginal: this.gameState.jugadorOriginalTurno,
        pregunta: this.gameState.currentQuestion,
        message: `Segunda oportunidad para ${playersArray[this.gameState.jugadorActualID].nombre}`,
        roomCode: this.roomCode,
      })
    } else {
      // Segunda vez - ambos fallaron
      this.gameState.isSecondChance = false
      const damage = Math.round(5 * this.getDamageFactor())
      currentPlayer.vida = Math.max(0, currentPlayer.vida - damage)

      const gameOver = Array.from(this.players.values()).some((p) => p.vida <= 0)
      const winner = gameOver ? Array.from(this.players.values()).find((p) => p.vida > 0) : null

      this.broadcastToRoom("timeout-final", {
        damage: damage,
        players: this.getPublicPlayers(),
        gameOver: gameOver,
        winner: winner ? { nombre: winner.nombre, avatar: winner.avatar } : null,
        rounds: this.gameState.round,
        roomCode: this.roomCode,
      })

      if (!gameOver) {
        setTimeout(() => {
          this.nextTurn()
        }, 3000)
      }
    }
  }

  // Siguiente turno
  nextTurn() {
    this.gameState.isSecondChance = false
    this.gameState.jugadorActualID = 1 - this.gameState.jugadorActualID
    this.gameState.round++

    // Limpiar estado
    this.gameState.currentQuestion = null
    this.gameState.currentTopic = null
    this.gameState.wheelSpinning = false
    this.gameState.questionActive = false
    this.gameState.jugadorOriginalTurno = null

    const playersArray = Array.from(this.players.values())
    const currentPlayer = playersArray[this.gameState.jugadorActualID]

    this.broadcastToRoom("turn-updated", {
      jugadorActual: this.gameState.jugadorActualID,
      players: this.getPublicPlayers(),
      round: this.gameState.round,
      message: `Ronda ${this.gameState.round} - Turno de ${currentPlayer.nombre}`,
      canInteract: true,
      roomCode: this.roomCode,
    })
  }

  // Factor de daño
  getDamageFactor() {
    return this.gameState.isSecondChance ? 0.5 : 1
  }

  // Manejar desconexión de jugador
  handlePlayerDisconnection(socketId) {
    const player = this.findPlayer(socketId)
    if (!player) return

    console.log(`👋 ${player.nombre || socketId} se desconectó de sala ${this.roomCode}`)

    this.players.delete(socketId)

    // Notificar a los jugadores restantes
    this.broadcastToRoom("player-disconnected", {
      message: "Un jugador se desconectó",
      roomCode: this.roomCode,
      players: this.getPublicPlayers(),
    })
  }
}

// Instancia global del gestor de juegos
const gameManager = new GameManager()

// Manejar conexiones
io.on("connection", (socket) => {
  console.log("🔌 Jugador conectado:", socket.id)

  // Enviar lista de salas al conectarse
  socket.emit("room-list-updated", gameManager.getPublicRooms())

  // Crear sala
  socket.on("create-room", (data) => {
    const result = gameManager.createRoom(socket, data.roomName)
    socket.emit("room-creation-result", result)
  })

  // Unirse a sala
  socket.on("join-room", (data) => {
    const result = gameManager.joinRoom(socket, data.roomCode)
    socket.emit("room-join-result", result)
  })

  // Solicitar lista de salas
  socket.on("request-room-list", () => {
    socket.emit("room-list-updated", gameManager.getPublicRooms())
  })

  // Configurar jugador
  socket.on("configure-player", (data) => {
    const room = gameManager.getPlayerRoom(socket.id)
    if (room) {
      room.configurePlayer(socket.id, data)
    }
  })

  // Girar ruleta
  socket.on("spin-wheel", () => {
    const room = gameManager.getPlayerRoom(socket.id)
    if (room) {
      room.spinWheel(socket.id)
    }
  })

  // Responder pregunta
  socket.on("answer-question", (data) => {
    const room = gameManager.getPlayerRoom(socket.id)
    if (room) {
      room.answerQuestion(socket.id, data.choiceIdx)
    }
  })

  // Timeout
  socket.on("question-timeout", () => {
    const room = gameManager.getPlayerRoom(socket.id)
    if (room) {
      room.handleTimeout(socket.id)
    }
  })

  // Obtener estadísticas del servidor
  socket.on("get-server-stats", () => {
    socket.emit("server-stats", gameManager.getStats())
  })

  // Desconexión
  socket.on("disconnect", () => {
    console.log("❌ Jugador desconectado:", socket.id)
    gameManager.handleDisconnection(socket.id)
  })
})

// Servir favicon
app.get("/favicon.ico", (req, res) => {
  res.status(204).send()
})

// Endpoint para estadísticas del servidor
app.get("/stats", (req, res) => {
  res.json(gameManager.getStats())
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`🚀 Servidor multijugador con gestión de salas corriendo en http://localhost:${PORT}`)
  console.log(`🏠 Sistema de salas con códigos únicos activado`)
})

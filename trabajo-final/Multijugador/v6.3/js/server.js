app.use(express.static(__dirname)) // Sirve archivos estáticos
const express = require('express')
const http = require('http')
const socketIo = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = socketIo(server)



let partida = {
  jugadores: [],
  round: 1,
  turno: 0, // 0: jugador 1, 1: jugador 2
  preguntas: [],
  preguntaActual: null
}

// Cuando un cliente se conecta
io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id)

  // Registrar jugador (máximo 2)
  if (partida.jugadores.length < 2) {
    partida.jugadores.push({ id: socket.id, vida: 100, nombre: `Jugador ${partida.jugadores.length + 1}` })
    socket.emit('jugador', partida.jugadores.length - 1)
  }

  // Sincronizar estado inicial
  io.emit('estado', partida)

  // Recibir acción de turno (ejemplo: respuesta)
  socket.on('accion', (data) => {
    // Aquí puedes procesar la respuesta y actualizar vidas, ronda, etc.
    partida.round++
    partida.turno = (partida.turno + 1) % 2
    io.emit('estado', partida)
  })

  socket.on('disconnect', () => {
    partida.jugadores = partida.jugadores.filter(j => j.id !== socket.id)
    io.emit('estado', partida)
  })
})

server.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000')
})
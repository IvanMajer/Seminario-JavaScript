import { jugador as Jugador, pregunta as Pregunta, juego as JuegoModel } from "./models.js"
import * as ui from "./ui.js"

let partida
let timerInterval

export function init() {
  ui.renderSetup(startGame)
}

async function startGame(rawPlayers) {
  console.log("startGame arranca con rawPlayers:", rawPlayers)

  // 1) Creamos los Jugador
  const players = rawPlayers.map((p) => new Jugador(p.nombre, p.avatar, p.topics))

  // 2) Cargamos el JSON de preguntas
  const data = await fetch("data/preguntas.json").then((r) => r.json())
  const questions = data.map((q) => new Pregunta(q))

  // 3) Creamos la partida
  partida = new JuegoModel(players, questions)

  // 4) Inicializamos topicsEnJuego (método extra)
  partida.topicsEnJuego = [...partida.jugadores[0].topics, ...partida.jugadores[1].topics]

  // 5) Renderizamos la pantalla de juego
  ui.renderGame(partida)

  // 6) Arrancamos el primer turno
  nextTurn()
}

export function nextTurn() {
  // Elegimos topic al azar
  const topics = partida.topicsEnJuego
  const idx = Math.floor(Math.random() * topics.length)
  const topic = topics[idx]
  partida.currentTopic = topic

  // Buscamos una pregunta no usada
  const qIdx = partida.preguntas.findIndex((q) => q.topic === topic && !q.used)

  if (qIdx === -1) {
    // Si no hay más preguntas, reiniciamos las usadas
    partida.preguntas.forEach((q) => (q.used = false))
    const newQIdx = partida.preguntas.findIndex((q) => q.topic === topic)
    partida.currentQuestion = partida.preguntas[newQIdx]
    partida.preguntas[newQIdx].used = true
  } else {
    partida.currentQuestion = partida.preguntas[qIdx]
    partida.preguntas[qIdx].used = true
  }

  // Disparamos la animación
  ui.renderSpinner(topic, idx, partida.topicsEnJuego)
}

export function handleSpinEnd() {
  console.log("🔔 handleSpinEnd se ha disparado")
  ui.renderQuestion(partida.currentQuestion)
  startTimer()
}

function startTimer() {
  clearInterval(timerInterval)
  const maxTime = partida.getMaxTime()
  partida.timer = maxTime
  ui.updateTimer(maxTime)

  timerInterval = setInterval(() => {
    partida.timer--
    ui.updateTimer(partida.timer)
    if (partida.timer <= 0) {
      clearInterval(timerInterval)
      handleTimeout()
    }
  }, 1000)
}

export function handleAnswer(choiceIdx) {
  clearInterval(timerInterval)

  const q = partida.currentQuestion
  const correct = choiceIdx === q.respuesta
  let damage = 0
  const maxTime = partida.getMaxTime()

  if (correct) {
    const base = 10
    const bonus = Math.round((partida.timer / maxTime) * 10)
    damage = Math.round((base + bonus) * partida.getDamageFactor())
    partida.rival.vida = Math.max(0, partida.rival.vida - damage)
  } else {
    damage = Math.round(5 * partida.getDamageFactor())
    partida.jugadorActual.vida = Math.max(0, partida.jugadorActual.vida - damage)
  }

  // Verificar si el juego terminó
  const gameOver = partida.jugadores.some((p) => p.vida <= 0)

  ui.showRoundResult(correct, damage, false, () => {
    ui.updateLifeBars(partida.jugadores)

    if (gameOver) {
      const winner = partida.jugadores.find((p) => p.vida > 0)
      ui.renderEnd({ winner, rounds: partida.round })
    } else {
      setTimeout(() => {
        partida.siguienteJugador()
        partida.round++
        nextTurn()
      }, 500)
    }
  })
}

function handleTimeout() {
  clearInterval(timerInterval)
  const dmg = Math.round(5 * partida.getDamageFactor())
  partida.jugadorActual.vida = Math.max(0, partida.jugadorActual.vida - dmg)

  if (!partida.isSecondChance) {
    partida.isSecondChance = true
    partida.siguienteJugador()
    ui.showRoundResult(false, dmg, true, () => {
      ui.updateLifeBars(partida.jugadores)
      ui.renderQuestion(partida.currentQuestion)
      startTimer()
    })
  } else {
    partida.isSecondChance = false
    const gameOver = partida.jugadores.some((p) => p.vida <= 0)

    ui.showRoundResult(false, dmg, true, () => {
      ui.updateLifeBars(partida.jugadores)

      if (gameOver) {
        const winner = partida.jugadores.find((p) => p.vida > 0)
        ui.renderEnd({ winner, rounds: partida.round })
      } else {
        partida.round++
        nextTurn()
      }
    })
  }
}

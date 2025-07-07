// js/control.js - Este archivo controla toda la lógica del juego

// Importamos las clases de models.js y las funciones de ui.js
import { jugador as Jugador, pregunta as Pregunta, juego as JuegoModel } from "./models.js"
import * as ui from "./ui.js"

// Variables globales del juego
let partida // Aquí guardamos la instancia del juego actual
let timerInterval // Controla el temporizador de las preguntas
let gameData // Datos del juego cargados desde JSON

// Función que se ejecuta cuando carga la página
export function init() {
  console.log("🎮 Iniciando el juego...")
  // Cargamos los datos del juego y luego renderizamos la pantalla inicial
  loadGameData().then(() => {
    ui.renderSetup(startGame, gameData.metadata.temas)
  })
}

// Función que carga los datos del juego desde el JSON
async function loadGameData() {
  try {
    console.log("📚 Cargando datos del juego...")
    const response = await fetch("data/preguntas.json")
    gameData = await response.json()

    console.log("✅ Datos cargados:", {
      temas: gameData.metadata.temas.length,
      preguntas: gameData.preguntas.length,
    })

    // Validamos que tengamos al menos 2 temas
    if (gameData.metadata.temas.length < 2) {
      throw new Error("Se necesitan al menos 2 temas para jugar")
    }

    // Validamos que cada tema tenga al menos una pregunta
    gameData.metadata.temas.forEach((tema) => {
      const preguntasDelTema = gameData.preguntas.filter((p) => p.topic === tema.nombre)
      if (preguntasDelTema.length === 0) {
        console.warn(`⚠️ El tema "${tema.nombre}" no tiene preguntas`)
      }
    })
  } catch (error) {
    console.error("❌ Error cargando datos del juego:", error)
    throw error
  }
}

// Función que inicia una nueva partida
async function startGame(rawPlayers) {
  console.log("🚀 Iniciando partida con jugadores:", rawPlayers)

  try {
    // 1) Convertimos los datos de los jugadores en objetos de la clase Jugador
    const players = rawPlayers.map((p) => new Jugador(p.nombre, p.avatar, p.topics))

    // 2) Convertimos las preguntas del JSON en objetos de la clase Pregunta
    const questions = gameData.preguntas.map((q) => new Pregunta(q))
    console.log("📚 Preguntas cargadas:", questions.length)

    // 3) Creamos la instancia del juego
    partida = new JuegoModel(players, questions)

    // 4) Combinamos todos los temas elegidos por ambos jugadores (sin repetir)
    const allTopics = [...partida.jugadores[0].topics, ...partida.jugadores[1].topics]
    partida.topicsEnJuego = [...new Set(allTopics)] // Set elimina duplicados
    console.log("🎯 Temas en juego:", partida.topicsEnJuego)

    // 5) Validamos que todos los temas seleccionados existan en el JSON
    const temasDisponibles = gameData.metadata.temas.map((t) => t.nombre)
    const temasInvalidos = partida.topicsEnJuego.filter((tema) => !temasDisponibles.includes(tema))

    if (temasInvalidos.length > 0) {
      throw new Error(`Temas no encontrados en el JSON: ${temasInvalidos.join(", ")}`)
    }

    // 6) Mostramos la pantalla de juego
    ui.renderGame(partida, gameData.metadata.temas)

    // 7) Iniciamos el primer turno
    nextTurn()
  } catch (error) {
    console.error("❌ Error iniciando partida:", error)
  }
}

// Función que inicia un nuevo turno
export function nextTurn() {
  console.log(`🎲 Turno ${partida.round} - Jugador: ${partida.jugadorActual.nombre}`)

  // Elegimos un tema al azar de los disponibles
  const topics = partida.topicsEnJuego
  const randomIndex = Math.floor(Math.random() * topics.length)
  const selectedTopic = topics[randomIndex]

  // Guardamos el tema seleccionado
  partida.currentTopic = selectedTopic
  console.log("📖 Tema seleccionado:", selectedTopic)

  // Buscamos una pregunta de ese tema que NO haya sido usada
  const availableQuestions = partida.preguntas.filter((q) => q.topic === selectedTopic && !q.used)

  // Si no hay preguntas disponibles de ese tema, reiniciamos todas las preguntas de ese tema
  if (availableQuestions.length === 0) {
    console.log("🔄 Reiniciando preguntas del tema:", selectedTopic)
    partida.preguntas.forEach((q) => {
      if (q.topic === selectedTopic) {
        q.used = false // Marcamos como no usadas
      }
    })
    // Volvemos a buscar preguntas disponibles
    const resetQuestions = partida.preguntas.filter((q) => q.topic === selectedTopic && !q.used)
    partida.currentQuestion = resetQuestions[0]
  } else {
    // Elegimos una pregunta al azar de las disponibles
    const randomQuestionIndex = Math.floor(Math.random() * availableQuestions.length)
    partida.currentQuestion = availableQuestions[randomQuestionIndex]
  }

  // Marcamos la pregunta como usada
  partida.currentQuestion.used = true
  console.log("❓ Pregunta seleccionada:", partida.currentQuestion.text)

  // Iniciamos la animación de la ruleta
  ui.renderSpinner(selectedTopic, randomIndex, partida.topicsEnJuego, gameData.metadata.temas)
}

// Función que se ejecuta cuando la ruleta termina de girar
export function handleSpinEnd() {
  console.log("🎯 La ruleta ha terminado de girar")

  // Mostramos la pregunta seleccionada
  ui.renderQuestion(partida.currentQuestion)

  // Iniciamos el temporizador
  startTimer()
}

// Función que inicia el temporizador de la pregunta
function startTimer() {
  // Limpiamos cualquier temporizador anterior
  clearInterval(timerInterval)

  // Calculamos el tiempo máximo basado en la dificultad
  const maxTime = partida.getMaxTime()
  partida.timer = maxTime

  console.log(`⏰ Iniciando temporizador: ${maxTime} segundos`)

  // Actualizamos la pantalla con el tiempo inicial
  ui.updateTimer(maxTime)

  // Creamos un intervalo que se ejecuta cada segundo
  timerInterval = setInterval(() => {
    partida.timer-- // Reducimos el tiempo en 1
    ui.updateTimer(partida.timer) // Actualizamos la pantalla

    // Si el tiempo llegó a 0, se acabó el tiempo
    if (partida.timer <= 0) {
      clearInterval(timerInterval) // Detenemos el temporizador
      handleTimeout() // Ejecutamos la lógica de timeout
    }
  }, 1000) // 1000 milisegundos = 1 segundo
}

// Función que maneja cuando el jugador selecciona una respuesta
export function handleAnswer(choiceIdx) {
  console.log(`🤔 Jugador eligió opción: ${choiceIdx}`)

  // Detenemos el temporizador
  clearInterval(timerInterval)

  const q = partida.currentQuestion
  const correct = choiceIdx === q.respuesta // Verificamos si es correcta
  let damage = 0
  const maxTime = partida.getMaxTime()

  if (correct) {
    console.log("✅ Respuesta correcta!")
    // Calculamos el daño base + bonus por tiempo restante
    const baseDamage = 10
    const timeBonus = Math.round((partida.timer / maxTime) * 10)
    damage = Math.round((baseDamage + timeBonus) * partida.getDamageFactor())

    // El rival pierde vida
    partida.rival.vida = Math.max(0, partida.rival.vida - damage)
    console.log(`💥 ${partida.rival.nombre} pierde ${damage} de vida`)
  } else {
    console.log("❌ Respuesta incorrecta!")
    // El jugador actual pierde vida
    damage = Math.round(5 * partida.getDamageFactor())
    partida.jugadorActual.vida = Math.max(0, partida.jugadorActual.vida - damage)
    console.log(`💥 ${partida.jugadorActual.nombre} pierde ${damage} de vida`)
  }

  // Verificamos si alguien perdió toda su vida
  const gameOver = partida.jugadores.some((p) => p.vida <= 0)

  // Mostramos el resultado de la ronda
  ui.showRoundResult(correct, damage, false, () => {
    // Actualizamos las barras de vida
    ui.updateLifeBars(partida.jugadores)

    if (gameOver) {
      // Si el juego terminó, mostramos la pantalla de victoria
      const winner = partida.jugadores.find((p) => p.vida > 0)
      console.log("🏆 Ganador:", winner.nombre)
      ui.renderEnd({ winner, rounds: partida.round })
    } else {
      // Si el juego continúa, esperamos un poco y pasamos al siguiente turno
      setTimeout(() => {
        partida.siguienteJugador() // Cambiamos de jugador
        partida.round++ // Aumentamos el número de ronda
        nextTurn() // Iniciamos el siguiente turno
      }, 500)
    }
  })
}

// Función que maneja cuando se acaba el tiempo
function handleTimeout() {
  console.log("⏰ Se acabó el tiempo!")

  clearInterval(timerInterval)
  const damage = Math.round(5 * partida.getDamageFactor())

  if (!partida.isSecondChance) {
    // Primera vez que se acaba el tiempo: damos segunda oportunidad
    console.log("🔄 Dando segunda oportunidad al otro jugador")
    partida.isSecondChance = true
    partida.jugadorActual.vida = Math.max(0, partida.jugadorActual.vida - damage)
    partida.siguienteJugador()

    ui.showRoundResult(false, damage, true, () => {
      ui.updateLifeBars(partida.jugadores)
      ui.renderQuestion(partida.currentQuestion) // Misma pregunta
      startTimer() // Nuevo temporizador
    })
  } else {
    // Segunda vez que se acaba el tiempo: continuamos el juego
    console.log("💀 Segunda oportunidad perdida")
    partida.isSecondChance = false
    partida.jugadorActual.vida = Math.max(0, partida.jugadorActual.vida - damage)

    const gameOver = partida.jugadores.some((p) => p.vida <= 0)

    ui.showRoundResult(false, damage, true, () => {
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

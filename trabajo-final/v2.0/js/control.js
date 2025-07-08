// Importamos las clases de models.js y las funciones de ui.js
import { jugador as Jugador, pregunta as Pregunta, juego as JuegoModel } from "./models.js"
import * as ui from "./ui.js"

let partida // se guardara la instancia del juego.
let timerInterval // se controlara el temporizador de las preguntas.
let gameData // se cargargaran datos del juego desde JSON.

// funcion que se ejecuta cuando carga la página
export function init() {
  console.log("Se esta inicializando el juego.")
  // cargamos los datos del juego y renderizamos la pantalla de setup.
  loadGameData().then(() => {
    ui.renderSetup(startGame, gameData.metadata.temas)
  })
}

// Función que carga los datos del juego desde el JSON
async function loadGameData() {
  try {
    console.log("Se estan cargando los datos del juego.")
    const response = await fetch("data/preguntas.json")
    gameData = await response.json()

    console.log("Los datos estan cargados.", {
      temas: gameData.metadata.temas.length,
      preguntas: gameData.preguntas.length,
    })

    // validamos que tengamos al menos 2 temas
    if (gameData.metadata.temas.length < 2) {
      throw new Error("Se necesitan al menos 2 temas para jugar")
    }

    // validamos que cada tema tenga al menos una pregunta
    gameData.metadata.temas.forEach((tema) => {
      const preguntasDelTema = gameData.preguntas.filter((p) => p.topic === tema.nombre)
      if (preguntasDelTema.length === 0) {
        console.warn(`El tema "${tema.nombre}" no tiene preguntas`)
      }
    })
  } catch (error) {
    console.error("Error cargando datos del juego:", error)
    throw error
  }
}

// Función que inicia una nueva partida
async function startGame(rawPlayers) {
  console.log("Iniciando partida con jugadores:", rawPlayers)

  try {
    // convertimos los datos de los jugadores en objetos de la clase Jugador.
    const players = rawPlayers.map((p) => new Jugador(p.nombre, p.avatar, p.topics))

    // convertimos las preguntas del JSON en objetos de la clase Pregunta.
    const questions = gameData.preguntas.map((q) => new Pregunta(q))
    console.log("Preguntas cargadas:", questions.length)

    // creamos la instancia del juego.
    partida = new JuegoModel(players, questions)

    // combinamos todos los temas elegidos por ambos jugadores (sin repetir).
    const allTopics = [...partida.jugadores[0].topics, ...partida.jugadores[1].topics]
    partida.topicsEnJuego = [...new Set(allTopics)] // Set elimina duplicados.
    console.log("Temas en juego:", partida.topicsEnJuego)

    // validamos que todos los temas seleccionados existan en el JSON.
    const temasDisponibles = gameData.metadata.temas.map((t) => t.nombre)
    const temasInvalidos = partida.topicsEnJuego.filter((tema) => !temasDisponibles.includes(tema))

    if (temasInvalidos.length > 0) {
      throw new Error(`Temas no encontrados en el JSON: ${temasInvalidos.join(", ")}`)
    }

    // mostramos la pantalla de juego.
    ui.renderGame(partida, gameData.metadata.temas)

    // iniciamos el primer turno
    nextTurn()
  } catch (error) {
    console.error("Error iniciando partida:", error)
  }
}

// función que inicia un nuevo turno.
export function nextTurn() {
  console.log(`Turno ${partida.round} - Jugador: ${partida.jugadorActual.nombre}`)

  // elegimos un tema al azar de los disponibles.
  const topics = partida.topicsEnJuego
  const randomIndex = Math.floor(Math.random() * topics.length)
  const selectedTopic = topics[randomIndex]

  // guardamos el tema seleccionado.
  partida.currentTopic = selectedTopic
  console.log("Tema seleccionado:", selectedTopic)

  // buscamos una pregunta de ese tema que NO haya sido usada.
  const availableQuestions = partida.preguntas.filter((q) => q.topic === selectedTopic && !q.used)

  // si no hay preguntas disponibles de ese tema, reiniciamos todas las preguntas de ese tema (para testear el juego sin tener muchas preguntas cargadas).
  if (availableQuestions.length === 0) {
    console.log("Reiniciando preguntas del tema:", selectedTopic)
    partida.preguntas.forEach((q) => {
      if (q.topic === selectedTopic) {
        q.used = false // marcamos como no usadas.
      }
    })
    // volvemos a buscar preguntas disponibles.
    const resetQuestions = partida.preguntas.filter((q) => q.topic === selectedTopic && !q.used)
    partida.currentQuestion = resetQuestions[0]
  } else {
    // elegimos una pregunta al azar de las disponibles.
    const randomQuestionIndex = Math.floor(Math.random() * availableQuestions.length)
    partida.currentQuestion = availableQuestions[randomQuestionIndex]
  }

  // marcamos la pregunta como usada.
  partida.currentQuestion.used = true
  console.log("Pregunta seleccionada:", partida.currentQuestion.text)

  // iniciamos la animación de la ruleta.
  ui.renderSpinner(selectedTopic, randomTopicIndex, partida.topicsEnJuego, gameData.metadata.temas)
}

// funcion que se ejecuta cuando la ruleta termina de girar.
export function handleSpinEnd() {
  console.log("La ruleta ha terminado de girar")

  // mostramos la pregunta seleccionada.
  ui.renderQuestion(partida.currentQuestion)

  // iniciamos el temporizador.
  startTimer()
}

// funcion que inicia el temporizador de la pregunta.
function startTimer() {
  // limpiamos cualquier temporizador anterior.
  clearInterval(timerInterval)

  // calculamos el tiempo maximo basado en la dificultad.
  const maxTime = partida.getMaxTime()
  partida.timer = maxTime

  console.log(`Iniciando temporizador: ${maxTime} segundos`)

  // actualizamos la pantalla con el tiempo inicial.
  ui.updateTimer(maxTime)

  // creamos un intervalo que se ejecuta cada segundo.
  timerInterval = setInterval(() => {
    partida.timer-- // reducimos el tiempo en 1.
    ui.updateTimer(partida.timer) // actualizamos la pantalla.

    // si el tiempo llego a 0, se acabo el tiempo.
    if (partida.timer <= 0) {
      clearInterval(timerInterval) // detenemos el temporizador.
      handleTimeout() // ejecutamos el manejador de Timeout. 
    }
  }, 1000)
}

// función que maneja cuando el jugador selecciona una respuesta.
export function handleAnswer(choiceIdx) {
  console.log(`Jugador eligió opción: ${choiceIdx}`)

  // detenemos el temporizador
  clearInterval(timerInterval)

  const q = partida.currentQuestion
  const correct = choiceIdx === q.respuesta // verificamos si es correcta.
  let damage = 0
  const maxTime = partida.getMaxTime()

  if (correct) {
    console.log(`Respuesta del jugador ${partida.jugadorActual.nombre} correcta.`)
    // calculamos el daño base + bonus por tiempo restante.
    const baseDamage = 10
    const timeBonus = Math.round((partida.timer / maxTime) * 10)
    damage = Math.round((baseDamage + timeBonus) * partida.getDamageFactor())

    // el rival pierde vida.
    partida.rival.vida = Math.max(0, partida.rival.vida - damage)
    console.log(`${partida.rival.nombre} pierde ${damage} de vida.`)
  } else {
    console.log(`Respuesta del jugador ${partida.jugadorActual.nombre} incorrecta.`)
    // el jugador actual pierde vida.
    damage = Math.round(5 * partida.getDamageFactor())
    partida.jugadorActual.vida = Math.max(0, partida.jugadorActual.vida - damage)
    console.log(`${partida.jugadorActual.nombre} pierde ${damage} de vida.`)
  }

  // verificamos si alguien perdio toda su vida.
  const gameOver = partida.jugadores.some((p) => p.vida <= 0)

  // mostramos el resultado de la ronda.
  ui.showRoundResult(correct, damage, false, () => {
    // actualizamos las barras de vida.
    ui.updateLifeBars(partida.jugadores)

    if (gameOver) {
      // si el juego termino, mostramos la pantalla de victoria.
      const winner = partida.jugadores.find((p) => p.vida > 0)
      console.log("Ganador:", winner.nombre)
      ui.renderEnd({ winner, rounds: partida.round })
    } else {
      // si el juego continua, esperamos un poco y pasamos al siguiente turno.
      setTimeout(() => {
        partida.siguienteJugador() // cambiamos de jugador.
        partida.round++ // aumentamos el numero de ronda.
        nextTurn() // iniciamos el siguiente turno.
      }, 500)
    }
  })
}

// funcion que maneja cuando se acaba el tiempo.
function handleTimeout() {
  console.log(`Se le acabo el tiempo al jugador ${partida.jugadorActual.nombre}.`)

  clearInterval(timerInterval)
  const damage = Math.round(5 * partida.getDamageFactor())

  if (!partida.isSecondChance) {
    // primera vez que se acaba el tiempo -> damos segunda oportunidad.
    console.log(`Oportunidad bonus al jugador ${partida.rival.nombre} `)
    partida.isSecondChance = true
    partida.jugadorActual.vida = Math.max(0, partida.jugadorActual.vida - damage)
    partida.siguienteJugador()

    ui.showRoundResult(false, damage, true, () => {
      ui.updateLifeBars(partida.jugadores)
      ui.renderQuestion(partida.currentQuestion) // misma pregunta.
      startTimer() // nuevo temporizador.
    })
  } else {
    // segunda vez que se acaba el tiempo -> continuamos el juego.
    console.log(`Oportunidad bonus al jugador ${partida.jugadorActual.nombre} perdida`)
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

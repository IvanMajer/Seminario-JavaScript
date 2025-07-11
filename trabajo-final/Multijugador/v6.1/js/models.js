// js/models.js - Aquí definimos las clases que representan los datos del juego

// Clase Jugador: representa a cada jugador del juego
export class jugador {
  constructor(nombre, avatar, topics = []) {
    this.nombre = nombre // Nombre del jugador (string)
    this.avatar = avatar // Avatar del jugador (puede ser emoji o ruta de imagen)
    this.topics = topics // Array de temas que eligió el jugador
    this.maxVida = 100 // Vida máxima del jugador (constante)
    this.vida = this.maxVida // Vida actual del jugador (empieza en 100)
  }
}

// Clase Pregunta: representa cada pregunta del juego
export class pregunta {
  constructor({ id, topic, text, opciones, respuesta, dificultad }) {
    this.id = id // ID único de la pregunta
    this.topic = topic // Tema al que pertenece (Historia, Ciencia, etc.)
    this.text = text // El texto de la pregunta
    this.opciones = opciones // Array con las 4 opciones de respuesta
    this.respuesta = respuesta // Índice de la respuesta correcta (0, 1, 2 o 3)
    this.dificultad = dificultad // Nivel de dificultad (1, 2 o 3)
    this.used = false // NUEVO: marca si la pregunta ya fue usada
  }
}

// Clase Juego: controla toda la lógica del juego
export class juego {
  constructor(jugadores, preguntas) {
    this.jugadores = jugadores // Array con los 2 jugadores
    this.preguntas = preguntas // Array con todas las preguntas disponibles
    this.jugadorActualID = 0 // ID del jugador que está jugando (0 o 1)
    this.round = 1 // Número de ronda actual
    this.isSecondChance = false // Si es la segunda oportunidad de responder
    this.topicsEnJuego = [] // NUEVO: temas que están en la ruleta
    this.currentTopic = null // NUEVO: tema actual seleccionado
    this.currentQuestion = null // NUEVO: pregunta actual
    this.timer = 0 // NUEVO: tiempo restante
  }

  // Getter: devuelve el jugador que está jugando actualmente
  get jugadorActual() {
    return this.jugadores[this.jugadorActualID]
  }

  // Getter: devuelve el jugador rival (el que no está jugando)
  get rival() {
    return this.jugadores[1 - this.jugadorActualID]
  }

  // Cambia al siguiente jugador
  siguienteJugador() {
    this.jugadorActualID = 1 - this.jugadorActualID // Si era 0 pasa a 1, si era 1 pasa a 0
  }

  // Calcula el tiempo máximo basado en la dificultad de la pregunta
  getMaxTime() {
    // Dificultad 1 = 15 segundos, Dificultad 2 = 12 segundos, Dificultad 3 = 10 segundos
    return Math.max(10, 17 - this.currentQuestion.dificultad * 2)
  }

  // Calcula el factor de daño (en segunda oportunidad es menor)
  getDamageFactor() {
    return this.isSecondChance ? 0.5 : 1 // Si es segunda chance, el daño es la mitad
  }
}

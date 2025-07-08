// clase jugador -> representa a cada jugador.
export class jugador {
  constructor(nombre, avatar, topics = []) {
    this.nombre = nombre
    this.avatar = avatar
    this.topics = topics
    this.maxVida = 100
    this.vida = this.maxVida
  }
}

// clase Pregunta -> representa cada pregunta del juego
export class pregunta {
  constructor({ id, topic, text, opciones, respuesta, dificultad }) {
    this.id = id
    this.topic = topic
    this.text = text
    this.opciones = opciones
    this.respuesta = respuesta
    this.dificultad = dificultad
    this.used = false
  }
}

// Clase Juego: controla toda la lógica del juego
export class juego {
  constructor(jugadores, preguntas) {
    this.jugadores = jugadores
    this.preguntas = preguntas
    this.jugadorActualID = 0
    this.round = 1
    this.isSecondChance = false
    this.topicsEnJuego = []
    this.currentTopic = null
    this.currentQuestion = null
    this.timer = 0
  }

  // devuelve el jugador que está jugando actualmente.
  get jugadorActual() {
    return this.jugadores[this.jugadorActualID]
  }

  // devuelve el jugador rival (el que no está jugando).
  get rival() {
    return this.jugadores[1 - this.jugadorActualID]
  }

  // cambia al siguiente jugador.
  siguienteJugador() {
    this.jugadorActualID = 1 - this.jugadorActualID
  }

  // calcula el tiempo máximo basado en la dificultad de la pregunta.
  getMaxTime() {
    // dificultad 1 = 15 segundos, Dificultad 2 = 12 segundos, Dificultad 3 = 10 segundos
    return Math.max(10, 17 - this.currentQuestion.dificultad * 2)
  }

  // calcula el factor de daño (en segunda oportunidad es menor)
  getDamageFactor() {
    return this.isSecondChance ? 0.5 : 1 // Si es segunda chance, el daño es la mitad
  }
}

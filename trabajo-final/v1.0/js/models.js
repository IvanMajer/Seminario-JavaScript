export class jugador{
    constructor(nombre, avatar, topics = []){
        this.nombre = nombre;
        this.avatar = avatar;
        this.topics = topics;
        this.maxVida = 100; 
        this.vida = this.maxVida;
    }
}

export class pregunta{
    constructor({id, topic, text, opciones, respuesta, dificultad}){
        this.id = id; 
        this.topic = topic;
        this.text = text; 
        this.opciones = opciones; 
        this.respuesta = respuesta;
        this.dificultad = dificultad;
    }
}

export class juego {
    constructor(jugadores, preguntas){
        this.jugadores = jugadores;
        this.preguntas = preguntas; 
        this.jugadorActualID = 0;
        this.round = 1;
        this.isSecondChance = false; // indica si es la segunda chance de contestar. 
    }
    get jugadorActual(){
        return this.jugadores[this.jugadorActualID];
    }
    get rival(){
        return this.jugadores[1 - this.jugadorActualID];
    }
    siguienteJugador(){
        this.jugadorActualID = 1 - this.jugadorActualID;
    }
    //tiempo base por ronda, cambia segun la ronda
    getMaxTime(){
        return Math.max(5, 15 - (this.round - 1));
    }
    //factor daño en segunda oportunidad
    getDamageFactor(){
        return this.isSecondChance ? 0.5 : 1;
    }

}

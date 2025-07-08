
import * as control from "./control.js"

// variables globales para la ruleta. 
let wheelCanvas, wheelCtx, spinButton
let sectors = []
let isSpinning = false
let currentTopics = []
let targetTopic = ""
let animationId = null

// constantes para la ruleta
const PI = Math.PI
const TAU = 2 * PI
const rad = 200 // radio de la ruleta (400px de diámetro)

// funcion que renderiza la pantalla inicial de configuracion.
export function renderSetup(onStart, availableTopics) {
  const root = document.getElementById("root")

  // html para cada jugador. 
  const playersHtml = [0, 1]
    .map((i) => {
      return `
      <div class="jugador-setup animate-slide-in" data-jugador="${i}">
        <h2>🎮 Jugador ${i + 1}</h2>
        
        <!-- Campo para el nombre -->
        <div class="input-group">
          <label>Nombre:</label>
          <input type="text" placeholder="Ingresa tu nombre" class="js-nombre fancy-input"/>
        </div>
        
        <!-- Selector de avatar personalizado -->
        <div class="avatar-group">
          <label>Elige tu avatar:</label>
          <div class="avatar-grid">
            ${generateAvatarOptions(i)}
          </div>
        </div>
        
        <!-- Selector de temas -->
        <div class="topics">
          <label>Selecciona exactamente 2 temas:</label>
          <div class="topics-grid">
            ${availableTopics
              .map(
                (tema) => `
                <label class="topic-card">
                  <input type="checkbox" value="${tema.nombre}"/> 
                  <span class="topic-icon">${tema.icono}</span>
                  <span>${tema.nombre}</span>
                </label>
              `,
              )
              .join("")}
          </div>
        </div>
      </div>
    `
    })
    .join("")

  // HTML completo de la pagina. 
  root.innerHTML = `
    <div class="setup-container">
      <header class="game-header">
        <h1 class="main-title">🧐La batalla del conocimiento🧐</h1>
        <p class="subtitle">¡El duelo de conocimientos más épico!</p>
      </header>
      
      <!-- Sección de reglas del juego -->
      <div class="rules-section">
        <button class="rules-toggle" id="rules-toggle">
          📋 Reglas del Juego ▼
        </button>
        <div class="rules-content" id="rules-content">
          <div class="rules-grid">
            <div class="rule-item">
              <span class="rule-icon">🎯</span>
              <h3>Objetivo</h3>
              <p>Reduce la vida de tu oponente a 0 respondiendo preguntas correctamente.</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">🎲</span>
              <h3>Ruleta</h3>
              <p>La ruleta decide el tema de cada pregunta basado en los temas seleccionados.</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">⏱️</span>
              <h3>Tiempo</h3>
              <p>Tienes tiempo limitado según la dificultad. ¡Respondé rápido!</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">💔</span>
              <h3>Daño</h3>
              <p>Respuesta correcta: quita vida al rival. Si es Incorrecta o te quedas sin tiempo: Te quita vida.</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">🔄</span>
              <h3>Segunda Oportunidad</h3>
              <p>Si se acaba el tiempo, el otro jugador tiene una respuesta bonus. ¡Podrá hacerte daño!</p>
            </div>
            <div class="rule-item">
              <span class="rule-icon">🏆</span>
              <h3>Victoria</h3>
              <p>El último jugador en pie gana la partida.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="players-section">
        ${playersHtml}
      </div>
      
      <button id="start-btn" class="start-button" disabled>
        🚀 Iniciar Batalla.
      </button>
    </div>
  `

  // obtenemos referencias a los elementos que necesitamos.
  const startBtn = document.getElementById("start-btn")
  const rulesToggle = document.getElementById("rules-toggle")
  const rulesContent = document.getElementById("rules-content")

  console.log("Pantalla de setup renderizada.")

  // Event listener para mostrar/ocultar reglas
  rulesToggle.addEventListener("click", () => {
    const isOpen = rulesContent.classList.contains("open")
    rulesContent.classList.toggle("open")
    rulesToggle.textContent = isOpen ? "📋 Ver Reglas del Juego ▼" : "📋 Ocultar Reglas ▲"
  })

  // event listener para validar el formulario en tiempo real
  root.addEventListener("input", () => {
    // verificamos que ambos jugadores tengan nombre y exactamente 2 temas.
    const ok = [0, 1].every((i) => {
      const playerDiv = root.querySelector(`.jugador-setup[data-jugador="${i}"]`)
      const nombre = playerDiv.querySelector(".js-nombre").value.trim()
      const avatar = playerDiv.querySelector(`input[name="avatar-player-${i}"]:checked`)
      const topics = playerDiv.querySelectorAll('input[type="checkbox"]:checked')

      return nombre && avatar && topics.length === 2
    })

    // habilitamos/deshabilitamos el boton segun la validacion.
    startBtn.disabled = !ok
    startBtn.classList.toggle("ready", ok)
  })

  // event listener para el boton de iniciar.
  startBtn.addEventListener("click", () => {
    console.log("se inicio el juego.")

    // recopilamos los datos de ambos jugadores.
    const players = [0, 1].map((i) => {
      const playerDiv = root.querySelector(`.jugador-setup[data-jugador="${i}"]`)
      const avatar = playerDiv.querySelector(`input[name="avatar-player-${i}"]:checked`).value

      return {
        nombre: playerDiv.querySelector(".js-nombre").value.trim(),
        avatar: avatar,
        topics: Array.from(playerDiv.querySelectorAll('input[type="checkbox"]:checked')).map(
          (checkbox) => checkbox.value,
        ),
      }
    })

    console.log("Jugadores configurados:", players)
    onStart(players) // llamado a funcion que inicia el juego. 
  })
}

// funcion que genera las opciones de avatar desde la carpeta assets.
function generateAvatarOptions(playerIndex) {
  // lista de avatares disponibles en la carpeta assets/avatar/
  const avatarFiles = [
    "avatar1.png",
    "avatar2.png",
    "avatar3.png",
    "avatar4.png",
    "avatar5.png",
    "avatar6.png",
    "avatar7.png",
    "avatar8.png",
  ]

  return avatarFiles
    .map(
      (file, index) => `
    <label class="avatar-option">
      <input type="radio" name="avatar-player-${playerIndex}" value="assets/avatar/${file}">
      <img src="assets/avatar/${file}" alt="Avatar ${index + 1}" class="avatar-img">
    </label>
  `,
    )
    .join("")
}

// funcion que devuelve el icono correspondiente a cada tema.
function getTopicIcon(topicName, availableTopics) {
  const tema = availableTopics.find((t) => t.nombre === topicName)
  return tema ? tema.icono : "📚"
}

// funcion que renderiza la pantalla principal del juego.
export function renderGame(partida, availableTopics) {
  const root = document.getElementById("root")

  root.innerHTML = `
<div class="game-container">
  <!-- Jugador 1 - Arriba -->
  <div id="p1-info" class="player-info player-top"></div>
  
  <!-- Ruleta - Centro izquierda -->
  <div class="wheel-container">
    <div id="spin_the_wheel">
      <canvas id="wheel" width="400" height="400"></canvas>
      <div id="spin">GIRAR</div>
    </div>
  </div>
  
  <!-- Panel de pregunta - Derecha -->
  <div class="question-area">
    <div class="round-header">
      <h2>RONDA: <span id="round-number">${partida.round}</span></h2>
    </div>
    
    <div id="question-panel" class="question-panel-new hidden">
      <div class="timer-section">
        <div class="timer-circle">
          <span id="timer">0</span>
        </div>
      </div>
      
      <div class="question-content-new">
        <div class="question-text-area">
          <p id="question-text">Pregunta aparecerá aquí</p>
        </div>
        
        <div class="question-layout">
          <div class="options-section">
            <div class="options-container" id="options-container">
              <!-- Las opciones se generarán dinámicamente -->
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Jugador 2 - Abajo -->
  <div id="p2-info" class="player-info player-bottom"></div>
</div>
`

  // actualizamos las barras de vida iniciales.
  updateLifeBars(partida.jugadores)
  console.log("Pantalla de juego renderizada.")
}

// funcion que actualiza las barras de vida de los jugadores.
export function updateLifeBars(jugadores) {
  jugadores.forEach((player, index) => {
    const playerInfoDiv = document.getElementById(`p${index + 1}-info`)
    const lifePercentage = Math.round((player.vida / player.maxVida) * 100)
    const isLowLife = lifePercentage <= 25 // vida baja si es menor al 25%.

    playerInfoDiv.innerHTML = `
      <div class="player-avatar ${isLowLife ? "danger" : ""}">
        <img src="${player.avatar}" alt="${player.nombre}" class="avatar-image">
      </div>
      <div class="player-details">
        <span class="player-name">${player.nombre}</span>
        <div class="life-container">
          <div class="life-bar ${isLowLife ? "danger" : ""}">
            <div class="life-fill" style="width:${lifePercentage}%"></div>
          </div>
          <span class="life-text">${player.vida}/${player.maxVida}</span>
        </div>
      </div>
    `
  })
}


// funcion inicio de ruleta. 
function initWheel(topics, availableTopics) {
  console.log("Se inicio la ruleta con los temas:", topics)

  // guardamos los temas actuales.
  currentTopics = [...topics]

  // obtenemos referencias al canvas y botón.
  wheelCanvas = document.querySelector("#wheel")
  wheelCtx = wheelCanvas.getContext("2d")
  spinButton = document.querySelector("#spin")

  // creamos los sectores basados SOLO en los temas del juego
  sectors = topics.map((topicName, index) => {
    const temaInfo = availableTopics.find((t) => t.nombre === topicName)
    return {
      color: temaInfo ? temaInfo.color : "#DC143C",
      text: "#FFFFFF",
      label: `${temaInfo ? temaInfo.icono : "📚"} ${topicName}`,
      topicName: topicName,
    }
  })

  console.log("Sectores creados:", sectors)

  // reseteamos variables.
  isSpinning = false
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // dibujamos la ruleta inicial.
  drawWheel(0)

  // removemos listeners anteriores y agregamos el nuevo.
  const newSpinButton = spinButton.cloneNode(true)
  spinButton.parentNode.replaceChild(newSpinButton, spinButton)
  spinButton = newSpinButton

  // event listener para el botón de girar.
  spinButton.addEventListener("click", () => {
    if (!isSpinning) {
      startSpin()
    }
  })
}

// nueva función para dibujar la ruleta completa.
function drawWheel(rotation) {
  // Limpiamos el canvas.
  wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height)

  const arc = TAU / sectors.length

  // dibujamos cada sector.
  sectors.forEach((sector, i) => {
    const startAngle = arc * i + rotation

    wheelCtx.save()

    // dibujar el sector.
    wheelCtx.beginPath()
    wheelCtx.fillStyle = sector.color
    wheelCtx.moveTo(rad, rad)
    wheelCtx.arc(rad, rad, rad, startAngle, startAngle + arc)
    wheelCtx.lineTo(rad, rad)
    wheelCtx.fill()

    // dibujar el texto.
    wheelCtx.translate(rad, rad)
    wheelCtx.rotate(startAngle + arc / 2)
    wheelCtx.textAlign = "right"
    wheelCtx.fillStyle = sector.text
    wheelCtx.font = "bold 16px Arial"
    wheelCtx.fillText(sector.label, rad - 20, 6)

    wheelCtx.restore()
  })
}

// nueva función para iniciar el giro.
function startSpin() {
  if (isSpinning) return

  console.log("Iniciando giro hacia:", targetTopic)

  // encontramos el índice del tema objetivo.
  const targetIndex = currentTopics.indexOf(targetTopic)
  if (targetIndex === -1) {
    console.error("Tema objetivo no encontrado:", targetTopic)
    return
  }

  isSpinning = true
  spinButton.textContent = "GIRANDO..."
  spinButton.style.background = "#666"

  // calculamos el ángulo objetivo.
  const arc = TAU / sectors.length
  const targetAngle = targetIndex * arc + arc / 2

  // parametros de animacion.
  const duration = 3000 // 3 segundos.
  const spins = 5 // 5 vueltas completas.
  const totalRotation = TAU * spins + targetAngle

  const startTime = Date.now()
  let currentRotation = 0

  // funcion de animacion.
  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)

    // funcion de easing (desaceleración suave).
    const easeOut = 1 - Math.pow(1 - progress, 3)

    currentRotation = totalRotation * easeOut

    // dibujamos la ruleta con la nueva rotación.
    drawWheel(currentRotation)

    if (progress < 1) {
      // Continuamos la animación
      animationId = requestAnimationFrame(animate)
    } else {
      // Animación terminada
      finishSpin()
    }
  }

  // iniciamos la animacion.
  playSound("spin")
  animate()
}

// funcion que se ejecuta cuando termina el giro.
function finishSpin() {
  isSpinning = false

  // verificamos en que sector termino.
  const finalIndex = currentTopics.indexOf(targetTopic)
  const finalSector = sectors[finalIndex]

  console.log("Ruleta detenida en:", finalSector.topicName)

  // actualizamos el boton.
  spinButton.textContent = "GIRAR"
  spinButton.style.background = "#DC143C"
  spinButton.style.color = "#FFFFFF"

  playSound("stop")

  // notificamos al controlador después de un breve delay.
  setTimeout(() => {
    control.handleSpinEnd()
  }, 500)
}

export function renderSpinner(topic, topicIndex, topics, availableTopics) {
  const questionPanel = document.getElementById("question-panel")

  // ocultamos el panel de preguntas.
  questionPanel.classList.add("hidden")

  console.log(`Preparando ruleta para tema: ${topic}`)

  // guardamos el tema objetivo.
  targetTopic = topic

  // inicializamos o reinicializamos la ruleta.
  if (!wheelCanvas || JSON.stringify(currentTopics) !== JSON.stringify(topics)) {
    initWheel(topics, availableTopics)
  } else {
    // solo actualizamos el tema objetivo si la ruleta ya existe.
    targetTopic = topic
  }

  console.log("Ruleta lista. El usuario debe clickear para girar.")
}

// funcion que renderiza una pregunta.
export function renderQuestion(pregunta) {
  const questionPanel = document.getElementById("question-panel")
  const difficultyStars = "⭐".repeat(pregunta.dificultad)

  console.log("Mostrando pregunta:", pregunta.text)

  // actualizamos el texto de la pregunta.
  document.getElementById("question-text").textContent = pregunta.text

  // generamos las opciones.
  const optionsContainer = document.getElementById("options-container")
  optionsContainer.innerHTML = pregunta.opciones
    .map(
      (opcion, i) => `
    <div class="option-item" data-idx="${i}">
      <div class="option-checkbox"></div>
      <span class="option-text">${opcion}</span>
    </div>
  `,
    )
    .join("")

  // panel de preguntas
  questionPanel.classList.remove("hidden")

  // agregamos event listeners a cada opción
  optionsContainer.querySelectorAll(".option-item").forEach((item) => {
    item.addEventListener("click", (event) => {
      const selectedIndex = +event.currentTarget.dataset.idx
      console.log(`Opcion seleccionada: ${selectedIndex} (${pregunta.opciones[selectedIndex]})`)

      // marcamos la opción como seleccionada visualmente.
      item.classList.add("selected")

      // deshabilitamos todas las opciones para evitar múltiples clics.
      optionsContainer.querySelectorAll(".option-item").forEach((opt) => {
        opt.style.pointerEvents = "none"
      })

      // llamamos al controlador con la respuesta.
      control.handleAnswer(selectedIndex)
    })
  })
}

// funcion que actualiza el temporizador en pantalla.
export function updateTimer(value) {
  const timerElement = document.getElementById("timer")
  if (timerElement) {
    timerElement.textContent = value

    // si quedan 3 segundos o menos, agregamos clase de peligro.
    const timerCircle = timerElement.parentElement
    timerCircle.classList.toggle("danger", value <= 3)

    // reproducimos sonido de tick en los últimos 3 segundos.
    if (value <= 3 && value > 0) {
      playSound("tick")
    }
  }
}

// funcion que muestra el resultado de cada ronda.
export function showRoundResult(correct, damage, isTimeout = false, onClose) {
  // determinamos el mensaje segun el resultado.
  const message = isTimeout
    ? `⏰ ¡Se acabó el tiempo! -${damage} de vida`
    : correct
      ? `🎉 ¡Respuesta correcta! -${damage} al rival`
      : `❌ Respuesta incorrecta: -${damage} para ti`

  const icon = isTimeout ? "⏰" : correct ? "🎉" : "❌"
  const className = isTimeout ? "timeout" : correct ? "correct" : "incorrect"

  // reproducimos sonido según el resultado.
  if (correct) {
    playSound("correct")
  } else {
    playSound("incorrect")
  }

  // creamos el modal.
  const modal = document.createElement("div")
  modal.className = "modal"
  modal.innerHTML = `
    <div class="modal-content ${className}">
      <div class="result-icon">${icon}</div>
      <p class="result-message">${message}</p>
      <button id="modal-ok" class="modal-button">Continuar</button>
    </div>
  `

  document.body.appendChild(modal)

  // event listener para cerrar el modal.
  document.getElementById("modal-ok").addEventListener("click", () => {
    document.body.removeChild(modal)
    onClose() // ejecutamos la función de callback.
  })
}

// función que renderiza la pantalla final.
export function renderEnd({ winner, rounds }) {
  const root = document.getElementById("root")

  console.log("🏆 Juego terminado. Ganador:", winner.nombre)
  playSound("victory") // Sonido de victoria

  root.innerHTML = `
    <div class="end-screen">
      <div class="victory-container">
        <h1 class="victory-title">🏆 ¡Victoria! 🏆</h1>
        <div class="winner-info">
          <div class="winner-avatar">
            <img src="${winner.avatar}" alt="${winner.nombre}" class="winner-avatar-img">
          </div>
          <h2 class="winner-name">${winner.nombre}</h2>
          <p class="winner-subtitle">¡${winner.nombre} es un guerrero del conocimiento!</p>
        </div>
        
        <div class="stats-container">
          <div class="stat-item">
            <span class="stat-icon">🎯</span>
            <span class="stat-label">Rondas jugadas:</span>
            <span class="stat-value">${rounds}</span>
          </div>
        </div>
        
        <button id="restart" class="restart-button">
          🔄 Jugar de Nuevo
        </button>
      </div>
    </div>
  `

  // event listener para reiniciar el juego.
  document.getElementById("restart").addEventListener("click", () => {
    console.log("Se reincia el juego.")
    window.location.reload() // recarga la página.
  })
}

// funcion auxiliar para reproducir sonidos.
function playSound(soundType) {
  // esta funcion intentara reproducir sonidos si están disponibles.
  try {
    const audio = new Audio()

    switch (soundType) {
      case "spin":
        // ruleta girando.
        console.log("Reproduciendo sonido: ruleta girando")
        break
      case "stop":
        // para la ruleta
        console.log("Reproduciendo sonido: ruleta detenida")
        break
      case "tick":
        // tick del temporizador
        console.log("Reproduciendo sonido: tick")
        break
      case "correct":
        // respuesta correcta
        console.log("Reproduciendo sonido: respuesta correcta")
        break
      case "incorrect":
        // respuesta incorrecta
        console.log("Reproduciendo sonido: respuesta incorrecta")
        break
      case "victory":
        // Sonido de victoria
        console.log("Reproduciendo sonido: victoria")
        break
    }
  } catch (error) {
    console.log("No se pudo reproducir el sonido:", soundType)
  }
}

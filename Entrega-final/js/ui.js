// js/ui.js
import * as control from './control.js';

export function renderSetup(onStart) {
  const root = document.getElementById('root');
  root.innerHTML = `
    <h1>Versus Preguntas</h1>
    <div class="setup">
      ${[0,1].map(i => `
      <div class="jugador-setup" data-jugador="${i}">
        <h2>Jugador ${i+1}</h2>
        <input type="text" placeholder="Nombre" class="js-nombre"/>
        <select class="js-avatar">
          <option value="😎">😎</option>
          <option value="🤓">🤓</option>
        </select>
        <div class="topics">
          ${['Historia','Ciencia','Arte','Deportes']
            .map(t => `<label><input type="checkbox" value="${t}"/> ${t}</label>`)
            .join('')}
        </div>
      </div>`).join('')}
    </div>
    <button id="start-btn" disabled>Iniciar Partida</button>
  `;

  const startBtn = document.getElementById('start-btn');
  root.addEventListener('input', () => {
    const ok = [0,1].every(i => {
      const p      = root.querySelector(`.jugador-setup[data-jugador="${i}"]`);
      const nombre = p.querySelector('.js-nombre').value.trim();
      const topics = p.querySelectorAll('input:checked');
      return nombre && topics.length === 2;
    });
    startBtn.disabled = !ok;
  });

  startBtn.addEventListener('click', () => {
    const players = [0,1].map(i => {
      const p = root.querySelector(`.jugador-setup[data-jugador="${i}"]`);
      return {
        nombre: p.querySelector('.js-nombre').value.trim(),
        avatar: p.querySelector('.js-avatar').value,
        topics: Array.from(p.querySelectorAll('input:checked')).map(ch => ch.value)
      };
    });
    onStart(players);
  });
}

export function renderGame(partida) {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="game-header">
      <div id="p1-info" class="player-info"></div>
      <div id="p2-info" class="player-info"></div>
    </div>
    <div class="game-body">
      <div id="spinner" class="spinner"></div>
      <div id="question-panel" class="question-panel"></div>
    </div>
  `;
  updateLifeBars(partida.jugadores);
  control.nextTurn();
}

export function updateLifeBars(jugadores) {
  jugadores.forEach((p,i) => {
    const el  = document.getElementById(`p${i+1}-info`);
    const pct = Math.round(p.vida / p.maxVida * 100);
    el.innerHTML = `
      <img src="${p.avatar}" class="avatar"/>
      <span class="name">${p.nombre}</span>
      <div class="life-bar">
        <div class="life-fill" style="width:${pct}%"></div>
      </div>
    `;
  });
}

export function renderSpinner(topic, topicIndex, totalTopics) {
  const spinEl = document.getElementById('spinner');
  spinEl.innerHTML = '';
  spinEl.classList.add('spinning');

  const segmentAngle = 360 / totalTopics;
  const degs = 360*3 + (topicIndex*segmentAngle) + segmentAngle/2;

  // CORRECCIÓN: transform (no tranform)
  spinEl.style.transition = 'transform 2s ease-out';
  spinEl.style.transform  = `rotate(${degs}deg)`;

  spinEl.addEventListener('transitionend', () => {
    spinEl.classList.remove('spinning');
    control.handleSpinEnd();
  }, { once: true });
}

export function renderQuestion(pregunta) {
  const panel = document.getElementById('question-panel');
  panel.innerHTML = `
    <div class="timer">
      Tiempo: <span id="timer">${pregunta.dificultad}</span>s
    </div>
    <p class="q-text">${pregunta.text}</p>
    <div class="options">
      ${pregunta.opciones.map((opt,i) =>
        `<button class="opt-btn" data-idx="${i}">${opt}</button>`
      ).join('')}
    </div>
  `;
  panel.querySelectorAll('.opt-btn').forEach(btn =>
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.idx;
      control.handleAnswer(idx);
    })
  );
}

export function updateTimer(value) {
  document.getElementById('timer').textContent = value;
}

export function showRoundResult(correct, damage, isTimeout=false, onClose) {
  const msg = isTimeout
    ? `Se acabó el tiempo: -${damage} de vida.`
    : correct
      ? `¡Bien! -${damage} al rival.`
      : `Mal: -${damage} para vos.`;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <p>${msg}</p>
      <button id="modal-ok">OK</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('modal-ok').addEventListener('click', () => {
    document.body.removeChild(modal);
    onClose();
  });
}

export function renderEnd({ winner, rounds }) {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="end-screen">
      <h2>¡${winner.nombre} gana!</h2>
      <img src="${winner.avatar}" class="avatar-large"/>
      <p>Rondas jugadas: ${rounds}</p>
      <button id="restart">Reiniciar</button>
    </div>
  `;
  document.getElementById('restart').addEventListener('click', () =>
    window.location.reload()
  );
}

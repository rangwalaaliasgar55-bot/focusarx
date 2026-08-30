// Web Worker for accurate timer that doesn't drift when tab is backgrounded
// Browsers throttle setTimeout/setInterval to 1Hz or less in background tabs

let intervalId: number | null = null;
let startTime: number = 0;
let pausedTime: number = 0;
let duration: number = 0;
let isPaused: boolean = false;

function tick() {
  const now = Date.now();
  const elapsed = isPaused ? pausedTime : Math.floor((now - startTime) / 1000);
  const remaining = Math.max(0, duration - elapsed);

  self.postMessage({
    type: 'tick',
    elapsed,
    remaining,
    isPaused,
  });

  if (remaining <= 0 && !isPaused) {
    self.postMessage({ type: 'complete' });
    stop();
  }
}

function start(durationSeconds: number) {
  stop();
  duration = durationSeconds;
  startTime = Date.now();
  pausedTime = 0;
  isPaused = false;
  intervalId = self.setInterval(tick, 100); // 100ms updates for smooth UI
  tick();
}

function pause() {
  if (intervalId && !isPaused) {
    isPaused = true;
    pausedTime = Math.floor((Date.now() - startTime) / 1000);
    self.postMessage({ type: 'paused', elapsed: pausedTime });
  }
}

function resume() {
  if (isPaused) {
    isPaused = false;
    startTime = Date.now() - (pausedTime * 1000);
    self.postMessage({ type: 'resumed', elapsed: pausedTime });
  }
}

function stop() {
  if (intervalId) {
    self.clearInterval(intervalId);
    intervalId = null;
  }
  startTime = 0;
  pausedTime = 0;
  duration = 0;
  isPaused = false;
}

self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'start':
      start(data.durationSeconds);
      break;
    case 'pause':
      pause();
      break;
    case 'resume':
      resume();
      break;
    case 'stop':
      stop();
      break;
  }
});

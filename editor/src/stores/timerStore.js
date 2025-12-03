import { create } from "zustand";

export const useTimerStore = create((set) => ({
  time: 0,
  maxTime: null,
  shouldLoop: true,
  isRunning: false,
  intervalId: null,
  fps: 25,
  setFps: (fps) => set({ fps: Number(fps) }),
  setMaxTime: (maxTime) => set({ maxTime }),
  setShouldLoop: (shouldLoop) => set({ shouldLoop }),
  setTime: (newTime) => set({ time: Number(newTime) }),
  startTimer: () => {
    let baseTime = Date.now() - useTimerStore.getState().time * 1000;
    const intervalId = setInterval(() => {
      const currentTime = Date.now();
      let newTime = (currentTime - baseTime) / 1000;
      const { maxTime, shouldLoop } = useTimerStore.getState();

      if (maxTime && newTime >= maxTime) {
        if (shouldLoop) {
          baseTime = currentTime;
          newTime = 0;
          set({ time: newTime });
        } else {
          clearInterval(intervalId);
          set({ time: maxTime, isRunning: false, intervalId: null });
        }
      } else {
        set({ time: newTime });
      }
    }, 1000 / useTimerStore.getState().fps);
    set({ isRunning: true, intervalId });
  },
  stopTimer: () => {
    const { intervalId } = useTimerStore.getState();
    if (intervalId) clearInterval(intervalId);
    set({ isRunning: false, intervalId: null });
  },
  resetTimer: () => {
    const { intervalId } = useTimerStore.getState();
    if (intervalId) clearInterval(intervalId);
    set({ time: 0, isRunning: false, intervalId: null });
  },
}));

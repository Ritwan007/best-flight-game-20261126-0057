// missions.js — the three ways to fly Ridge Valley, and the scoring rules that
// turn a sortie into decisions: rings, landings, fuel and the clock.
export const MISSIONS = {
  rings: {
    id: 'rings',
    title: 'RING COURSE',
    sub: 'Fly through all 8 rings in order',
    briefing: 'Thread all 8 rings in order. Each ring is 150 points, a clean run pays a time bonus.',
    ringPoints: 150,
    start: { x: 0, y: 42, z: 330, heading: 0, speed: 42, throttle: 0.62 },
  },
  canyon: {
    id: 'canyon',
    title: 'CANYON RUN',
    sub: 'Stay low through the river gorge — fast and close',
    briefing: 'Scream down the river gorge under 120 ft. Every 5 seconds below the ceiling is 40 points. Climb out and the meter stops.',
    ringPoints: 0,
    start: { x: -560, y: 46, z: 700, heading: 0, speed: 55, throttle: 0.8 },
  },
  landing: {
    id: 'landing',
    title: 'LANDING CHALLENGE',
    sub: 'Three gentle touchdowns on runway 27',
    briefing: 'Land on runway 27 three times. A gentle touchdown (slow, level, gear down) scores up to 300 points and refuels you.',
    ringPoints: 0,
    start: { x: 0, y: 190, z: 900, heading: 0, speed: 48, throttle: 0.5 },
  },
};

export function createMissionRun(missionId) {
  const def = MISSIONS[missionId] || MISSIONS.rings;
  return {
    def,
    nextRing: 0,
    ringsHit: 0,
    landings: 0,
    lowTime: 0,
    lowStreak: 0,
    score: 0,
    elapsed: 0,
    finished: false,
    finishReason: '',
    addRingPoints() {
      this.ringsHit++;
      this.nextRing++;
      this.score += def.ringPoints;
      if (this.ringsHit >= 8) this.finish('COURSE COMPLETE');
    },
    addLandingPoints(quality01) {
      this.landings++;
      const pts = Math.round(120 + quality01 * 180);
      this.score += pts;
      if (this.def.id === 'landing' && this.landings >= 3) this.finish('THREE LANDINGS — CHALLENGE COMPLETE');
      return pts;
    },
    addLowTime(dt) {
      this.lowStreak += dt;
      this.lowTime += dt;
      if (this.lowStreak >= 5) {
        this.score += 40;
        this.lowStreak = 0;
        return 40;
      }
      return 0;
    },
    breakLowStreak() { this.lowStreak = 0; },
    timeBonus() {
      // A fast clean ring course pays up to 400 extra points.
      if (this.def.id !== 'rings' || this.ringsHit < 8) return 0;
      return Math.max(0, Math.round(400 - this.elapsed * 2));
    },
    finish(reason) {
      if (this.finished) return;
      this.finished = true;
      this.finishReason = reason;
      this.score += this.timeBonus();
    },
    scoreText() {
      if (this.def.id === 'rings') return 'RINGS ' + this.ringsHit + ' / 8 · SCORE ' + this.score;
      if (this.def.id === 'canyon') return 'LOW TIME ' + this.lowTime.toFixed(0) + 's · SCORE ' + this.score;
      return 'LANDINGS ' + this.landings + ' / 3 · SCORE ' + this.score;
    },
  };
}

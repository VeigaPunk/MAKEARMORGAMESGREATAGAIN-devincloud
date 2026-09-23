/** Deterministic 120 Hz runner. Rendering and audio never affect collision. */
export const DT = 1 / 120, SPEED = 360, GRAV = 2600, JUMP_V = 880;
export const CUBE = 34, GROUND_Y = 430, LEVEL_END = 9900;
export type Obstacle = [type: 'gap' | 'spike' | 'block', x: number, w: number, h?: number];
export const LEVEL: Obstacle[] = [
  ['gap',1400,130], ['spike',1900,40], ['spike',2400,40], ['spike',2440,40],
  ['block',3000,120,70], ['spike',3400,40], ['gap',3900,170], ['block',4400,90,110],
  ['spike',5000,40], ['spike',5040,40], ['spike',5080,40], ['block',5600,200,50],
  ['spike',5650,40], ['gap',6300,150], ['spike',6900,40], ['block',7100,100,90],
  ['spike',7300,40], ['gap',7800,200], ['spike',8500,40], ['spike',8540,40],
  ['block',9100,140,60], ['spike',9400,40],
];
export const CHECKPOINTS = [1800, 3300, 4800, 6200, 8300];
export interface Course { name: string; subtitle: string; obstacles: Obstacle[]; end: number; checkpoints: number[]; sky: string; horizon: string }
// Later courses reuse the game's small vocabulary in deliberately different
// rhythms: long pit transfers, platform landings, and three-jump phrases.
export const COURSES: Course[] = [
  { name: 'First Light', subtitle: 'Learn the rhythm', obstacles: LEVEL, end: LEVEL_END, checkpoints: CHECKPOINTS, sky: '#f5efdf', horizon: '#c9bea6' },
  { name: 'Cold Front', subtitle: 'Keep your composure', end: 12600, checkpoints: [2600,4700,6800,8900,11000], sky:'#e2eef0', horizon:'#9badb9', obstacles: [
    ['gap',1000,170],['spike',1450,40],['spike',1490,40],['block',2000,90,110],
    ['spike',3100,40],['block',3300,100,90],['spike',3500,40],
    ['gap',4100,200],['block',5200,200,50],['spike',5250,40],
    ['spike',5900,40],['spike',5940,40],['spike',5980,40],['gap',6500,170],
    ['spike',7500,40],['block',7700,100,90],['spike',7900,40],
    ['gap',8500,200],['block',9600,90,110],['spike',10000,40],['spike',10040,40],
    ['spike',11400,40],['block',11600,100,90],['spike',11800,40],
  ] },
  { name: 'Last Ember', subtitle: 'Make every landing count', end: 14700, checkpoints: [2800,5000,7500,10100,12400], sky:'#f1ded8', horizon:'#be9e99', obstacles: [
    ['spike',1200,40],['block',1400,100,90],['spike',1600,40],['gap',2300,200],
    ['block',3300,90,110],['spike',3700,40],['spike',3740,40],['gap',4300,200],
    ['spike',5500,40],['block',5700,100,90],['spike',5900,40],
    ['spike',6500,40],['block',6700,100,90],['spike',6900,40],
    ['gap',8000,200],['block',8700,200,50],['spike',8750,40],
    ['spike',9400,40],['spike',9440,40],['spike',9480,40],
    ['spike',10800,40],['block',11000,100,90],['spike',11200,40],['gap',11900,200],
    ['block',12900,90,110],['spike',13400,40],['block',13600,100,90],['spike',13800,40],
  ] },
];
export class Runner {
  courseIndex = 0;
  get course(): Course { return COURSES[this.courseIndex]; }
  x = 0; y = GROUND_Y - CUBE; vy = 0; grounded = true; rot = 0;
  state: 'running' | 'dead' | 'clear' = 'running';
  attempt = 1; deaths = 0; checkpoint = 0; time = 0;
  jumpBuffer = 0; coyote = 0; deadTime = 0;
  practice = false;
  reset(full = false): void {
    if (full) { this.attempt = 0; this.deaths = 0; this.checkpoint = 0; }
    this.attempt++; this.x = this.practice ? this.checkpoint : 0;
    this.y = GROUND_Y - CUBE; this.vy = 0; this.grounded = true; this.rot = 0;
    this.jumpBuffer = this.coyote = this.deadTime = 0; this.time = this.x / SPEED;
    this.state = 'running';
  }
  jump(): void { this.jumpBuffer = .1; }
  die(): void { this.state = 'dead'; this.deadTime = 0; this.deaths++; }
  floorAt(x: number): number {
    let floor = GROUND_Y;
    for (const [kind, ox, w, h] of this.course.obstacles) {
      if (kind === 'block' && x + CUBE / 2 > ox && x - CUBE / 2 < ox + w) {
        floor = Math.min(floor, GROUND_Y - h!);
        continue;
      }
      if (x < ox || x > ox + w) continue;
      if (kind === 'gap') floor = -Infinity;
      if (kind === 'block') floor = Math.min(floor, GROUND_Y - h!);
    }
    return floor;
  }
  step(dt = DT): 'jump' | 'death' | 'clear' | 'land' | undefined {
    if (this.state === 'dead') { this.deadTime += dt; if (this.deadTime >= .16) this.reset(); return; }
    if (this.state === 'clear') return;
    this.time += dt; this.x += SPEED * dt;
    const floor = this.floorAt(this.x + CUBE / 2);
    let event: 'jump' | 'land' | undefined;
    if (this.grounded) {
      if (floor === -Infinity || this.y + CUBE < floor - 1) { this.grounded = false; this.coyote = .06; }
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      const prevBottom = this.y + CUBE;
      this.vy += GRAV * dt; this.y += this.vy * dt;
      if (floor > -Infinity && this.vy >= 0 && prevBottom <= floor + 2 && this.y + CUBE >= floor) {
        this.y = floor - CUBE; this.vy = 0; this.grounded = true;
        this.rot = Math.round(this.rot / (Math.PI / 2)) * Math.PI / 2; event = 'land';
      }
    }
    if (!this.grounded) this.rot += dt * 4.2;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = -JUMP_V; this.grounded = false; this.coyote = this.jumpBuffer = 0; event = 'jump';
    }
    for (const [kind, ox, w, h] of this.course.obstacles) {
      const hit = kind === 'spike'
        ? this.x + CUBE / 2 > ox + 4 && this.x + CUBE / 2 < ox + w - 4 && this.y + CUBE > GROUND_Y - 26
        : kind === 'block' && this.x + CUBE > ox && this.x < ox + w && this.y + CUBE > GROUND_Y - h! + 2 && this.y < GROUND_Y;
      if (hit) { this.die(); return 'death'; }
    }
    if (floor === -Infinity && this.y + CUBE > GROUND_Y + 8) { this.die(); return 'death'; }
    if (this.practice && this.grounded) for (const cp of this.course.checkpoints) if (this.x >= cp) this.checkpoint = cp;
    if (this.x >= this.course.end) { this.state = 'clear'; return 'clear'; }
    return event;
  }
}

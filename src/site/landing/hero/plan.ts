// Where the words go on the approved hero (hero-1536.png), in that image's pixels. The clean plates in
// public/site/hero-*.{avif,webp} are crops of the same image with every painted label removed; the build sets these
// words over them as HTML. Tiles dated after Fri Oct 16 are scheduled work, so they carry a clock, not a check.

export type Crop = { x: number; y: number; w: number; h: number }
export const crops = {
  desk: { x: 0, y: 228, w: 1536, h: 796 },
  planner: { x: 330, y: 300, w: 920, h: 500 },
  phone: { x: 835, y: 485, w: 405, h: 315 },
} satisfies Record<string, Crop>

export type Tile = { label: string; x: number; y: number; w: number; h: number; state: 'done' | 'scheduled'; rot?: number; size?: number; plain?: boolean }

export const tiles: Tile[] = [
  { label: 'Rivera LLC', x: 491, y: 447, w: 96, h: 32, state: 'done' },
  { label: 'Oak & Iron', x: 614, y: 447, w: 97, h: 34, state: 'done' },
  { label: 'Chen', x: 734, y: 448, w: 67, h: 32, state: 'done' },
  { label: 'Patel 1120-S', x: 852, y: 447, w: 104, h: 33, state: 'done' },
  { label: 'Nguyen 1040', x: 978, y: 448, w: 108, h: 32, state: 'done' },
  { label: 'Harbor Taco', x: 491, y: 533, w: 101, h: 35, state: 'done' },
  { label: 'Wilson 1065', x: 612, y: 536, w: 103, h: 32, state: 'done' },
  { label: 'Garcia 1040', x: 734, y: 536, w: 97, h: 31, state: 'done' },
  { label: 'All accepted', x: 977, y: 535, w: 112, h: 40, state: 'done', size: 18 },
  { label: 'Khan 1040', x: 495, y: 623, w: 98, h: 38, state: 'scheduled' },
  { label: 'Lopez 1120-S', x: 614, y: 628, w: 101, h: 32, state: 'scheduled' },
  { label: 'O’Neil 1065', x: 734, y: 627, w: 102, h: 34, state: 'scheduled' },
  { label: 'Singh 1040', x: 856, y: 627, w: 100, h: 34, state: 'scheduled' },
  { label: 'Davis 1040', x: 977, y: 627, w: 109, h: 35, state: 'scheduled' },
  { label: 'Martinez 1040', x: 498, y: 736, w: 103, h: 34, state: 'scheduled' },
  { label: 'Brown 1120-S', x: 614, y: 719, w: 104, h: 38, state: 'scheduled' },
  { label: 'Kim 1065', x: 737, y: 721, w: 97, h: 35, state: 'scheduled' },
  { label: 'Adams 1040', x: 855, y: 725, w: 101, h: 34, state: 'scheduled' },
  { label: 'Tran 1040', x: 974, y: 724, w: 83, h: 34, state: 'scheduled' },
  { label: 'Q3 941', x: 1114, y: 722, w: 66, h: 34, state: 'scheduled' },
  { label: '→ Nov 2', x: 1109, y: 751, w: 74, h: 30, state: 'scheduled', plain: true },
  // the two strips the staff are carrying to their days
  { label: 'Ortiz 1040', x: 497, y: 669, w: 94, h: 36, state: 'scheduled', rot: -8 },
  { label: 'Park', x: 1013, y: 683, w: 62, h: 30, state: 'scheduled', rot: 17, size: 12 },
]

/** Day numbers visible on the planner (11, 18, 25 and 26 sit behind the staff and their ladders). */
export const days: [number, number, number][] = [
  [4, 386, 424], [5, 495, 424], [6, 616, 423], [7, 736, 423], [8, 856, 423], [9, 981, 423], [10, 1106, 423],
  [12, 491, 510], [13, 615, 510], [14, 735, 510], [16, 981, 510], [17, 1106, 510],
  [19, 490, 601], [20, 614, 601], [21, 734, 601], [22, 854, 601], [23, 979, 602], [24, 1108, 601],
  [27, 614, 694], [28, 736, 694], [29, 854, 694], [30, 977, 694], [31, 1118, 694],
]

export const weekdays: [string, number][] = [['Sun', 428], ['Mon', 541], ['Tue', 661], ['Wed', 781], ['Thu', 903], ['Fri', 1028], ['Sat', 1150]]

/** The five record cards, where the drawing places them. */
export const cardBoxes = {
  extended: { x: 76, y: 251, w: 253, h: 133 },
  chen: { x: 48, y: 388, w: 279, h: 138 },
  signature: { x: 44, y: 531, w: 290, h: 140 },
  payroll: { x: 1241, y: 282, w: 261, h: 110 },
  week: { x: 1241, y: 394, w: 268, h: 102 },
}

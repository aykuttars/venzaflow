/** FDI tooth surface codes used in oral chart. */
export const TOOTH_SURFACES = ['M', 'D', 'B', 'L', 'O'] as const;
export type ToothSurface = (typeof TOOTH_SURFACES)[number];

export const SURFACE_LABELS: Record<ToothSurface, string> = {
  M: 'Mesial',
  D: 'Distal',
  B: 'Bukkal',
  L: 'Lingual',
  O: 'Oklüzal',
};

/** Map procedure category / tooth condition to custom cursor class. */
export function cursorClassForProcedure(category: string, condition?: string): string {
  if (condition === 'missing' || condition === 'extraction_planned') return 'cursor-extract';
  if (condition === 'root_canal') return 'cursor-root-canal';
  if (condition === 'crown' || condition === 'bridge') return 'cursor-crown';
  if (condition === 'implant') return 'cursor-implant';
  if (category === 'diagnosis') return 'cursor-exam';
  if (category === 'planning') return 'cursor-plan';
  return 'cursor-fill';
}

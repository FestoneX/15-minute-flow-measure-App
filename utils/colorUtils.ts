export const getContrastColor = (hexColor: string): string => {
    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // YIQ equation
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    // Returns black or white based on brightness
    return yiq >= 128 ? '#000000' : '#ffffff';
};

export const isDarkColor = (hexColor: string): boolean => {
    return getContrastColor(hexColor) === '#ffffff';
};

// Calculate luminance for WCAG compliance
export function calculateLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Color interpolation for smooth gradients
export function interpolateColors(color1: string, color2: string, factor: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);

  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Get circadian color for current time
export function getCircadianColor(hour: number): string {
  // Import constants at runtime to avoid circular dependency
  const CIRCADIAN_TIME_MAP = [
    { start: 0, end: 6, color: '#22223B' },
    { start: 6, end: 10, from: '#4A4E69', to: '#9A8C98' },
    { start: 10, end: 14, color: '#9A8C98' },
    { start: 14, end: 17, color: '#C9ADA7' },
    { start: 17, end: 20, color: '#F2E9E4' },
    { start: 20, end: 24, from: '#F2E9E4', to: '#22223B' }
  ];

  const mapping = CIRCADIAN_TIME_MAP.find(m => hour >= m.start && hour < m.end);
  if (!mapping) return '#22223B'; // Default to space grey

  // If solid color, return it
  if ('color' in mapping && mapping.color) {
    return mapping.color;
  }

  // If gradient, interpolate based on position in time range
  if ('from' in mapping && 'to' in mapping && mapping.from && mapping.to) {
    const rangeProgress = (hour - mapping.start) / (mapping.end - mapping.start);
    return interpolateColors(mapping.from, mapping.to, rangeProgress);
  }

  return '#22223B'; // Fallback
}

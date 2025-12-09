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

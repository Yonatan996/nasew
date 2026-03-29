module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx,html}", // Include all React components
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ['"Playfair Display"', 'serif'],
        bebas: ['"Bebas Neue"', 'sans-serif'],
        Dosis: ['"Dosis"', 'serif'],
        permanentMarker: ['"Permanent Marker"', 'cursive'],
      },
    }, // Customize your theme here
  },
  plugins: [], // Add Tailwind plugins if needed
};

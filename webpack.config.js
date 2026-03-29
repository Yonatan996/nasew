const path = require('path');
const webpack = require('webpack'); // Import webpack

module.exports = {
  mode: 'development', // or 'production'
  entry: './src/index.js', // Adjust to your actual entry point
  output: {
    path: path.resolve(__dirname, 'dist'), // Output directory
    filename: 'bundle.js', // Output file name
  },
  resolve: {
    fallback: {
      fs: false, // Disable fs module
      path: require.resolve('path-browserify'), // Polyfill path
      buffer: require.resolve('buffer/'), // Polyfill buffer if needed
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'], // Provide Buffer globally if needed
    }),
  ],
  module: {
    rules: [
      {
        test: /\.jsx?$/, // Transpile .js and .jsx files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader', // Use Babel for transpiling
        },
      },
      {
        test: /\.css$/, // Handle CSS files
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  devtool: 'source-map', // Optional: For debugging
};

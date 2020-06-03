const path = require('path');

// Get the mode from the argv array.
module.exports = (env, argv) => {
  return {
    // 📖 -> https://webpack.js.org/configuration/entry-context/
    entry: path.resolve(__dirname, './model.ts'),
    // the bundle is stored in the 'html' folder.
    // 📖 -> https://webpack.js.org/configuration/output/
    output: {
      filename: 'index.js',
      path: path.resolve(__dirname, 'out'),
      publicPath: './'
    },
    devtool: 'source-map',
    resolve: {
      // 📖 -> https://github.com/TypeStrong/ts-loader
      extensions: ['.tsx', '.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            configFile: path.resolve(__dirname, './tsconfig.json')
          },
        },
      ]
    }
  }
}

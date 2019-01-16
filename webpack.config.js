const path = require('path');

module.exports = {
  entry: './webview-src/main.ts',
  mode: "development",
  externals: {
    },
  resolve: {
    modules: ['node_modules']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          experimentalWatchApi: true,
          configFile: 'webview-src/tsconfig.json'
        },
        exclude: /node_modules/
      },
    ]
  },
  watchOptions: {
    aggregateTimeout: 200,
    poll: 500,
    ignored: /node_modules/
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'html')
  },
};
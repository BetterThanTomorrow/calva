const path = require('path');

const CALVA_MAIN = {
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  entry: './calva/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
}

const REPL_WINDOW = {
  entry: './webview-src/server/main.ts',
  performance: {
    maxEntrypointSize: 1024000,
    maxAssetSize: 1024000,
  },
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
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'dart-sass-loader']
      },
      {
        test: /\.(eot|woff|woff2|ttf|svg|png|jpg)$/,
        loader: 'url-loader',
        options: {
          emitFile: false
        }
      }
    ]
  },
  watchOptions: {
    aggregateTimeout: 200,
    poll: 500,
    ignored: /node_modules/
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'html')
  },
  devServer: {
    historyApiFallback: true,
    host: "0.0.0.0",
    compress: true,
    contentBase: path.join(__dirname, 'html'),
    proxy: {
      '/api': 'http://localhost:3000',
    }
  },
  devtool: 'source-map'
}

let configs = [REPL_WINDOW];
if (!(process.env.IS_DEV_BUILD == "YES")) {
  configs.unshift(CALVA_MAIN);
}

module.exports = configs;
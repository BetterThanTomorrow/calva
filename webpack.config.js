const path = require('path');

const CALVA_MAIN = {
  // vscode extensions run in a Node.js-context 
  // 📖 -> https://webpack.js.org/configuration/node/
  target: 'node', 
  // the entry point of this extension, 
  // 📖 -> https://webpack.js.org/configuration/entry-context/
  entry: path.resolve(__dirname, 'calva/extension.ts'), 
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 
    // 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  externals: {
    // the vscode-module is created on-the-fly and must be excluded. 
    // Add other modules that cannot be webpack'ed, 
    // 📖 -> https://webpack.js.org/configuration/externals/
    vscode: 'commonjs vscode'
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 
    // 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
  },
  // Watch options for the webview. 
  // 📖 -> https://webpack.js.org/configuration/watch/
  watchOptions: {
    aggregateTimeout: 200,
    poll: 500,
    ignored: /node_modules/
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: 'ts-loader',
        options: {
          configFile: path.resolve(__dirname, 'tsconfig.json')
        }
      }
    ]
  }
}

const REPL_WINDOW = {
  // vscode extensions run in a Node.js-context 
  // 📖 -> https://webpack.js.org/configuration/node/
  target: 'node', 
  // the entry point of this webview, 
  // 📖 -> https://webpack.js.org/configuration/entry-context/
  entry: path.resolve(__dirname, 'calva/webview.ts'),
  // the bundle is stored in the 'html' folder. 
  // 📖 -> https://webpack.js.org/configuration/output/
  output: {
    filename: 'webview.js',
    path: path.resolve(__dirname, 'out'),
    publicPath: './'
  },
  // Webpack dev server settings.
  // 📖 -> https://webpack.js.org/configuration/dev-server/
  devServer: {
    historyApiFallback: true,
    host: "0.0.0.0",
    compress: true,
    contentBase: path.join(__dirname, 'out'),
    proxy: {
      '/api': 'http://localhost:3000',
    }
  },
  devtool: 'source-map',
  resolve: {
    // support reading TypeScript and JavaScript files, 
    // 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.tsx', '.ts', '.js']
  },
  performance: {
    // These options allows you to control how webpack notifies you 
    // of assets and entry points that exceed a specific file limit.
    // 📖 -> https://webpack.js.org/configuration/performance/
    maxEntrypointSize: 1024000,
    maxAssetSize: 1024000,
  },
  // Watch options for the webview. 
  // 📖 -> https://webpack.js.org/configuration/watch/
  watchOptions: {
    aggregateTimeout: 200,
    poll: 500,
    ignored: /node_modules/
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          experimentalWatchApi: true,
          configFile: path.resolve(__dirname, 'calva/webview/tsconfig.json')
        },
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
  }
}

// Build the configuration based on production
// or development mode. The extenion is only 
// webpacked for production.
function buildConfig(isProduction) {
  if(!isProduction) {
    // if not production set deftool to 
    // 'eval-source-map' to make the webview 
    // debugable in the vscode Webview Development 
    // tools.
    REPL_WINDOW.devtool = "eval-source-map";
  }
  let configs = [REPL_WINDOW];
  if (isProduction) {
    configs.unshift(CALVA_MAIN)
  } 
  //return configs
  return configs
}

// Get the mode from the argv array.
module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production'
  return buildConfig(isProduction)
}

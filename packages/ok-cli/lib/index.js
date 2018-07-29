const path = require('path')
const webpack = require('webpack')
const Koa = require('koa')
const getPort = require('get-port')
const koaWebpack = require('koa-webpack')
const HTMLPlugin = require('mini-html-webpack-plugin')
const ProgressBarPlugin = require('progress-bar-webpack-plugin')
const chalk = require('chalk')

const devMiddleware = {
  publicPath: '/',
  clientLogLevel: 'error',
  stats: 'errors-only',
  logLevel: 'error',
}

const babel = {
  presets: [
    'babel-preset-env',
    'babel-preset-stage-0',
    'babel-preset-react',
  ].map(require.resolve)
}

const rules = [
  {
    test: /\.js$/,
    exclude: /node_modules/,
    loader: require.resolve('babel-loader'),
    options: babel
  },
  {
    test: /\.js$/,
    exclude: path.resolve(__dirname, '../node_modules'),
    include: [
      path.resolve(__dirname, '..'),
    ],
    loader: require.resolve('babel-loader'),
    options: babel
  },
  {
    test: /\.mdx?$/,
    exclude: /node_modules/,
    use: [
      {
        loader: require.resolve('babel-loader'),
        options: babel
      },
      require.resolve('@mdx-js/loader'),
    ]
  }
]

const template = ({
  title = 'ok',
  js,
  publicPath
}) => `<!DOCTYPE html>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<style>*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0}</style>
<title>${title}</title>
<div id=root></div>
${HTMLPlugin.generateJSReferences(js, publicPath)}
`

const baseConfig = {
  stats: 'errors-only',
  mode: 'development',
  module: {
    rules
  },
  resolve: {
    modules: [
      path.relative(process.cwd(), path.join(__dirname, '../node_modules')),
      'node_modules'
    ]
  },
  plugins: [
    new ProgressBarPlugin({
      width: '24',
      complete: '█',
      incomplete: chalk.gray('░'),
      format: [
        chalk.magenta('[ok] :bar'),
        chalk.magenta(':percent'),
        chalk.gray(':elapseds :msg'),
      ].join(' '),
      summary: false,
      customSummary: () => {},
    })
  ]
}

const createConfig = (opts = {}) => {
  const dirname = opts.dirname || path.dirname(opts.entry)
  baseConfig.context = dirname

  baseConfig.resolve.modules.push(
    dirname,
    path.join(dirname, 'node_modules')
  )

  baseConfig.entry = [
    path.join(__dirname, './entry.js')
  ]

  const defs = Object.assign({}, opts.globals, {
    OPTIONS: JSON.stringify(opts),
    APP_FILENAME: JSON.stringify(opts.entry),
    HOT_PORT: JSON.stringify(opts.hotPort)
  })

  baseConfig.plugins.push(
    new webpack.DefinePlugin(defs),
    new HTMLPlugin({ template, context: opts })
  )

  const config = typeof opts.config === 'function'
    ? opts.config(baseConfig)
    : baseConfig

  if (config.resolve.alias) {
    const hotAlias = config.resolve.alias['webpack-hot-client/client']
    if (!fs.existsSync(hotAlias)) {
      const hotPath = path.dirname(require.resolve('webpack-hot-client/client'))
      config.resolve.alias['webpack-hot-client/client'] = hotPath
    }
  }

  return config
}

const start = async (opts = {}) => {
  const app = new Koa()
  opts.hotPort = await getPort()
  const hotClient = {
    port: opts.hotPort,
    logLevel: 'error'
  }
  const config = createConfig(opts)
  config.entry.push(
    path.join(__dirname, './overlay.js'),
  )

  const middleware = await koaWebpack({
    config,
    devMiddleware,
    hotClient
  })
  const port = opts.port || await getPort()
  app.use(middleware)

  const server = app.listen(port)
  return new Promise((resolve) => {
    middleware.devMiddleware.waitUntilValid(() => {
      resolve({ server, app, middleware, port })
    })
  })
}

module.exports = start
module.exports.config = baseConfig
module.exports.createConfig = createConfig

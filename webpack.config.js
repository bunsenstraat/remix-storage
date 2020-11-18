const path = require('path');
const IPFS = require('ipfs')

console.clear();


module.exports = {
  entry: './src/index.js',
  mode: 'development',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.html$/,
        loader: 'mustache-loader'
        // loader: 'mustache-loader?minify'
        // loader: 'mustache-loader?{ minify: { removeComments: false } }'
        // loader: 'mustache-loader?noShortcut'
      } 
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: '3boxapp.js',
    path: path.resolve(__dirname, 'dist')
  },
  externals: {
    jquery: 'jQuery'
  },
  node :{
    setImmediate: false
  }
}
const path =require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackPugPlugin = require("html-webpack-pug-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { webpack } = require("webpack");

const config = {
  mode: "production",
  target: "web",
  entry: ["@babel/polyfill", path.resolve(__dirname, "./src/index.js")],
  module: {
    rules: [
      {
        test: /\.pug$/,
        use: "pug-loader"
      },
      {
        test: /\.js$/,
        exclude: /node_module/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"]
            }
          }
        ]
      },
      {
        test: /\.s[ac]ss$/,
        use: ["style-loader", "css-loader", "sass-loader"]
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        loader: "url-loader",
        options: {
          name: "[hash].[ext]",
          limit: 10240,
          outputPath: "imgs"
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf|)$/,
        loader: "file-loader",
        options: {
          name: "[hash].[ext]",
          outputPath: "fonts"
        }
      }
    ]
  },
  output: {
    filename: "[name].[hash:8].js",
    path: path.resolve(__dirname, "./dist")
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "./src/index.pug"),
      filename: "index.html",
      minify: false
    }),
    new HtmlWebpackPugPlugin({ adjustIndent: true }),
    new CleanWebpackPlugin()
  ]
};

module.exports = config;
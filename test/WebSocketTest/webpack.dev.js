let config = require("./webpack.config");
config.mode = "development";
config.devServer = {
  port: "3300",
  host: "127.0.0.1",
  hot: true,
  open: true
};
module.exports = config;
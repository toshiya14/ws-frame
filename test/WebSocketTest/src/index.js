import wsframe from "../../../ws-frame";

const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get("uid") || "2";

var wsc = new wsframe({
  server: "ws://127.0.0.1:6089/test",
  debugLog: true,
  reconnect: true,
  sendPing: true,
  sendPingPeriod: 30000,
  reconnectDelay: 5000
});

wsc.on("connected", (e) => {
  console.trace("EVENT connected triggerd", e);
  wsc.send(JSON.stringify({ uid: uid }));
  document.getElementById("submit").disabled = false;
});

wsc.on("received", (e) => {
  console.trace("EVENT received triggered", e);
  var data = JSON.parse(e.payload);
  var wrap = document.querySelector("table .table-content");
  var node = document.createElement("tr");
  var n_code = document.createElement("td");
  var n_msg = document.createElement("td");
  n_code.innerHTML = data.code;
  n_msg.innerHTML = data.reply;
  node.appendChild(n_code);
  node.appendChild(n_msg);
  wrap.appendChild(node);
});

wsc.on("lost", (e) => {
  console.trace("EVENT lost triggered", e);
});

wsc.on("reconnected", (e) => {
  console.trace("EVENT reconnected triggered", e);
});

wsc.on("timeout", (e) => {
  console.trace("EVENT timeout triggered", e);
});

wsc.on("inited", (e) => {
  console.trace("EVENT inited triggered", e);
});

wsc.on("closed", (e) => {
  console.trace("EVENT closed triggered", e);
});

wsc.on("try-to-reconnect", (e) => {
  console.trace("EVENT try-to-reconnect triggered", e);
});

wsc.open();

document.getElementById("submit").addEventListener("click", () => {
  var text = document.getElementById("msg").value;
  wsc.send(text);
});

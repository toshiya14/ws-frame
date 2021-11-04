import EventHandler from "./events";

const EVT_LOST = "lost";
const EVT_INITED = "inited";
const EVT_CLOSED = "closed";
const EVT_TIMEOUT = "timeout";
const EVT_RECEIVED = "received";
const EVT_CONNECTED = "connected";
const EVT_RECONNECTED = "reconnected";
const EVT_TRYTORECONNECT = "try-to-reconnect";
const CON_STATE_LOST = "lost";
const CON_STATE_CLOSED = "closed";
const CON_STATE_TIMEOUT = "timeout";
const CON_STATE_CONNECTED = "connected";
const CON_STATE_NOTCONNECT = "not-connect";
const CON_STATE_RECONNECTING = "reconnecting";
const CON_STATE_RECONNECTED = "reconnected";
const LNE_STATE_ONLINE = "online";
const LNE_STATE_OFFLINE = "offline";
const TYPE_FUNCTION = "function";

let ton_SendPingTask, ton_ConnectionTimeout, ton_Reconnect;
let manuallyClose = false;

export default function (options) {
  let _opt = Object.assign(
    {
      debugLog: false,
      connectTimeout: 5000,
      reconnect: true,
      reconnectDelay: 5000,
      sendPing: true,
      sendPingPeriod: 29999,
      pingPongTimeout: 10000,
      generatePingPack: () => "ping",
      isPongChecking: (msg) => msg === "pong",
      pongNotFireReceive: true
    },
    options
  );
  this.$options = _opt;
  this.$props = {
    onlineState: LNE_STATE_OFFLINE,
    connectState: CON_STATE_NOTCONNECT,
    lastPingTime: undefined,
    lastPongTime: undefined,
    inited: false
  };
  this.$evt = new EventHandler();

  let debugStageLog = (stage, data) => {
    if (this.$options.debugLog) {
      console.info(" ***** DEBUG LOG | STAGE : [" + stage + "] *****");
      if (data && Array.isArray(data)) {
        data.forEach((d) => {
          console.log("       " + d);
        });
        console.log(" ********************************************** ");
      }
    }
  };

  let sendPingTask = () => {
    // If there is a planned task, clear it.
    if (ton_SendPingTask) {
      stopSendPing();
    }

    debugStageLog("prepare send ping", [`readyState:${this.$wsc.readyState}`, `onlineState:${this.$props.onlineState}`, `sendPing:${this.$options.sendPing}`]);
    if (this.$wsc && this.$wsc.readyState === 1 && this.$props.onlineState === LNE_STATE_ONLINE) {
      if (this.$options.sendPing && typeof this.$options.generatePingPack === TYPE_FUNCTION) {
        let pingPack = this.$options.generatePingPack();
        this.$wsc.send(pingPack);
        this.$props.lastPingTime = new Date();
        debugStageLog("sendPing", [`lastPingTime:${this.$props.lastPingTime.toLocaleString()}`]);
      }
    }
    ton_SendPingTask = setTimeout(sendPingTask, this.$options.sendPingPeriod);
  };

  let stopSendPing = () => {
    clearTimeout(ton_SendPingTask);
  };

  let connectionCheckingTask = () => {
    if (!this.$options.sendPing) {
      return; // if not send ping, do not check connection delay.
    }

    if (this.$wsc && this.$wsc.readyState === 1 && this.$props.onlineState === LNE_STATE_ONLINE) {
      let lastPingTime = this.$props.lastPingTime;
      let lastPongTime = this.$props.lastPongTime;
      let currentTime = new Date();

      // not sent ping yet.
      if (!lastPingTime) {
        return; // not sent ping yet, do not check state.
      }

      // stand-by phase.
      if (lastPingTime < lastPongTime) {
        return; // Connection is alive.
      }

      // ping sent, but not receive pong.
      else {
        let deltaTime = currentTime - lastPingTime;
        if (deltaTime >= this.$options.pingPongTimeout) {
          this.$props.connectState = CON_STATE_LOST;
          this.$props.onlineState = LNE_STATE_OFFLINE;
          this.$wsc.close(); // Bad-communication.
          debugStageLog("badCommunicationDetected");
          // `lost` event would be triggered.
          this.$evt.fire(EVT_LOST, {
            wsc: this.$wsc
          });
        }
      }
    }

    setTimeout(connectionCheckingTask, 2500);
  };

  let onWebSocketReconnect = () => {
    // if a reconnect task is scheduled, skip.
    if (ton_Reconnect != null) {
      return;
    }

    // `try-to-reconnect` event would be triggered.
    this.$evt.fire(EVT_TRYTORECONNECT, {
      wsc: this.$wsc,
      delay: this.$options.reconnectDelay
    });
    debugStageLog("tryToReconnect");

    if (ton_ConnectionTimeout) {
      clearTimeout(ton_ConnectionTimeout);
      ton_ConnectionTimeout = null;
    }

    if (ton_Reconnect) {
      clearTimeout(ton_Reconnect);
    }
    ton_Reconnect = setTimeout(initWebSocket, this.$options.reconnectDelay);
  };

  let initWebSocket = () => {
    // clear timeout
    if (ton_Reconnect) {
      clearTimeout(ton_Reconnect);
      ton_Reconnect = null;
    }

    if (ton_ConnectionTimeout) {
      clearTimeout(ton_ConnectionTimeout);
      ton_ConnectionTimeout = null;
    }
    // clear timer
    this.$props.lastPingTime = null;
    this.$props.lastPongTime = null;

    if ("WebSocket" in window) {
      if (this.$options.server) {
        try {
          debugStageLog("initWebSocket");

          this.$wsc = new WebSocket(this.$options.server);

          // if the connection timeout.
          ton_ConnectionTimeout = setTimeout(() => {
            // if the WebSocket is connected or connecting,
            // close it.
            if (this.$wsc && (this.$wsc.readyState === 0 || this.$wsc.readyState === 1)) {
              this.$wsc.close();
            }
            this.$wsc = null;
            this.$props.connectState = CON_STATE_TIMEOUT;
            this.$props.onlineState = LNE_STATE_OFFLINE;

            // `timeout` event would be triggered.
            // if the connection open failed.
            this.$evt.fire(EVT_TIMEOUT, {
              server: this.$options.server,
              wsc: this.$wsc
            });

            // Performs a delayed reconnection.
            if (this.$options.reconnect) {
              onWebSocketReconnect();
            }
            debugStageLog("WebSocketClient timeout");
          }, this.$options.connectTimeout);

          // Bind event to `open` for `WebSocketClient`.
          this.$wsc.onopen = () => {
            // readyState check.
            // the readyState currently could be only 1.
            if (this.$wsc.readyState !== 1) {
              console.error(" *** WebSocketClient State is invalid. ***");
              this.$wsc = null;
              this.$props.connectState = CON_STATE_CLOSED;
              this.$props.onlineState = LNE_STATE_OFFLINE;
              debugStageLog("WebSocketClient not valid.");
              return;
            }

            // clear the connection timeout counter.
            clearTimeout(ton_ConnectionTimeout);

            console.log("opened and state", this.$props.connectState, this.$props.inited);

            // The first time to connect to the server.
            if (!this.$props.inited) {
              this.$props.connectState = CON_STATE_CONNECTED;
              this.$props.onlineState = LNE_STATE_ONLINE;
              this.$evt.fire(EVT_INITED, {
                server: this.$options.server,
                wsc: this.$wsc
              });
              debugStageLog("WebSocketClient inited");
              this.$props.inited = true;
            }

            // The connection once been lost.
            else {
              this.$props.connectState = CON_STATE_CONNECTED;
              this.$props.onlineState = LNE_STATE_ONLINE;
              this.$evt.fire(EVT_RECONNECTED, {
                server: this.$options.server,
                wsc: this.$wsc
              });
              debugStageLog("WebSocketClient reconnected");
            }

            // `connected` event would be triggered
            // no matter connected or reconnected.
            this.$evt.fire(EVT_CONNECTED, {
              server: this.$options.server,
              wsc: this.$wsc
            });
            debugStageLog("WebSocketClient connected");

            // start to send ping.
            if (this.$options.sendPing) {
              sendPingTask();
            }
          };

          // Bind event to `close` for `WebSocketClient`.
          this.$wsc.onclose = () => {
            // Stop send ping.
            stopSendPing();

            // The connection is not closed manually.
            if (!manuallyClose) {

              // should reconnect automatically.
              if (this.$options.reconnect) {
                // Performs a delayed reconnection.
                onWebSocketReconnect();

                // Set the states.
                this.$props.connectState = CON_STATE_RECONNECTING;
                this.$props.onlineState = LNE_STATE_OFFLINE;
                return;
              }

              // should not reconnect automatically.
              else {
                this.$props.connectState = CON_STATE_LOST;
                this.$props.onlineState = LNE_STATE_OFFLINE;
                return;
              }
            }

            // The connection closed manually.
            else {
              this.$props.connectState = CON_STATE_CLOSED;
              this.$props.onlineState = LNE_STATE_OFFLINE;
              this.$props.inited = false;
              this.manuallyClose = false;

              // `close` event fired.
              this.$evt.fire(EVT_CLOSED, {
                wsc: this.$wsc
              });
            }
          };

          // Bind event to `message` for `WebSocketClient`.
          this.$wsc.onmessage = (evt) => {
            let payload = evt.data;

            // Check if payload is pong
            if (typeof this.$options.isPongChecking === TYPE_FUNCTION) {
              let isPong = this.$options.isPongChecking.call(this, payload);
              if (isPong) {
                this.$props.lastPongTime = new Date();
                if (this.$options.pongNotFireReceive) {
                  return;
                }
              }
            }

            // Raise received event.
            this.$evt.fire(EVT_RECEIVED, { payload: payload, $event: evt });
          };

          // Bind event to `error` for `WebSocketClient`.
          this.$wsc.onerror = (evt) => {
            console.error(" *** WebSocket failed to open. ***");
            console.error("     ", evt);
            console.log("error and state", this.$props.connectState);
            if (this.$props.connectState === "connected") {
              // `lost` event would be triggered.
              this.$evt.fire(EVT_LOST, {
                wsc: this.$wsc
              });
            }
          };
        } catch (err) {
          console.error(" *** WebSocket failed to initialize. ***");
          console.error("     ", err);
        }
      } else {
        console.error(" *** WebSocket failed to initialize. ***");
        console.error("     server could not be empty.");
      }
    } else {
      console.error(" *** WebSocket failed to initialize. ***");
      console.error("     your browser do not support WebSocket. ");
    }
  };

  this.open = initWebSocket;
  this.close = () => {
    if (this.$wsc.readyState === 1) {
      manuallyClose = true;
      this.$wsc.close();
    }
  };
  this.on = this.$evt.on;
  this.off = this.$evt.off;
  this.send = (payload, failedCallback) => {
    if (this.$wsc.readyState === 1) {
      this.$wsc.send(payload);
    } else {
      console.error(" *** WebSocket is not ready. ***");
      if (typeof failedCallback === TYPE_FUNCTION) {
        failedCallback.call(this);
      }
    }
  };

  // auto started tasks.
  connectionCheckingTask();
}

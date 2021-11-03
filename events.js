export default function () {
  let _handlers = {};

  let _registerHandler = (evtname, callback, label) => {
    if (!_handlers) {
      _handlers = {};
    }
    if (!_handlers[evtname]) {
      _handlers[evtname] = [];
    }
    _handlers[evtname].push({
      label: label,
      callback: callback
    });
  }

  let _removeHandler = (evtname, label) => {
    if (_handlers && _handlers[evtname]) {
      if (label) {
        for (let i = 0; i < _handlers[evtname].length; i++) {
          if (_handlers[evtname][i].label === label) {
            _handlers[evtname].splice(i, 1);
            i--;
          }
        }
      } else {
        _handlers[evtname] = [];
      }
    }
  }

  let _dispatchEvent = (evtname, data) => {
    if (_handlers && _handlers[evtname]) {
      for (h of _handlers[evtname]) {
        if (h && h.callback && typeof h.callback === "function") {
          h.callback.call(this, data);
        }
      }
    }
  }

  this.on = _registerHandler;
  this.off = _removeHandler;
  this.fire = _dispatchEvent;
}
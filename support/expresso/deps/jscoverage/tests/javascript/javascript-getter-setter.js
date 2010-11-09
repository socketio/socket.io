var o = {
  _x: 123,
  get x() {
    return this._x;
  },
  set x(value) {
    this._x = value;
  }
};

o = {
  _x: 123,
  get x get_x() {
    return this._x;
  },
  set x set_x(value) {
    this._x = value;
  }
};

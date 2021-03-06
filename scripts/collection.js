'use strict';

var utils = require('./utils');

var Collection = function () {
  this._objs = {};
  this._nextId = 0;
};

Collection.prototype.add = function (obj) {
  var id = this._nextId++;
  this._objs[id] = obj;
  return id;
};

Collection.prototype.remove = function (id) {
  delete this._objs[id];
};

Collection.prototype.empty = function () {
  return utils.empty(this._objs);
};

Collection.prototype.each = function (callback) {
  return utils.each(this._objs, callback);
};

module.exports = Collection;

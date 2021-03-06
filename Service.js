var debug = require('debug')('etcd-spaceport:service');
var EventEmitter = require('events').EventEmitter;

var Service = function(etcd, name, opt) {
    if (!(this instanceof Service)) {
        return new Service(etcd, name, opt);
    }

    var self = this;
    var opt = opt || {};

    self.name = name;
    self.key = name;
    self._ttl = opt.ttl || 5; // default 5 second ttl
    self._started = false;
    self._etcd = etcd;
};

Service.prototype.__proto__ = EventEmitter.prototype;

Service.prototype.stop = function(cb) {
    var self = this;
    debug('stopping %s', self.key);
    self._stopped = true;
    clearTimeout(self._heartbeat);
    self._etcd.delete(self.key, cb);
};

Service.prototype.start = function(opt, cb) {
    var self = this;

    if (self._started) {
        return setImmediate(function() {
            cb(new Error('Service ' + self.name + ' already started'));
        });
    }

    var key = self.key;
    var value = JSON.stringify(opt);
    var heartbeat_interval = self._ttl * 1000 / 2;

    // prevExist false because service should not exist
    self._etcd.set(key, value, { prevExist: false, ttl: self._ttl }, function(err) {
        if (err) {
            // err.code == 105 // already exists
            return cb(err);
        }

        if (self._stopped) {
            return cb();
        }

        debug('started %s', key);
        self._started = true;

        (function heartbeat() {
            debug('heartbeat %s', key);
            // heartbeat
            self._heartbeat = setTimeout(function() {
                // if stopped before first heartbeat
                if (!self._started) {
                    return;
                }
                self._etcd.set(key, value, { ttl: self._ttl }, function(err, body) {
                    if (err) {
                        self._started = false;
                        self.emit('error', err);
                        return;
                    }
                    if (!self._stopped) {
                        heartbeat();
                    }
                });
            }, heartbeat_interval);
        })();

        cb();
    });
};

module.exports = Service;

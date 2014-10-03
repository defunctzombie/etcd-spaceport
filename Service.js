var debug = require('debug')('etcd-spaceport:service');

var Service = function(etcd, name, opt) {
    if (!(this instanceof Service)) {
        return new Service(etcd, name);
    }

    var self = this;
    var opt = opt || {};

    self.name = name;
    self.key = name;
    self._ttl = opt.ttl || 5; // default 5 second ttl
    self._started = false;
    self._etcd = etcd;
};

Service.prototype.stop = function(cb) {
    var self = this;
    debug('stopping %s', self.key);
    clearTimeout(self._heartbeat);
    self._etcd.delete(self.key, cb);
};

Service.prototype.start = function(opt, cb) {
    var self = this;

    if (self._started) {
        cb(new Error('Service ' + self.name + 'already started'));
    }

    var key = self.key;
    var value = JSON.stringify(opt);

    // prevExist false because service should not exist
    self._etcd.set(key, value, { prevExist: false, ttl: self._ttl }, function(err) {
        if (err) {
            // err.code == 105 // already exists
            return cb(err);
        }

        debug('started %s', key);
        self._started = true;

        (function heartbeat() {
            // heartbeat
            self._heartbeat = setTimeout(function() {
                self._etcd.set(key, value, { prevExist: true, ttl: self._ttl }, function(err) {
                    // TODO err?
                });
            }, 2500);
        })();

        cb();
    });
};

module.exports = Service;

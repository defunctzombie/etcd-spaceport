var debug = require('debug')('etcd-spaceport');
var path = require('path');
var EventEmitter = require('events').EventEmitter;
var Etcd = require('etcdjs');
var EtcdWatch = require('etcdjs-watch');

var Service = require('./Service');

var Registry = function(basepath, etcd_hosts) {
    if (!(this instanceof Registry)) {
        return new Registry(basepath, etcd_hosts);
    }

    var self = this;
    self._watcher = undefined;
    self._path = basepath;
    self._etcd = new Etcd(etcd_hosts, {
        refresh: false
    });
};

// create a new service on the registry
Registry.prototype.service = function(name, opt) {
    var self = this;

    var key = path.join(self._path, name);
    var service = Service(self._etcd, key, opt);
    return service;
};

Registry.prototype.destroy = function() {
    var self = this;
    self._etcd.destroy();
};

// start listening for new services at this registry
Registry.prototype.browse = function(cb) {
    var self = this;

    if (self._watcher) {
        return;
    }

    var ev = new EventEmitter();

    var watcher = EtcdWatch(self._etcd, self._path, { recursive: true, dir: true });

    watcher.on('create', function(result) {
        new_service(result.node);
    });

    watcher.on('error', function(err) {
        ev.emit('error', err);
    });

    // initial fetch of the service
    self._etcd.get(self._path, { dir: true }, function(err, result) {
        if (err) {
            ev.emit('error', err);
            return;
        }

        watcher.start();

        if (!result) {
            return;
        }

        var nodes = result.node.nodes;
        if (!nodes) {
            return;
        }

        nodes.forEach(new_service);
    });

    ev.stop = function() {
        watcher.stop();
    };

    return ev;

    function new_service(node) {
        var key = node.key;
        var value = node.value;
        debug('new service %s', key);

        var details = JSON.parse(value);

        var service = new EventEmitter();

        var service_watcher = EtcdWatch(self._etcd, key);
        service_watcher.on('update', function() {
            debug('serivce updated %s', key);
        });

        service_watcher.on('expire', function() {
            debug('serivce expired %s', key);
            service_watcher.stop();
            service.emit('offline');
        });

        service_watcher.on('delete', function() {
            debug('serivce deleted %s', key);
            service_watcher.stop();
            service.emit('offline');
        });

        service_watcher.on('error', function(err) {
            service.emit('error', err);
        });

        service.name = key.replace(self._path, '');
        service.details = details;

        if (service.name[0] == '/') {
            service.name = service.name.slice(1);
        }

        cb(service);
    }
};

module.exports = Registry;

# etcd-spaceport

Service registry leveraging etcd as a backend

#### Create a new Registry

```js
var Registry = require('etcd-registry');

var registry = Registry('/path/to/services' [, '127.0.0.1:4001']);
```

Specify the etcd base keypath. Services will be registered under this path.

#### Listen for new services

```js
registry.browse(function(service) {
    service.name; // 'my-service'

    service.once('offline', function() {
        // service is offline, no longer active
    })
});
```
When a new service is registered, the callback will be called with a service object. Listen for the `offline` event to know when the service goes offline.

#### Register your service

```js
var service = registry.service('my-service');

var details = {
    'any': 'keys',
    'that': 'you want'
};

// start the service
service.start(details, function(err) {
    // started
});

// stop a service sometime later
service.stop(function() {
});
```

Some other process can register services into the registry. When you start a service, you can pass service details which will be available to the browsers. These details are stored as a JSON string as the etcd value for the service key.

If there is already a service running with the same name, the start call will fail with and error.

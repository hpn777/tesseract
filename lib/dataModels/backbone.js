let _ = require('lodash');

// Proxy Backbone class methods to Underscore functions, wrapping the model's
// `attributes` object or collection's `models` array behind the scenes.
//
// collection.filter(function(model) { return model.get('age') > 10 });
// collection.each(this.addView);
//
// `Function#apply` can be slow so we use the method's arg count, if we know it.
var addMethod = function(length, method, attribute) {
  switch (length) {
    case 1: return function() {
      return _[method](this[attribute]);
    };
    case 2: return function(value) {
      return _[method](this[attribute], value);
    };
    case 3: return function(iteratee, context) {
      return _[method](this[attribute], cb(iteratee, this), context);
    };
    case 4: return function(iteratee, defaultVal, context) {
      return _[method](this[attribute], cb(iteratee, this), defaultVal, context);
    };
    default: return function() {
      var args = slice.call(arguments);
      args.unshift(this[attribute]);
      return _[method].apply(_, args);
    };
  }
};
var addUnderscoreMethods = function(Class, methods, attribute) {
  _.each(methods, function(length, method) {
    if (_[method]) Class.prototype[method] = addMethod(length, method, attribute);
  });
};

// Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
var cb = function(iteratee, instance) {
  if (_.isFunction(iteratee)) return iteratee;
  if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
  if (_.isString(iteratee)) return function(model) { return model.get(iteratee); };
  return iteratee;
};
var modelMatcher = function(attrs) {
  var matcher = _.matches(attrs);
  return function(model) {
    return matcher(model.attributes);
  };
};

// Events
// ---------------

// A module that can be mixed in to *any object* in order to provide it with
// a custom event channel. You may bind a callback to an event with `on` or
// remove with `off`; `trigger`-ing an event fires all callbacks in
// succession.
var Events = {};

// Regular expression used to split event strings.
var eventSplitter = /\s+/;

// Iterates over the standard `event, callback` (as well as the fancy multiple
// space-separated events `"change blur", callback` and jQuery-style event
// maps `{event: callback}`).
var eventsApi = function(iteratee, events, name, callback, opts) {
  var i = 0, names;
  if (name && typeof name === 'object') {
    // Handle event maps.
    if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
    for (names = _.keys(name); i < names.length ; i++) {
      events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
    }
  } else if (name && eventSplitter.test(name)) {
    // Handle space-separated event names by delegating them individually.
    for (names = name.split(eventSplitter); i < names.length; i++) {
      events = iteratee(events, names[i], callback, opts);
    }
  } else {
    // Finally, standard events.
    events = iteratee(events, name, callback, opts);
  }
  return events;
};

// Bind an event to a `callback` function. Passing `"all"` will bind
// the callback to all events fired.
Events.on = function(name, callback, context) {
  return internalOn(this, name, callback, context);
};

// Guard the `listening` argument from the public API.
var internalOn = function(obj, name, callback, context, listening) {
  obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
    context: context,
    ctx: obj,
    listening: listening
  });

  if (listening) {
    var listeners = obj._listeners || (obj._listeners = {});
    listeners[listening.id] = listening;
  }

  return obj;
};

// Inversion-of-control versions of `on`. Tell *this* object to listen to
// an event in another object... keeping track of what it's listening to
// for easier unbinding later.
Events.listenTo = function(obj, name, callback) {
  if (!obj) return this;
  var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
  var listeningTo = this._listeningTo || (this._listeningTo = {});
  var listening = listeningTo[id];

  // This object is not listening to any other events on `obj` yet.
  // Setup the necessary references to track the listening callbacks.
  if (!listening) {
    var thisId = this._listenId || (this._listenId = _.uniqueId('l'));
    listening = listeningTo[id] = {obj: obj, objId: id, id: thisId, listeningTo: listeningTo, count: 0};
  }

  // Bind callbacks on obj, and keep track of them on listening.
  internalOn(obj, name, callback, this, listening);
  return this;
};

// The reducing API that adds a callback to the `events` object.
var onApi = function(events, name, callback, options) {
  if (callback) {
    var handlers = events[name] || (events[name] = []);
    var context = options.context, ctx = options.ctx, listening = options.listening;
    if (listening) listening.count++;

    handlers.push({callback: callback, context: context, ctx: context || ctx, listening: listening});
  }
  return events;
};

// Remove one or many callbacks. If `context` is null, removes all
// callbacks with that function. If `callback` is null, removes all
// callbacks for the event. If `name` is null, removes all bound
// callbacks for all events.
Events.off = function(name, callback, context) {
  if (!this._events) return this;
  this._events = eventsApi(offApi, this._events, name, callback, {
    context: context,
    listeners: this._listeners
  });
  return this;
};

Events.addEventListener = function(name, handler, ref) {
  this.on(name, handler, ref)
}

Events.removeEventListener = function(name, handler, ref) {
  this.off(name, handler, ref)
}

// Tell this object to stop listening to either specific events ... or
// to every object it's currently listening to.
Events.stopListening = function(obj, name, callback) {
  var listeningTo = this._listeningTo;
  if (!listeningTo) return this;

  var ids = obj ? [obj._listenId] : _.keys(listeningTo);

  for (var i = 0; i < ids.length; i++) {
    var listening = listeningTo[ids[i]];

    // If listening doesn't exist, this object is not currently
    // listening to obj. Break out early.
    if (!listening) break;

    listening.obj.off(name, callback, this);
  }

  return this;
};

// The reducing API that removes a callback from the `events` object.
var offApi = function(events, name, callback, options) {
  if (!events) return;

  var i = 0, listening;
  var context = options.context, listeners = options.listeners;

  // Delete all events listeners and "drop" events.
  if (!name && !callback && !context) {
    var ids = _.keys(listeners);
    for (; i < ids.length; i++) {
      listening = listeners[ids[i]];
      delete listeners[listening.id];
      delete listening.listeningTo[listening.objId];
    }
    return;
  }

  var names = name ? [name] : _.keys(events);
  for (; i < names.length; i++) {
    name = names[i];
    var handlers = events[name];

    // Bail out if there are no events stored.
    if (!handlers) break;

    // Replace events if there are any remaining.  Otherwise, clean up.
    var remaining = [];
    for (var j = 0; j < handlers.length; j++) {
      var handler = handlers[j];
      if (
        callback && callback !== handler.callback &&
          callback !== handler.callback._callback ||
            context && context !== handler.context
      ) {
        remaining.push(handler);
      } else {
        listening = handler.listening;
        if (listening && --listening.count === 0) {
          delete listeners[listening.id];
          delete listening.listeningTo[listening.objId];
        }
      }
    }

    // Update tail event if the list has any events.  Otherwise, clean up.
    if (remaining.length) {
      events[name] = remaining;
    } else {
      delete events[name];
    }
  }
  return events;
};

// Bind an event to only be triggered a single time. After the first time
// the callback is invoked, its listener will be removed. If multiple events
// are passed in using the space-separated syntax, the handler will fire
// once for each event, not once for a combination of all events.
Events.once = function(name, callback, context) {
  // Map the event into a `{event: once}` object.
  var events = eventsApi(onceMap, {}, name, callback, _.bind(this.off, this));
  if (typeof name === 'string' && context == null) callback = void 0;
  return this.on(events, callback, context);
};

// Inversion-of-control versions of `once`.
Events.listenToOnce = function(obj, name, callback) {
  // Map the event into a `{event: once}` object.
  var events = eventsApi(onceMap, {}, name, callback, _.bind(this.stopListening, this, obj));
  return this.listenTo(obj, events);
};

// Reduces the event callbacks into a map of `{event: onceWrapper}`.
// `offer` unbinds the `onceWrapper` after it has been called.
var onceMap = function(map, name, callback, offer) {
  if (callback) {
    var once = map[name] = _.once(function() {
      offer(name, once);
      callback.apply(this, arguments);
    });
    once._callback = callback;
  }
  return map;
};

// Trigger one or many events, firing all bound callbacks. Callbacks are
// passed the same arguments as `trigger` is, apart from the event name
// (unless you're listening on `"all"`, which will cause your callback to
// receive the true name of the event as the first argument).
Events.trigger = function(names, ...args) {
  let objEvents = this._events
  if (!objEvents) 
    return this

  let allEvents = objEvents.all
  if (objEvents) {
    names.split(' ').forEach(x=>{
      if(x){
        var events = objEvents[x]
        if (events) 
          triggerEvents(events, ...args)
          if (allEvents && (x === 'add' || x === 'remove'|| x === 'destroy'))
            triggerEvents(allEvents, x, ...args);
      }
    })
  }
  return this;
}

var triggerEvents = function(events, ...args) {
  let ev
  let i = events.length

    while (--i > -1){
      (ev = events[i]).callback.call(ev.ctx, ...args)
    }
}

// Aliases for backwards compatibility.
Events.bind   = Events.on;
Events.unbind = Events.off;

// Model
// --------------

// Backbone **Models** are the basic data object in the framework --
// frequently representing a row in a table in a database on your server.
// A discrete chunk of data and a bunch of useful, related methods for
// performing computations and transformations on that data.

// Create a new model with the specified attributes. A client id (`cid`)
// is automatically generated and assigned for you.
var Model = function(attributes, options) {
  var attrs = attributes || {};
  options || (options = {});
  this.cid = _.uniqueId(this.cidPrefix);
  this.attributes = {};
  if (options.collection) this.collection = options.collection;
  if (options.parse) attrs = this.parse(attrs, options) || {};
  var defaults = _.result(this, 'defaults');
  attrs = _.defaults(_.extend({}, defaults, attrs), defaults);
  this.set(attrs, options);
  this.changed = {};
  this.initialize.apply(this, arguments);
};

// Attach all inheritable methods to the Model prototype.
_.extend(Model.prototype, Events, {

  // A hash of attributes whose current and previous value differ.
  changed: null,

  // The value returned during the last failed validation.
  validationError: null,

  // The default name for the JSON `id` attribute is `"id"`. MongoDB and
  // CouchDB users may want to set this to `"_id"`.
  idAttribute: 'id',

  // The prefix is used to create the client id which is used to identify models locally.
  // You may want to override this if you're experiencing name clashes with model ids.
  cidPrefix: 'c',

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize: function(){},

  // Return a copy of the model's `attributes` object.
  toJSON: function(options) {
    return _.clone(this.attributes);
  },

  // Get the value of an attribute.
  get: function(attr) {
    return this.attributes[attr];
  },

  // Get the HTML-escaped value of an attribute.
  escape: function(attr) {
    return _.escape(this.get(attr));
  },

  // Returns `true` if the attribute contains a value that is not null
  // or undefined.
  has: function(attr) {
    return this.get(attr) != null;
  },

  // Special-cased proxy to underscore's `_.matches` method.
  matches: function(attrs) {
    return !!_.iteratee(attrs, this)(this.attributes);
  },

  // Set a hash of model attributes on the object, firing `"change"`. This is
  // the core primitive operation of a model, updating the data and notifying
  // anyone who needs to know about the change in state. The heart of the beast.
  set: function(key, val, options) {
    if (key == null) return this;

    // Handle both `"key", value` and `{key: value}` -style arguments.
    var attrs;
    if (typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      (attrs = {})[key] = val;
    }

    options || (options = {});

    // Run validation.
    if (!this._validate(attrs, options)) return false;

    // Extract attributes and options.
    var unset      = options.unset;
    var silent     = options.silent;
    var changes    = [];
    var changing   = this._changing;
    this._changing = true;

    if (!changing) {
      this._previousAttributes = _.clone(this.attributes);
      this.changed = {};
    }

    var current = this.attributes;
    var changed = this.changed;
    var prev    = this._previousAttributes;

    // For each `set` attribute, update or delete the current value.
    for (var attr in attrs) {
      val = attrs[attr];
      if (!_.isEqual(current[attr], val)) changes.push(attr);
      if (!_.isEqual(prev[attr], val)) {
        changed[attr] = val;
      } else {
        delete changed[attr];
      }
      unset ? delete current[attr] : current[attr] = val;
    }

    // Update the `id`.
    if (this.idAttribute in attrs) this.id = this.get(this.idAttribute);

    // Trigger all relevant attribute changes.
    if (!silent) {
      if (changes.length) this._pending = options;
      for (var i = 0; i < changes.length; i++) {
        this.trigger('change:' + changes[i], this, current[changes[i]], options);
      }
    }

    // You might be wondering why there's a `while` loop here. Changes can
    // be recursively nested within `"change"` events.
    if (changing) return this;
    if (!silent) {
      while (this._pending) {
        options = this._pending;
        this._pending = false;
        this.trigger('change', this, options);
      }
    }
    this._pending = false;
    this._changing = false;
    return this;
  },

  // Remove an attribute from the model, firing `"change"`. `unset` is a noop
  // if the attribute doesn't exist.
  unset: function(attr, options) {
    return this.set(attr, void 0, _.extend({}, options, {unset: true}));
  },

  // Clear all attributes on the model, firing `"change"`.
  clear: function(options) {
    var attrs = {};
    for (var key in this.attributes) attrs[key] = void 0;
    return this.set(attrs, _.extend({}, options, {unset: true}));
  },

  // Determine if the model has changed since the last `"change"` event.
  // If you specify an attribute name, determine if that attribute has changed.
  hasChanged: function(attr) {
    if (attr == null) return !_.isEmpty(this.changed);
    return _.has(this.changed, attr);
  },

  // Return an object containing all the attributes that have changed, or
  // false if there are no changed attributes. Useful for determining what
  // parts of a view need to be updated and/or what attributes need to be
  // persisted to the server. Unset attributes will be set to undefined.
  // You can also pass an attributes object to diff against the model,
  // determining if there *would be* a change.
  changedAttributes: function(diff) {
    if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
    var old = this._changing ? this._previousAttributes : this.attributes;
    var changed = {};
    for (var attr in diff) {
      var val = diff[attr];
      if (_.isEqual(old[attr], val)) continue;
      changed[attr] = val;
    }
    return _.size(changed) ? changed : false;
  },

  // Get the previous value of an attribute, recorded at the time the last
  // `"change"` event was fired.
  previous: function(attr) {
    if (attr == null || !this._previousAttributes) return null;
    return this._previousAttributes[attr];
  },

  // Get all of the attributes of the model at the time of the previous
  // `"change"` event.
  previousAttributes: function() {
    return _.clone(this._previousAttributes);
  },

  // Destroy this model on the server if it was already persisted.
  // Optimistically removes the model from its collection, if it has one.
  // If `wait: true` is passed, waits for the server to respond before removal.
  destroy: function(options) {
    this.stopListening();
    this.trigger('destroy', this, options)
  },

  // **parse** converts a response into the hash of attributes to be `set` on
  // the model. The default implementation is just to pass the response along.
  parse: function(resp, options) {
    return resp;
  },

  // Create a new model with identical attributes to this one.
  clone: function() {
    return new this.constructor(this.attributes);
  },

  // A model is new if it has never been saved to the server, and lacks an id.
  isNew: function() {
    return !this.has(this.idAttribute);
  },

  // Check if the model is currently in a valid state.
  isValid: function(options) {
    return this._validate({}, _.extend({}, options, {validate: true}));
  },

  // Run validation against the next complete set of model attributes,
  // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
  _validate: function(attrs, options) {
    if (!options.validate || !this.validate) return true;
    attrs = _.extend({}, this.attributes, attrs);
    var error = this.validationError = this.validate(attrs, options) || null;
    if (!error) return true;
    this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
    return false;
  }

});

// Underscore methods that we want to implement on the Model, mapped to the
// number of arguments they take.
var modelMethods = {keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
    omit: 0, chain: 1, isEmpty: 1};

// Mix in each Underscore method as a proxy to `Model#attributes`.
addUnderscoreMethods(Model, modelMethods, 'attributes');

// Backbone.Collection
// -------------------

// If models tend to represent a single row of data, a Backbone Collection is
// more analogous to a table full of data ... or a small slice or page of that
// table, or a collection of rows that belong together for a particular reason
// -- all of the messages in this particular folder, all of the documents
// belonging to this particular author, and so on. Collections maintain
// indexes of their models, both in order, and for lookup by `id`.

// Create a new **Collection**, perhaps to contain a specific type of `model`.
// If a `comparator` is specified, the Collection will maintain
// its models in sort order, as they're added and removed.
var Collection = function(models, options) {
  options || (options = {});
  if (options.model) this.model = options.model;
  if (options.comparator !== void 0) this.comparator = options.comparator;
  this._reset();
  this.initialize.apply(this, arguments);
  if (models) this.reset(models, _.extend({silent: true}, options));
};

// Default options for `Collection#set`.
var setOptions = {add: true, remove: true, merge: true};
var addOptions = {add: true, remove: false};

// Splices `insert` into `array` at index `at`.
var splice = function(array, insert, at) {
  at = Math.min(Math.max(at, 0), array.length);
  var tail = Array(array.length - at);
  var length = insert.length;
  var i;
  for (i = 0; i < tail.length; i++) tail[i] = array[i + at];
  for (i = 0; i < length; i++) array[i + at] = insert[i];
  for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i];
};

// Define the Collection's inheritable methods.
_.extend(Collection.prototype, Events, {
  model: Model,

  // Initialize is an empty function by default. Override it with your own
  // initialization logic.
  initialize: function(){},

  // The JSON representation of a Collection is an array of the
  // models' attributes.
  toJSON: function(options) {
    return this.map(function(model) { return model.toJSON(options); });
  },

  // Add a model, or list of models to the set. `models` may be Backbone
  // Models or raw JavaScript objects to be converted to Models, or any
  // combination of the two.
  add: function(models, options) {
    return this.set(models, _.extend({merge: false}, options, addOptions));
  },

  // Remove a model, or a list of models from the set.
  remove: function(models, options) {
    options = _.extend({}, options);
    var singular = !_.isArray(models);
    models = singular ? [models] : models.slice();
    var removed = this._removeModels(models, options);
    if (!options.silent && removed.length) {
      options.changes = {added: [], merged: [], removed: removed};
      this.trigger('update', this, options);
    }
    return singular ? removed[0] : removed;
  },

  // Update a collection by `set`-ing a new list of models, adding new ones,
  // removing models that are no longer present, and merging models that
  // already exist in the collection, as necessary. Similar to **Model#set**,
  // the core operation for updating the data contained by the collection.
  set: function(models, options) {
    if (models == null) return;

    options = _.extend({}, setOptions, options);
    if (options.parse && !this._isModel(models)) {
      models = this.parse(models, options) || [];
    }

    var singular = !_.isArray(models);
    models = singular ? [models] : models.slice();

    var at = options.at;
    if (at != null) at = +at;
    if (at > this.length) at = this.length;
    if (at < 0) at += this.length + 1;

    var set = [];
    var toAdd = [];
    var toMerge = [];
    var toRemove = [];
    var modelMap = {};

    var add = options.add;
    var merge = options.merge;
    var remove = options.remove;

    var sort = false;
    var sortable = this.comparator && at == null && options.sort !== false;
    var sortAttr = _.isString(this.comparator) ? this.comparator : null;

    // Turn bare objects into model references, and prevent invalid models
    // from being added.
    var model, i;
    for (i = 0; i < models.length; i++) {
      model = models[i];

      // If a duplicate is found, prevent it from being added and
      // optionally merge it into the existing model.
      var existing = this.get(model);
      if (existing) {
        if (merge && model !== existing) {
          var attrs = this._isModel(model) ? model.attributes : model;
          if (options.parse) attrs = existing.parse(attrs, options);
          existing.set(attrs, options);
          toMerge.push(existing);
          if (sortable && !sort) sort = existing.hasChanged(sortAttr);
        }
        if (!modelMap[existing.cid]) {
          modelMap[existing.cid] = true;
          set.push(existing);
        }
        models[i] = existing;

      // If this is a new, valid model, push it to the `toAdd` list.
      } else if (add) {
        model = models[i] = this._prepareModel(model, options);
        if (model) {
          toAdd.push(model);
          this._addReference(model, options);
          modelMap[model.cid] = true;
          set.push(model);
        }
      }
    }

    // Remove stale models.
    if (remove) {
      for (i = 0; i < this.length; i++) {
        model = this.models[i];
        if (!modelMap[model.cid]) toRemove.push(model);
      }
      if (toRemove.length) this._removeModels(toRemove, options);
    }

    // See if sorting is needed, update `length` and splice in new models.
    var orderChanged = false;
    var replace = !sortable && add && remove;
    if (set.length && replace) {
      orderChanged = this.length !== set.length || _.some(this.models, function(m, index) {
        return m !== set[index];
      });
      this.models.length = 0;
      splice(this.models, set, 0);
      this.length = this.models.length;
    } else if (toAdd.length) {
      if (sortable) sort = true;
      splice(this.models, toAdd, at == null ? this.length : at);
      this.length = this.models.length;
    }

    // Silently sort the collection if appropriate.
    if (sort) this.sort({silent: true});

    // Unless silenced, it's time to fire all appropriate add/sort/update events.
    if (!options.silent) {
      for (i = 0; i < toAdd.length; i++) {
        if (at != null) options.index = at + i;
        model = toAdd[i];
        model.trigger('add', model, this, options);
      }
      if (sort || orderChanged) this.trigger('sort', this, options);
      if (toAdd.length || toRemove.length || toMerge.length) {
        options.changes = {
          added: toAdd,
          removed: toRemove,
          merged: toMerge
        };
        this.trigger('update', this, options);
      }
    }

    // Return the added (or merged) model (or models).
    return singular ? models[0] : models;
  },

  // When you have more items than you want to add or remove individually,
  // you can reset the entire set with a new list of models, without firing
  // any granular `add` or `remove` events. Fires `reset` when finished.
  // Useful for bulk operations and optimizations.
  reset: function(models, options) {
    options = options ? _.clone(options) : {};
    for (var i = 0; i < this.models.length; i++) {
      this._removeReference(this.models[i], options);
    }
    options.previousModels = this.models;
    this._reset();
    models = this.add(models, _.extend({silent: true}, options));
    if (!options.silent) this.trigger('reset', this, options);
    return models;
  },

  // Add a model to the end of the collection.
  push: function(model, options) {
    return this.add(model, _.extend({at: this.length}, options));
  },

  // Remove a model from the end of the collection.
  pop: function(options) {
    var model = this.at(this.length - 1);
    return this.remove(model, options);
  },

  // Add a model to the beginning of the collection.
  unshift: function(model, options) {
    return this.add(model, _.extend({at: 0}, options));
  },

  // Remove a model from the beginning of the collection.
  shift: function(options) {
    var model = this.at(0);
    return this.remove(model, options);
  },

  // Slice out a sub-array of models from the collection.
  slice: function() {
    return Array.prototype.slice.apply(this.models, arguments);
  },

  // Get a model from the set by id, cid, model object with id or cid
  // properties, or an attributes object that is transformed through modelId.
  get: function(obj) {
    if (obj == null) return void 0;
    return this._byId[obj] ||
      this._byId[this.modelId(obj.attributes || obj)] ||
      obj.cid && this._byId[obj.cid];
  },

  // Returns `true` if the model is in the collection.
  has: function(obj) {
    return this.get(obj) != null;
  },

  // Get the model at the given index.
  at: function(index) {
    if (index < 0) index += this.length;
    return this.models[index];
  },

  // Return models with matching attributes. Useful for simple cases of
  // `filter`.
  where: function(attrs, first) {
    return this[first ? 'find' : 'filter'](attrs);
  },

  // Return the first model with matching attributes. Useful for simple cases
  // of `find`.
  findWhere: function(attrs) {
    return this.where(attrs, true);
  },

  // Force the collection to re-sort itself. You don't need to call this under
  // normal circumstances, as the set will maintain sort order as each item
  // is added.
  sort: function(options) {
    var comparator = this.comparator;
    if (!comparator) throw new Error('Cannot sort a set without a comparator');
    options || (options = {});

    var length = comparator.length;
    if (_.isFunction(comparator)) comparator = _.bind(comparator, this);

    // Run sort based on type of `comparator`.
    if (length === 1 || _.isString(comparator)) {
      this.models = this.sortBy(comparator);
    } else {
      this.models.sort(comparator);
    }
    if (!options.silent) this.trigger('sort', this, options);
    return this;
  },

  // Pluck an attribute from each model in the collection.
  pluck: function(attr) {
    return this.map(attr + '');
  },

  // Create a new instance of a model in this collection. Add the model to the
  // collection immediately, unless `wait: true` is passed, in which case we
  // wait for the server to agree.
  create: function(model, options) {
    options = options ? _.clone(options) : {};
    var wait = options.wait;
    model = this._prepareModel(model, options);
    if (!model) return false;
    if (!wait) this.add(model, options);
    var collection = this;
    var success = options.success;
    options.success = function(m, resp, callbackOpts) {
      if (wait) collection.add(m, callbackOpts);
      if (success) success.call(callbackOpts.context, m, resp, callbackOpts);
    };
    model.save(null, options);
    return model;
  },

  // **parse** converts a response into a list of models to be added to the
  // collection. The default implementation is just to pass it through.
  parse: function(resp, options) {
    return resp;
  },

  // Create a new collection with an identical list of models as this one.
  clone: function() {
    return new this.constructor(this.models, {
      model: this.model,
      comparator: this.comparator
    });
  },

  // Define how to uniquely identify models in the collection.
  modelId: function(attrs) {
    return attrs[this.model.prototype.idAttribute || 'id'];
  },

  // Private method to reset all internal state. Called when the collection
  // is first initialized or reset.
  _reset: function() {
    this.length = 0;
    this.models = [];
    this._byId  = {};
  },

  // Prepare a hash of attributes (or other model) to be added to this
  // collection.
  _prepareModel: function(attrs, options) {
    if (this._isModel(attrs)) {
      if (!attrs.collection) attrs.collection = this;
      return attrs;
    }
    options = options ? _.clone(options) : {};
    options.collection = this;
    var model = new this.model(attrs, options);
    if (!model.validationError) return model;
    this.trigger('invalid', this, model.validationError, options);
    return false;
  },

  // Internal method called by both remove and set.
  _removeModels: function(models, options) {
    var removed = [];
    for (var i = 0; i < models.length; i++) {
      var model = this.get(models[i]);
      if (!model) continue;

      var index = this.indexOf(model);
      this.models.splice(index, 1);
      this.length--;

      // Remove references before triggering 'remove' event to prevent an
      // infinite loop. #3693
      delete this._byId[model.cid];
      var id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];

      if (!options.silent) {
        options.index = index;
        model.trigger('remove', model, this, options);
      }

      removed.push(model);
      this._removeReference(model, options);
    }
    return removed;
  },

  // Method for checking whether an object should be considered a model for
  // the purposes of adding to the collection.
  _isModel: function(model) {
    return model instanceof Model;
  },

  // Internal method to create a model's ties to a collection.
  _addReference: function(model, options) {
    this._byId[model.cid] = model;
    var id = this.modelId(model.attributes);
    if (id != null) this._byId[id] = model;
    model.on('all', this._onModelEvent, this);
  },

  // Internal method to sever a model's ties to a collection.
  _removeReference: function(model, options) {
    delete this._byId[model.cid];
    var id = this.modelId(model.attributes);
    if (id != null) delete this._byId[id];
    if (this === model.collection) delete model.collection;
    model.off('all', this._onModelEvent, this);
  },

  // Internal method called every time a model in the set fires an event.
  // Sets need to update their indexes when models change ids. All other
  // events simply proxy through. "add" and "remove" events that originate
  // in other collections are ignored.
  _onModelEvent: function(event, model, collection, options) {
    if (model) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') {
        this.remove(model, options)
      }
      if (event === 'change') {
        var prevId = this.modelId(model.previousAttributes());
        var id = this.modelId(model.attributes);
        if (prevId !== id) {
          if (prevId != null) delete this._byId[prevId];
          if (id != null) this._byId[id] = model;
        }
      }
    }
    this.trigger.apply(this, arguments);
  }

});

// Underscore methods that we want to implement on the Collection.
// 90% of the core usefulness of Backbone Collections is actually implemented
// right here:
var collectionMethods = {forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
    foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
    select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 3, includes: 3,
    contains: 3, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
    head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
    without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
    isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
    sortBy: 3, indexBy: 3, findIndex: 3, findLastIndex: 3};

// Mix in each Underscore method as a proxy to `Collection#models`.
addUnderscoreMethods(Collection, collectionMethods, 'models');


// Helpers
// -------

// Helper function to correctly set up the prototype chain for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
var extend = function(protoProps, staticProps) {
  var parent = this;
  var child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent constructor.
  if (protoProps && _.has(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function(){ return parent.apply(this, arguments); };
  }

  // Add static properties to the constructor function, if supplied.
  _.extend(child, parent, staticProps);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function and add the prototype properties.
  child.prototype = _.create(parent.prototype, protoProps);
  child.prototype.constructor = child;

  // Set a convenience property in case the parent's prototype is needed
  // later.
  child.__super__ = parent.prototype;

  return child;
};

// Set up inheritance for the model, collection, router, view and history.
Model.extend = Collection.extend = extend;

module.exports = {Model, Collection}

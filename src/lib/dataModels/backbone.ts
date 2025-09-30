/*
MIT License

Copyright (c) 2019 Rafal Okninski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
*/

import * as _ from 'lodash';

// Types
export interface ModelAttributes {
  [key: string]: any;
}

export interface ModelOptions {
  collection?: Collection;
  parse?: boolean;
  [key: string]: any;
}

export interface CollectionOptions {
  model?: typeof Model;
  comparator?: string | ((model: Model) => any) | ((a: Model, b: Model) => number);
  [key: string]: any;
}

export interface SetOptions {
  add?: boolean;
  remove?: boolean;
  merge?: boolean;
  at?: number;
  sort?: boolean;
  silent?: boolean;
  parse?: boolean;
  unset?: boolean;
  index?: number;
  changes?: {
    added: Model[];
    removed: Model[];
    merged: Model[];
  };
  [key: string]: any;
}

interface EventHandler {
  callback: Function;
  context?: any;
  ctx?: any;
  listening?: ListeningState;
}

interface ListeningState {
  obj: any;
  objId: string;
  id: string;
  listeningTo: { [id: string]: ListeningState };
  count: number;
}

// Regular expression used to split event strings
const eventSplitter = /\s+/;

// Proxy Backbone class methods to Underscore functions
const addMethod = function(length: number, method: string, attribute: string) {
  switch (length) {
    case 1: return function(this: any) {
      return (_ as any)[method](this[attribute]);
    };
    case 2: return function(this: any, value: any) {
      return (_ as any)[method](this[attribute], value);
    };
    case 3: return function(this: any, iteratee: any, context?: any) {
      return (_ as any)[method](this[attribute], cb(iteratee, this), context);
    };
    case 4: return function(this: any, iteratee: any, defaultVal: any, context?: any) {
      return (_ as any)[method](this[attribute], cb(iteratee, this), defaultVal, context);
    };
    default: return function(this: any, ...args: any[]) {
      const newArgs = [this[attribute], ...args];
      return (_ as any)[method].apply(_, newArgs);
    };
  }
};

const addUnderscoreMethods = function(Class: any, methods: { [method: string]: number }, attribute: string) {
  _.each(methods, function(length: number, method: string) {
    if ((_ as any)[method]) {
      Class.prototype[method] = addMethod(length, method, attribute);
    }
  });
};

// Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`
const cb = function(iteratee: any, instance: any) {
  if (_.isFunction(iteratee)) return iteratee;
  if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
  if (_.isString(iteratee)) return function(model: Model) { return model.get(iteratee); };
  return iteratee;
};

const modelMatcher = function(attrs: ModelAttributes) {
  const matcher = _.matches(attrs);
  return function(model: Model) {
    return matcher(model.attributes);
  };
};

// Events API
const eventsApi = function(iteratee: Function, events: any, name: string | { [key: string]: Function }, callback?: Function, opts?: any): any {
  let i = 0;
  let names: string[];
  
  if (name && typeof name === 'object') {
    // Handle event maps
    if (callback !== void 0 && 'context' in (opts || {}) && opts.context === void 0) {
      opts.context = callback;
    }
    names = _.keys(name);
    for (; i < names.length; i++) {
      events = eventsApi(iteratee, events, names[i], (name as any)[names[i]], opts);
    }
  } else if (name && eventSplitter.test(name as string)) {
    // Handle space-separated event names
    names = (name as string).split(eventSplitter);
    for (; i < names.length; i++) {
      events = iteratee(events, names[i], callback, opts);
    }
  } else {
    // Standard events
    events = iteratee(events, name, callback, opts);
  }
  return events;
};

// Internal on function
const internalOn = function(obj: any, name: string | { [key: string]: Function }, callback?: Function, context?: any, listening?: ListeningState) {
  obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
    context: context,
    ctx: obj,
    listening: listening
  });

  if (listening) {
    const listeners = obj._listeners || (obj._listeners = {});
    listeners[listening.id] = listening;
  }

  return obj;
};

// The reducing API that adds a callback to the `events` object
const onApi = function(events: any, name: string, callback?: Function, options?: any) {
  if (callback) {
    const handlers = events[name] || (events[name] = []);
    const context = options?.context;
    const ctx = options?.ctx;
    const listening = options?.listening;
    if (listening) listening.count++;

    handlers.push({ callback: callback, context: context, ctx: context || ctx, listening: listening });
  }
  return events;
};

// The reducing API that removes a callback from the `events` object
const offApi = function(events: any, name?: string, callback?: Function, options?: any) {
  if (!events) return;

  let i = 0;
  let listening: ListeningState;
  const context = options?.context;
  const listeners = options?.listeners;

  // Delete all events listeners and "drop" events
  if (!name && !callback && !context) {
    const ids = _.keys(listeners);
    for (; i < ids.length; i++) {
      listening = listeners[ids[i]];
      delete listeners[listening.id];
      delete listening.listeningTo[listening.objId];
    }
    return;
  }

  const names = name ? [name] : _.keys(events);
  for (; i < names.length; i++) {
    name = names[i];
    const handlers = events[name];

    // Bail out if there are no events stored
    if (!handlers) break;

    // Replace events if there are any remaining. Otherwise, clean up.
    const remaining = [];
    for (let j = 0; j < handlers.length; j++) {
      const handler = handlers[j];
      if (
        callback && callback !== handler.callback &&
          callback !== (handler.callback as any)._callback ||
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

    // Update tail event if the list has any events. Otherwise, clean up.
    if (remaining.length) {
      events[name] = remaining;
    } else {
      delete events[name];
    }
  }
  return events;
};

// Reduces the event callbacks into a map of `{event: onceWrapper}`
const onceMap = function(map: any, name: string, callback?: Function, offer?: Function) {
  if (callback) {
    const once = map[name] = _.once(function(this: any, ...args: any[]) {
      offer && offer(name, once);
      return callback.apply(this, args);
    });
    (once as any)._callback = callback;
  }
  return map;
};

const triggerEvents = function(events: EventHandler[], ...args: any[]) {
  let ev: EventHandler;
  let i = events.length;

  while (--i > -1) {
    ev = events[i];
    ev.callback.call(ev.ctx, ...args);
  }
};

// Events mixin
export const Events = {
  // Bind an event to a `callback` function
  on: function(this: any, name: string | { [key: string]: Function }, callback?: Function, context?: any) {
    return internalOn(this, name, callback, context);
  },

  // Inversion-of-control versions of `on`
  listenTo: function(this: any, obj: any, name: string | { [key: string]: Function }, callback?: Function) {
    if (!obj) return this;
    const id = obj._listenId || (obj._listenId = _.uniqueId('l'));
    const listeningTo = this._listeningTo || (this._listeningTo = {});
    let listening = listeningTo[id];

    // This object is not listening to any other events on `obj` yet
    if (!listening) {
      const thisId = this._listenId || (this._listenId = _.uniqueId('l'));
      listening = listeningTo[id] = { obj: obj, objId: id, id: thisId, listeningTo: listeningTo, count: 0 };
    }

    // Bind callbacks on obj, and keep track of them on listening
    internalOn(obj, name, callback, this, listening);
    return this;
  },

  // Remove one or many callbacks
  off: function(this: any, name?: string | { [key: string]: Function }, callback?: Function, context?: any) {
    if (!this._events) return this;
    this._events = eventsApi(offApi, this._events, name as string, callback, {
      context: context,
      listeners: this._listeners
    });
    return this;
  },

  // Tell this object to stop listening to either specific events or to every object it's currently listening to
  stopListening: function(this: any, obj?: any, name?: string | { [key: string]: Function }, callback?: Function) {
    const listeningTo = this._listeningTo;
    if (!listeningTo) return this;

    const ids = obj ? [obj._listenId] : _.keys(listeningTo);

    for (let i = 0; i < ids.length; i++) {
      const listening = listeningTo[ids[i]];

      // If listening doesn't exist, this object is not currently listening to obj
      if (!listening) break;

      listening.obj.off(name, callback, this);
    }

    return this;
  },

  // Bind an event to only be triggered a single time
  once: function(this: any, name: string | { [key: string]: Function }, callback?: Function, context?: any) {
    // Map the event into a `{event: once}` object
    const events = eventsApi(onceMap, {}, name as string, callback, _.bind(this.off, this));
    if (typeof name === 'string' && context == null) callback = void 0;
    return this.on(events, callback, context);
  },

  // Inversion-of-control versions of `once`
  listenToOnce: function(this: any, obj: any, name: string | { [key: string]: Function }, callback?: Function) {
    // Map the event into a `{event: once}` object
    const events = eventsApi(onceMap, {}, name as string, callback, _.bind(this.stopListening, this, obj));
    return this.listenTo(obj, events);
  },

  // Trigger one or many events, firing all bound callbacks
  trigger: function(this: any, name: string, ...args: any[]) {
    const objEvents = this._events;
    if (!objEvents) return this;

    const allEvents = objEvents.all;
    const events = objEvents[name];
    
    if (events) {
      triggerEvents(events, ...args);
    }
    if (allEvents) {
      triggerEvents(allEvents, name, ...args);
    }
    return this;
  },

  // Aliases for backwards compatibility
  bind: function(this: any, ...args: any[]) { return this.on(...args); },
  unbind: function(this: any, ...args: any[]) { return this.off(...args); },
  
  // DOM-style event methods
  addEventListener: function(this: any, name: string, handler: Function, ref?: any) {
    this.on(name, handler, ref);
  },

  removeEventListener: function(this: any, name: string, handler: Function, ref?: any) {
    this.off(name, handler, ref);
  }
};

// Event interface for mixins
interface EventEmitter {
  on(name: string | { [key: string]: Function }, callback?: Function, context?: any): this;
  off(name?: string | { [key: string]: Function }, callback?: Function, context?: any): this;
  trigger(name: string, ...args: any[]): this;
  listenTo(obj: any, name: string | { [key: string]: Function }, callback?: Function): this;
  stopListening(obj?: any, name?: string | { [key: string]: Function }, callback?: Function): this;
  once(name: string | { [key: string]: Function }, callback?: Function, context?: any): this;
  listenToOnce(obj: any, name: string | { [key: string]: Function }, callback?: Function): this;
  bind(...args: any[]): this;
  unbind(...args: any[]): this;
  addEventListener(name: string, handler: Function, ref?: any): void;
  removeEventListener(name: string, handler: Function, ref?: any): void;
}

// Backbone **Models** are the basic data object in the framework
export class Model implements EventEmitter {
  public attributes: ModelAttributes = {};
  public changed: ModelAttributes | null = null;
  public validationError: any = null;
  public idAttribute: string = 'id';
  public cidPrefix: string = 'c';
  public cid: string;
  public id?: any;
  public collection?: Collection;

  // Event system properties
  public _events?: { [eventName: string]: EventHandler[] };
  public _listeners?: { [id: string]: ListeningState };
  public _listeningTo?: { [id: string]: ListeningState };
  public _listenId?: string;
  private _previousAttributes?: ModelAttributes;
  private _pending?: any;
  private _changing?: boolean;
  
  // Event methods (will be mixed in)
  public on!: (name: string | { [key: string]: Function }, callback?: Function, context?: any) => this;
  public off!: (name?: string | { [key: string]: Function }, callback?: Function, context?: any) => this;
  public trigger!: (name: string, ...args: any[]) => this;
  public listenTo!: (obj: any, name: string | { [key: string]: Function }, callback?: Function) => this;
  public stopListening!: (obj?: any, name?: string | { [key: string]: Function }, callback?: Function) => this;
  public once!: (name: string | { [key: string]: Function }, callback?: Function, context?: any) => this;
  public listenToOnce!: (obj: any, name: string | { [key: string]: Function }, callback?: Function) => this;
  public bind!: (...args: any[]) => this;
  public unbind!: (...args: any[]) => this;
  public addEventListener!: (name: string, handler: Function, ref?: any) => void;
  public removeEventListener!: (name: string, handler: Function, ref?: any) => void;

  constructor(attributes?: ModelAttributes, options?: ModelOptions) {
    const attrs = attributes || {};
    options = options || {};
    
    this.cid = _.uniqueId(this.cidPrefix);
    this.attributes = {};
    
    // Initialize event methods before calling set() which uses trigger()
    this.on = Events.on.bind(this);
    this.off = Events.off.bind(this);
    this.trigger = Events.trigger.bind(this);
    this.listenTo = Events.listenTo.bind(this);
    this.stopListening = Events.stopListening.bind(this);
    this.once = Events.once.bind(this);
    this.listenToOnce = Events.listenToOnce.bind(this);
    this.bind = Events.bind.bind(this);
    this.unbind = Events.unbind.bind(this);
    this.addEventListener = Events.addEventListener.bind(this);
    this.removeEventListener = Events.removeEventListener.bind(this);
    
    if (options.collection) this.collection = options.collection;
    if (options.parse) {
      const parsed = this.parse(attrs, options);
      if (parsed) Object.assign(attrs, parsed);
    }
    
    const defaults = _.result(this, 'defaults');
    const finalAttrs = _.defaults(_.extend({}, defaults, attrs), defaults);
    this.set(finalAttrs, options);
    this.changed = {};
    this.initialize.apply(this, [attributes, options]);
  }

  // Initialize is an empty function by default. Override it with your own initialization logic.
  initialize(..._args: any[]): void {}

  // Return a copy of the model's `attributes` object
  toJSON(_options?: any): ModelAttributes {
    return _.clone(this.attributes);
  }

  // Get the value of an attribute
  get(attr: string): any {
    return this.attributes[attr];
  }

  // Get the HTML-escaped value of an attribute
  escape(attr: string): string {
    return _.escape(this.get(attr));
  }

  // Returns `true` if the attribute contains a value that is not null or undefined
  has(attr: string): boolean {
    return this.get(attr) != null;
  }

  // Special-cased proxy to underscore's `_.matches` method
  matches(attrs: ModelAttributes): boolean {
    return !!_.iteratee(attrs)(this.attributes);
  }

  // Set a hash of model attributes on the object, firing `"change"`
  set(key: string | ModelAttributes, val?: any, options?: SetOptions): this | false {
    if (key == null) return this;

    // Handle both `"key", value` and `{key: value}` -style arguments
    let attrs: ModelAttributes;
    if (typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      attrs = {};
      attrs[key] = val;
    }

    options = options || {};

    // Run validation
    if (!this._validate(attrs, options)) return false;

    // Extract attributes and options
    const unset = options.unset;
    const silent = options.silent;
    const changes: string[] = [];
    const changing = this._changing;
    this._changing = true;

    if (!changing) {
      this._previousAttributes = _.clone(this.attributes);
      this.changed = {};
    }

    const current = this.attributes;
    const changed = this.changed!;
    const prev = this._previousAttributes!;

    // For each `set` attribute, update or delete the current value
    for (const attr in attrs) {
      val = attrs[attr];
      if (!_.isEqual(current[attr], val)) changes.push(attr);
      if (!_.isEqual(prev[attr], val)) {
        changed[attr] = val;
      } else {
        delete changed[attr];
      }
      unset ? delete current[attr] : current[attr] = val;
    }

    // Update the `id`
    if (this.idAttribute in attrs) this.id = this.get(this.idAttribute);

    // Trigger all relevant attribute changes
    if (!silent) {
      if (changes.length) this._pending = options;
      for (let i = 0; i < changes.length; i++) {
        this.trigger('change:' + changes[i], this, current[changes[i]], options);
      }
    }

    // You might be wondering why there's a `while` loop here. Changes can be recursively nested within `"change"` events.
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
  }

  // Remove an attribute from the model, firing `"change"`
  unset(attr: string, options?: SetOptions): this | false {
    return this.set(attr, void 0, _.extend({}, options, { unset: true }));
  }

  // Clear all attributes on the model, firing `"change"`
  clear(options?: SetOptions): any {
    const attrs: ModelAttributes = {};
    for (const key in this.attributes) attrs[key] = void 0;
    return this.set(attrs, _.extend({}, options, { unset: true }));
  }

  // Determine if the model has changed since the last `"change"` event
  hasChanged(attr?: string): boolean {
    if (attr == null) return !_.isEmpty(this.changed);
    return _.has(this.changed!, attr);
  }

  // Return an object containing all the attributes that have changed
  changedAttributes(diff?: ModelAttributes): ModelAttributes | false {
    if (!diff) return this.hasChanged() ? _.clone(this.changed!) : false;
    const old = this._changing ? this._previousAttributes! : this.attributes;
    const changed: ModelAttributes = {};
    for (const attr in diff) {
      const val = diff[attr];
      if (_.isEqual(old[attr], val)) continue;
      changed[attr] = val;
    }
    return _.size(changed) ? changed : false;
  }

  // Get the previous value of an attribute, recorded at the time the last `"change"` event was fired
  previous(attr: string): any {
    if (attr == null || !this._previousAttributes) return null;
    return this._previousAttributes[attr];
  }

  // Get all of the attributes of the model at the time of the previous `"change"` event
  previousAttributes(): ModelAttributes | null {
    return _.clone(this._previousAttributes!);
  }

  // Destroy this model on the server if it was already persisted
  destroy(options?: any): void {
    this.stopListening();
    this.trigger('destroy', this, options);
  }

  // **parse** converts a response into the hash of attributes to be `set` on the model
  parse(resp: any, _options?: any): ModelAttributes {
    return resp;
  }

  // Create a new model with identical attributes to this one
  clone(): Model {
    return new (this.constructor as any)(this.attributes);
  }

  // A model is new if it has never been saved to the server, and lacks an id
  isNew(): boolean {
    return !this.has(this.idAttribute);
  }

  // Check if the model is currently in a valid state
  isValid(options?: any): boolean {
    return this._validate({}, _.extend({}, options, { validate: true }));
  }

  // Run validation against the next complete set of model attributes
  private _validate(attrs: ModelAttributes, options?: any): boolean {
    if (!options?.validate || !this.validate) return true;
    attrs = _.extend({}, this.attributes, attrs);
    const error = this.validationError = this.validate(attrs, options) || null;
    if (!error) return true;
    this.trigger('invalid', this, error, _.extend(options, { validationError: error }));
    return false;
  }

  // Override this method to provide custom validation
  validate?(_attributes: ModelAttributes, _options?: any): any;
}

// Mix in Events methods to Model
Object.assign(Model.prototype, Events);

// Also assign individual methods to ensure they're properly attached
Model.prototype.on = Events.on;
Model.prototype.off = Events.off;
Model.prototype.trigger = Events.trigger;
Model.prototype.listenTo = Events.listenTo;
Model.prototype.stopListening = Events.stopListening;
Model.prototype.once = Events.once;
Model.prototype.listenToOnce = Events.listenToOnce;
Model.prototype.bind = Events.bind;
Model.prototype.unbind = Events.unbind;
Model.prototype.addEventListener = Events.addEventListener;
Model.prototype.removeEventListener = Events.removeEventListener;

// Underscore methods that we want to implement on the Model
const modelMethods = {
  keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
  omit: 0, chain: 1, isEmpty: 1
};

// Mix in each Underscore method as a proxy to `Model#attributes`
addUnderscoreMethods(Model, modelMethods, 'attributes');

// Default options for `Collection#set`
const setOptions = { add: true, remove: true, merge: true };
const addOptions = { add: true, remove: false };

// Splices `insert` into `array` at index `at`
const splice = function(array: any[], insert: any[], at: number) {
  at = Math.min(Math.max(at, 0), array.length);
  const tail = Array(array.length - at);
  const length = insert.length;
  let i: number;
  
  for (i = 0; i < tail.length; i++) tail[i] = array[i + at];
  for (i = 0; i < length; i++) array[i + at] = insert[i];
  for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i];
};

// Backbone Collection
export class Collection implements EventEmitter {
  public model: typeof Model = Model;
  public models: Model[] = [];
  public length: number = 0;
  public comparator?: string | ((model: Model) => any) | ((a: Model, b: Model) => number);

  // Event system properties
  public _events?: { [eventName: string]: EventHandler[] };
  public _listeners?: { [id: string]: ListeningState };
  public _listeningTo?: { [id: string]: ListeningState };
  public _listenId?: string;
  private _byId: { [id: string]: Model } = {};
  
  // Event methods (will be mixed in)
  public on!: (name: string | { [key: string]: Function }, callback?: Function, context?: any) => this;
  public off!: (name?: string | { [key: string]: Function }, callback?: Function, context?: any) => this;
  public trigger!: (name: string, ...args: any[]) => this;
  public listenTo!: (obj: any, name: string | { [key: string]: Function }, callback?: Function) => this;
  public stopListening!: (obj?: any, name?: string | { [key: string]: Function }, callback?: Function) => this;
  public once!: (name: string | { [key: string]: Function }, callback?: Function, context?: any) => this;
  public listenToOnce!: (obj: any, name: string | { [key: string]: Function }, callback?: Function) => this;
  public bind!: (...args: any[]) => this;
  public unbind!: (...args: any[]) => this;
  public addEventListener!: (name: string, handler: Function, ref?: any) => void;
  public removeEventListener!: (name: string, handler: Function, ref?: any) => void;

  // Underscore methods (will be mixed in)
  public map!: <T>(iteratee: (model: Model, index: number) => T) => T[];
  public forEach!: (iteratee: (model: Model, index: number) => void) => void;
  public filter!: (iteratee: (model: Model, index: number) => boolean) => Model[];
  public find!: (iteratee: (model: Model, index: number) => boolean) => Model | undefined;

  constructor(models?: Model[] | ModelAttributes[], options?: CollectionOptions) {
    options = options || {};
    
    // Initialize event methods before any operations that might trigger events
    this.on = Events.on.bind(this);
    this.off = Events.off.bind(this);
    this.trigger = Events.trigger.bind(this);
    this.listenTo = Events.listenTo.bind(this);
    this.stopListening = Events.stopListening.bind(this);
    this.once = Events.once.bind(this);
    this.listenToOnce = Events.listenToOnce.bind(this);
    this.bind = Events.bind.bind(this);
    this.unbind = Events.unbind.bind(this);
    this.addEventListener = Events.addEventListener.bind(this);
    this.removeEventListener = Events.removeEventListener.bind(this);
    
    // Initialize underscore methods before any operations that might use them
    this.forEach = (iteratee: any, context?: any) => (_ as any).forEach(this.models, cb(iteratee, this), context);
    this.map = (iteratee: any, context?: any) => (_ as any).map(this.models, cb(iteratee, this), context);
    this.filter = (iteratee: any, context?: any) => (_ as any).filter(this.models, cb(iteratee, this), context);
    this.find = (iteratee: any, context?: any) => (_ as any).find(this.models, cb(iteratee, this), context);
    
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, [models, options]);
    if (models) this.reset(models, _.extend({ silent: true }, options));
  }

  // Initialize is an empty function by default
  initialize(..._args: any[]): void {}

  // The JSON representation of a Collection is an array of the models' attributes
  toJSON(options?: any): ModelAttributes[] {
    return this.map(function(model: Model) { return model.toJSON(options); });
  }

  // Add a model, or list of models to the set
  add(models: Model | Model[] | ModelAttributes | ModelAttributes[], options?: SetOptions): Model | Model[] {
    return this.set(models, _.extend({ merge: false }, options, addOptions));
  }

  // Remove a model, or a list of models from the set
  remove(models: Model | Model[], options?: any): Model | Model[] {
    options = _.extend({}, options);
    const singular = !_.isArray(models);
    const modelsArray = singular ? [models] : models.slice();
    const removed = this._removeModels(modelsArray, options);
    if (!options.silent && removed.length) {
      options.changes = { added: [], merged: [], removed: removed };
      this.trigger('update', this, options);
    }
    return singular ? removed[0] : removed;
  }

  // Update a collection by `set`-ing a new list of models
  set(models: Model | Model[] | ModelAttributes | ModelAttributes[] | null | undefined, options?: SetOptions): Model | Model[] {
    if (models == null) return [] as any;

    options = _.extend({}, setOptions, options);
    if (options.parse && !this._isModel(models)) {
      models = this.parse(models as any, options) || [];
    }

    const singular = !_.isArray(models);
    const modelsArray = singular ? [models] : (models as any[]).slice();

    let at = options.at;
    if (at != null) {
      at = +at;
      if (at > this.length) at = this.length;
      if (at < 0) at += this.length + 1;
    }

    const set: Model[] = [];
    const toAdd: Model[] = [];
    const toMerge: Model[] = [];
    const toRemove: Model[] = [];
    const modelMap: { [cid: string]: boolean } = {};

    const add = options.add;
    const merge = options.merge;
    const remove = options.remove;

    let sort = false;
    const sortable = this.comparator && at == null && options.sort !== false;
    const sortAttr = _.isString(this.comparator) ? this.comparator : null;

    // Turn bare objects into model references, and prevent invalid models from being added
    let model: Model;
    let i: number;
    
    for (i = 0; i < modelsArray.length; i++) {
      model = modelsArray[i] as Model;

      // If a duplicate is found, prevent it from being added and optionally merge it into the existing model
      const existing = this.get(model);
      if (existing) {
        if (merge && model !== existing) {
          let attrs = this._isModel(model) ? model.attributes : model as ModelAttributes;
          if (options.parse) attrs = existing.parse(attrs, options);
          existing.set(attrs, options);
          toMerge.push(existing);
          if (sortable && !sort) sort = existing.hasChanged(sortAttr!);
        }
        if (!modelMap[existing.cid]) {
          modelMap[existing.cid] = true;
          set.push(existing);
        }
        modelsArray[i] = existing;

      // If this is a new, valid model, push it to the `toAdd` list
      } else if (add) {
        const preparedModel = this._prepareModel(model, options);
        if (preparedModel) {
          model = modelsArray[i] = preparedModel;
          toAdd.push(preparedModel);
          this._addReference(preparedModel, options);
          modelMap[preparedModel.cid] = true;
          set.push(preparedModel);
        }
      }
    }

    // Remove stale models
    if (remove) {
      for (i = 0; i < this.length; i++) {
        model = this.models[i];
        if (!modelMap[model.cid]) toRemove.push(model);
      }
      if (toRemove.length) this._removeModels(toRemove, options);
    }

    // See if sorting is needed, update `length` and splice in new models
    let orderChanged = false;
    const replace = !sortable && add && remove;
    
    if (set.length && replace) {
      orderChanged = this.length !== set.length || _.some(this.models, function(m: Model, index: number) {
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

    // Silently sort the collection if appropriate
    if (sort) this.sort({ silent: true });

    // Unless silenced, it's time to fire all appropriate add/sort/update events
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

    // Return the added (or merged) model (or models)
    return singular ? modelsArray[0] : modelsArray;
  }

  // When you have more items than you want to add or remove individually, you can reset the entire set
  reset(models?: Model[] | ModelAttributes[], options?: any): Model[] {
    options = options ? _.clone(options) : {};
    for (let i = 0; i < this.models.length; i++) {
      this._removeReference(this.models[i], options);
    }
    options.previousModels = this.models;
    this._reset();
    const result = this.add(models!, _.extend({ silent: true }, options)) as Model[];
    if (!options.silent) this.trigger('reset', this, options);
    return result;
  }

  // Add a model to the end of the collection
  push(model: Model | ModelAttributes, options?: SetOptions): Model {
    return this.add(model, _.extend({ at: this.length }, options)) as Model;
  }

  // Remove a model from the end of the collection
  pop(options?: any): Model {
    const model = this.at(this.length - 1);
    return this.remove(model!, options) as Model;
  }

  // Add a model to the beginning of the collection
  unshift(model: Model | ModelAttributes, options?: SetOptions): Model {
    return this.add(model, _.extend({ at: 0 }, options)) as Model;
  }

  // Remove a model from the beginning of the collection
  shift(options?: any): Model {
    const model = this.at(0);
    return this.remove(model!, options) as Model;
  }

  // Slice out a sub-array of models from the collection
  slice(start?: number, end?: number): Model[] {
    return this.models.slice(start, end);
  }

  // Get a model from the set by id, cid, model object with id or cid properties, or an attributes object
  get(obj: any): Model | undefined {
    if (obj == null) return void 0;
    return this._byId[obj] ||
      this._byId[this.modelId(obj.attributes || obj)] ||
      obj.cid && this._byId[obj.cid];
  }

  // Returns `true` if the model is in the collection
  has(obj: any): boolean {
    return this.get(obj) != null;
  }

  // Get the model at the given index
  at(index: number): Model | undefined {
    if (index < 0) index += this.length;
    return this.models[index];
  }

  // Return models with matching attributes
  where(attrs: ModelAttributes, first?: boolean): Model[] | Model {
    return (this as any)[first ? 'find' : 'filter'](attrs);
  }

  // Return the first model with matching attributes
  findWhere(attrs: ModelAttributes): Model {
    return this.where(attrs, true) as Model;
  }

  // Force the collection to re-sort itself
  sort(options?: any): this {
    let comparator = this.comparator;
    if (!comparator) throw new Error('Cannot sort a set without a comparator');
    options = options || {};

    const length = (comparator as any).length;
    if (_.isFunction(comparator)) comparator = _.bind(comparator as any, this);

    // Run sort based on type of `comparator`
    if (length === 1 || _.isString(comparator)) {
      this.models = (this as any).sortBy(comparator);
    } else {
      this.models.sort(comparator as any);
    }
    if (!options.silent) this.trigger('sort', this, options);
    return this;
  }

  // Pluck an attribute from each model in the collection
  pluck(attr: string): any[] {
    return (this as any).map(attr + '');
  }

  // Create a new instance of a model in this collection
  create(model: Model | ModelAttributes, options?: any): Model | false {
    options = options ? _.clone(options) : {};
    const wait = options.wait;
    const preparedModel = this._prepareModel(model, options);
    if (!preparedModel) return false;
    if (!wait) this.add(preparedModel, options);
    const collection = this;
    const success = options.success;
    options.success = function(m: Model, resp: any, callbackOpts: any) {
      if (wait) collection.add(m, callbackOpts);
      if (success) success.call(callbackOpts.context, m, resp, callbackOpts);
    };
    (preparedModel as any).save(null, options);
    return preparedModel;
  }

  // **parse** converts a response into a list of models to be added to the collection
  parse(resp: any, _options?: any): any {
    return resp;
  }

  // Create a new collection with an identical list of models as this one
  clone(): Collection {
    return new (this.constructor as any)(this.models, {
      model: this.model,
      comparator: this.comparator
    });
  }

  // Define how to uniquely identify models in the collection
  modelId(attrs: ModelAttributes): any {
    return attrs[this.model.prototype.idAttribute || 'id'];
  }

  // Private method to reset all internal state
  private _reset(): void {
    this.length = 0;
    this.models = [];
    this._byId = {};
  }

  // Prepare a hash of attributes (or other model) to be added to this collection
  private _prepareModel(attrs: Model | ModelAttributes, options?: any): Model | false {
    if (this._isModel(attrs)) {
      if (!(attrs as Model).collection) (attrs as Model).collection = this;
      return attrs as Model;
    }
    options = options ? _.clone(options) : {};
    options.collection = this;
    const model = new this.model(attrs as ModelAttributes, options);
    if (!model.validationError) return model;
    this.trigger('invalid', this, model.validationError, options);
    return false;
  }

  // Internal method called by both remove and set
  private _removeModels(models: Model[], options?: any): Model[] {
    const removed: Model[] = [];
    for (let i = 0; i < models.length; i++) {
      const model = this.get(models[i]);
      if (!model) continue;

      const index = this.indexOf(model);
      this.models.splice(index, 1);
      this.length--;

      // Remove references before triggering 'remove' event to prevent an infinite loop
      delete this._byId[model.cid];
      const id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];

      if (!options?.silent) {
        options.index = index;
        model.trigger('remove', model, this, options);
      }

      removed.push(model);
      this._removeReference(model, options);
    }
    return removed;
  }

  // Method for checking whether an object should be considered a model
  private _isModel(model: any): model is Model {
    return model instanceof Model;
  }

  // Internal method to create a model's ties to a collection
  private _addReference(model: Model, _options?: any): void {
    this._byId[model.cid] = model;
    const id = this.modelId(model.attributes);
    if (id != null) this._byId[id] = model;
    model.on('all', this._onModelEvent, this);
  }

  // Internal method to sever a model's ties to a collection
  private _removeReference(model: Model, _options?: any): void {
    delete this._byId[model.cid];
    const id = this.modelId(model.attributes);
    if (id != null) delete this._byId[id];
    if (this === model.collection) delete model.collection;
    model.off('all', this._onModelEvent, this);
  }

  // Internal method called every time a model in the set fires an event
  private _onModelEvent(event: string, model: Model, collection?: Collection, options?: any): void {
    if (model) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') {
        this.remove(model, options);
      }
      if (event === 'change') {
        const prevId = this.modelId(model.previousAttributes()!);
        const id = this.modelId(model.attributes);
        if (prevId !== id) {
          if (prevId != null) delete this._byId[prevId];
          if (id != null) this._byId[id] = model;
        }
      }
    }
    this.trigger.apply(this, [event, ...Array.prototype.slice.call(arguments, 1)]);
  }

  // Add array methods and underscore methods
  indexOf(model: Model): number { return this.models.indexOf(model); }
}

// Mix in Events methods to Collection
Object.assign(Collection.prototype, Events);

// Also assign individual methods to ensure they're properly attached
Collection.prototype.on = Events.on;
Collection.prototype.off = Events.off;
Collection.prototype.trigger = Events.trigger;
Collection.prototype.listenTo = Events.listenTo;
Collection.prototype.stopListening = Events.stopListening;
Collection.prototype.once = Events.once;
Collection.prototype.listenToOnce = Events.listenToOnce;
Collection.prototype.bind = Events.bind;
Collection.prototype.unbind = Events.unbind;
Collection.prototype.addEventListener = Events.addEventListener;
Collection.prototype.removeEventListener = Events.removeEventListener;

// Underscore methods that we want to implement on the Collection
const collectionMethods = {
  forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
  foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
  select: 3, reject: 3, every: 3, all: 3, some: 3, include: 3, includes: 3,
  contains: 3, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
  head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
  without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
  isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
  sortBy: 3, indexBy: 3, findIndex: 3, findLastIndex: 3
};

// Mix in each Underscore method as a proxy to `Collection#models`
addUnderscoreMethods(Collection, collectionMethods, 'models');

// Helper function to correctly set up the prototype chain for subclasses
const extend = function(this: any, protoProps?: any, staticProps?: any) {
  const parent = this;
  let child: any;

  // The constructor function for the new subclass
  if (protoProps && _.has(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function(this: any, ...args: any[]) { return parent.apply(this, args); };
  }

  // Add static properties to the constructor function, if supplied
  _.extend(child, parent, staticProps);

  // Set the prototype chain to inherit from `parent`
  child.prototype = _.create(parent.prototype, protoProps);
  child.prototype.constructor = child;

  // Set a convenience property in case the parent's prototype is needed later
  child.__super__ = parent.prototype;

  return child;
};

// Set up inheritance for the model and collection
(Model as any).extend = extend;
(Collection as any).extend = extend;

export { Model as default };

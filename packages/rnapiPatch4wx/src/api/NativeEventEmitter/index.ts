/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
'use strict';

import EventEmitter from '../emitter/EventEmitter';
 import  EmitterSubscription from '../emitter/EmitterSubscription';

import invariant from '../../invariant';


/**
 * Abstract base class for implementing event-emitting modules. This implements
 * a subset of the standard EventEmitter node module API.
 */
class NativeEventEmitter extends EventEmitter {

  constructor() {
    super();
    
  }

  addListener(
    eventType: string,
    listener: Function,
    context?: Object,
  ): EmitterSubscription {
  
    return super.addListener(eventType, listener, context);
  }

  removeAllListeners(eventType: string) {
    invariant(eventType, 'eventType argument is required.');
    
    super.removeAllListeners(eventType);
  }

  removeSubscription(subscription: EmitterSubscription) {
     
    super.removeSubscription(subscription);
  }
}

export default NativeEventEmitter;

// APIs
import DeviceInfo from './api/DeviceInfo'
import Dimensions from './api/Dimensions'
import PixelRatio from './api/PixelRatio'
import Platform from './api/Platform'
import StyleSheet from './api/StyleSheet'
import NativeEventEmitter from './api/NativeEventEmitter'
import ListView from './api/ListView'

const NativeAppEventEmitter = new NativeEventEmitter()

export {
  DeviceInfo,
  Dimensions,
  PixelRatio,
  Platform,
  StyleSheet,
  NativeEventEmitter,
  NativeAppEventEmitter,

  ListView
}

const ReactNative = {
  DeviceInfo,
  Dimensions,
  PixelRatio,
  Platform,
  StyleSheet,
  NativeEventEmitter,
  NativeAppEventEmitter,

  ListView
}

export default ReactNative

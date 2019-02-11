// APIs
import DeviceInfo from './api/DeviceInfo'
import Dimensions from './api/Dimensions'
import PixelRatio from './api/PixelRatio'
import Platform from './api/Platform'
import StyleSheet from './api/StyleSheet'
import NativeEventEmitter from './api/NativeEventEmitter'

const NativeAppEventEmitter = new NativeEventEmitter()

export {
  DeviceInfo,
  Dimensions,
  PixelRatio,
  Platform,
  StyleSheet,
  NativeEventEmitter,
  NativeAppEventEmitter
}

const ReactNative = {
  DeviceInfo,
  Dimensions,
  PixelRatio,
  Platform,
  StyleSheet,
  NativeEventEmitter,
  NativeAppEventEmitter
}

export default ReactNative

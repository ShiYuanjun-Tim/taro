// APIs
import DeviceInfo from './api/DeviceInfo'
import Dimensions from './api/Dimensions'
import PixelRatio from './api/PixelRatio'
import Platform from './api/Platform'
import StyleSheet from './api/StyleSheet'
import NativeEventEmitter from './api/NativeEventEmitter'
import NetInfo from './api/NetInfo'
import ListView from './api/ListView'

const NativeAppEventEmitter = new NativeEventEmitter()
const ImageBackground = null
const Image = null
export {
  DeviceInfo,
  Dimensions,
  PixelRatio,
  Platform,
  StyleSheet,
  NativeEventEmitter,
  NativeAppEventEmitter,
  NetInfo,

  ImageBackground, Image,
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
  NetInfo,

  ImageBackground,
  Image,
  ListView
}

export default ReactNative

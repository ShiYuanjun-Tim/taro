declare const wx: any;
import * as debounce from 'debounce'
import invariant from '../../invariant'
 import compareVersion from '../../compareVersion'
import deviceInfo from "../DeviceInfo"
interface Dimesion {
  height: number;
  width: number;
  scale: number;
  fontScale: number;
}


const listeners = {};

export default class Dimensions {
  static get(dimension: string): Dimesion {
    // invariant(dimensions[dimension], `No dimension set for key ${dimension}`);
    const deviceInfo = wx.getSystemInfoSync();
    return  {
      window: {
        height: deviceInfo.windowHeight,
        width: deviceInfo.windowWidth,
        scale: deviceInfo.pixelRatio,
        fontScale: 1//deviceInfo.fontSizeSetting
      },
      screen: {
        height: deviceInfo.screenHeight,
        width: deviceInfo.screenWidth,
        scale: deviceInfo.pixelRatio,
        fontScale: 1
      },
    }[dimension];
  }

  static set(): void {
    invariant(0, `Not available now`);

  }

  static _update() {

    
  }

  static addEventListener(type: string, handler: Function): void {
    listeners[type] = listeners[type] || [];
    listeners[type].push(handler);
  }

  static removeEventListener(type: string, handler: Function): void {
    if (Array.isArray(listeners[type])) {
      listeners[type] = listeners[type].filter(_handler => _handler !== handler);
    }
  }


}

if (compareVersion(deviceInfo.SDKVersion, '2.3.0')) {
  wx.onWindowResize(debounce(Dimensions._update, 16))
}

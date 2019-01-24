declare const wx : any;

export interface SysInfo {
  model: string;
  pixelRatio: number;
  windowWidth: number;
  windowHeight: number;
  system: string;
  language: string;
  version: string;
  screenWidth: number;
  screenHeight: number;
  SDKVersion: string;
  brand: string;
  fontSizeSetting: number;
  batteryLevel: number;
  statusBarHeight: number;
  platform: string;
}

export default wx.getSystemInfoSync() as SysInfo
/* 
{
  "model": "iPhone X",
  "pixelRatio": 3,
  "windowWidth": 375,
  "windowHeight": 724,
  "system": "iOS 10.0.1",
  "language": "zh",
  "version": "6.6.3",
  "screenWidth": 375,
  "screenHeight": 812,
  "SDKVersion": "2.5.0",
  "brand": "devtools",
  "fontSizeSetting": 16,
  "batteryLevel": 100,
  "statusBarHeight": 44,
  "platform": "devtools"
} */
//  export default sysinfo

/* eslint-disable camelcase */
import {
  getEnv,
  Events,
  eventCenter,
  ENV_TYPE,
  render,
  internal_safe_get,
  internal_safe_set,
  internal_inline_style,
  internal_get_original,
  rn2wx
} from '@tarojsrn/taro'

import Component from './component'
import PureComponent from './pure-component'
import createApp from './create-app'
import createComponent from './create-component'
import initNativeApi from './native-api'
import { getElementById } from './util'

export const Taro = {
  Component,
  PureComponent,
  createApp,
  initNativeApi,
  Events,
  eventCenter,
  getEnv,
  render,
  ENV_TYPE,
  internal_safe_get,
  internal_safe_set,
  internal_inline_style,
  createComponent,
  internal_get_original,
  getElementById,
  [rn2wx.varNames.modeMapping]: rn2wx[rn2wx.varNames.modeMapping],
  [rn2wx.varNames.sourceGuardFun]: function (source) {
    // 图片资源的source在运行时难以判定是对象还是字符串，利用运行时更简单
    if (
      Object.prototype.toString.call(source) === '[object Object]' &&
      'uri' in source
    ) {
      return source.uri
    }

    return source
  }
}

export default Taro

initNativeApi(Taro)

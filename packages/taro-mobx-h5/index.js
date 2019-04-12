import { Component } from '@tarojsrn/taro-h5'
import { createElement, Children } from 'nervjs'
import { createProvider, inject as originInject } from '@tarojsrn/mobx-common'

export function inject () {
  return originInject(...arguments, { Component, createElement })
}

export const Provider = createProvider(Component, Children)

export { observer } from '@tarojsrn/mobx-common'

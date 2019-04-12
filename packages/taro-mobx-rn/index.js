import { Component } from '@tarojsrn/taro-rn'
import { Children, createElement } from 'react'
import { createProvider, inject as originInject } from '@tarojsrn/mobx-common'

export function inject () {
  return originInject(...arguments, { Component, createElement })
}

export const Provider = createProvider(Component, Children)

export { observer } from '@tarojsrn/mobx-common'

import { Adapters } from './adapter'

export interface Options {
  isRoot?: boolean,
  isApp: boolean,
  outputPath: string,
  sourcePath: string,
  code: string,
  isTyped: boolean,
  isNormal?: boolean,
  env?: object,
  adapter?: Adapters
  alias?: Object
}

export const transformOptions: Options = {} as any

export const setTransformOptions = (options: Options) => {
  for (const key in options) {
    if (options.hasOwnProperty(key)) {
      transformOptions[key] = options[key]
    }
  }
}

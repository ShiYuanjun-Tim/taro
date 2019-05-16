import {
  internal_safe_get as safeGet,
  internal_safe_set as safeSet
} from '@tarojsrn/taro'
import PropTypes from 'prop-types'
import { componentTrigger } from './create-component'
import { shakeFnFromObject, isEmptyObject, diffObjToPath } from './util'

const isDEV = typeof process === 'undefined' ||
  !process.env ||
  process.env.NODE_ENV !== 'production'

function clone (obj) {
  return JSON.parse(JSON.stringify(obj))
}
const privatePropKeyName = '_triggerObserer'
export function updateComponent (component) {
  const { props, __propTypes } = component
  if (isDEV && __propTypes) {
    const componentName = component.constructor.name || component.constructor.toString().match(/^function\s*([^\s(]+)/)[1]
    PropTypes.checkPropTypes(__propTypes, props, 'prop', componentName)
  }
  const prevProps = component.prevProps || clone(props)
  component.props = prevProps
  if (component.__mounted && component._unsafeCallUpdate === true && component.componentWillReceiveProps) {
    component._disable = true
    component.componentWillReceiveProps(props)
    component._disable = false
  }
  // 在willMount前执行构造函数的副本
  if (!component.__componentWillMountTriggered) {
    component._constructor && component._constructor(props)
  }
  let state = component.getState()

  const prevState = component.prevState || state

  let skip = false
  if (component.__mounted) {
    if (typeof component.shouldComponentUpdate === 'function' &&
      !component._isForceUpdate &&
      component.shouldComponentUpdate(props, state) === false) {
      skip = true
    } else if (typeof component.componentWillUpdate === 'function') {
      component.componentWillUpdate(props, state)
    }
  }
  component.props = props
  component.state = state
  component._dirty = false
  component._isForceUpdate = false
  if (!component.__componentWillMountTriggered) {
    component.__componentWillMountTriggered = true
    componentTrigger(component, 'componentWillMount')
  }
  if (!skip) {
    doUpdate(component, prevProps, prevState)
  }
  component.prevProps = clone(component.props)
  component.prevState = clone(component.state)
}

function doUpdate (component, prevProps, prevState) {
  const { state, props = {} } = component
  let data = state || {}
  if (component._createData) {
    // 返回null或undefined则保持不变
    data = component._createData(state, props) || data
  }

  initListSourceProp(component, data)
  // //GAI:17  每次列表数据变动是否是重置量 初略判定标准是 头尾数据一致
  //   const resetedDsNameSet=new Set()
  //   if(component.__mapped_listSource__ && component.___listSource__) {
  //     component.___listSource__.forEach(config=>{
  //     })
  //   }

  let privatePropKeyVal = component.$scope.data[privatePropKeyName] || false

  data = Object.assign({}, props, data)
  if (component.$usedState && component.$usedState.length) {
    const _data = {}
    component.$usedState.forEach(key => {
      let val = safeGet(data, key)
      if (typeof val === 'undefined') {
        return
      }
      if (typeof val === 'object') {
        if (isEmptyObject(val)) return safeSet(_data, key, val)

        val = shakeFnFromObject(val)
        // 避免筛选完 Fn 后产生了空对象还去渲染
        if (!isEmptyObject(val)) safeSet(_data, key, val)
      } else {
        safeSet(_data, key, val)
      }
    })
    data = _data
  }
  // 改变这个私有的props用来触发(observer)子组件的更新
  data[privatePropKeyName] = !privatePropKeyVal
  const dataDiff = diffObjToPath(data, component.$scope.data)
  const __mounted = component.__mounted

  // 每次 setData 都独立生成一个 callback 数组
  let cbs = []
  if (component._pendingCallbacks && component._pendingCallbacks.length) {
    cbs = component._pendingCallbacks
    component._pendingCallbacks = []
  }

  // GAI:17 dataDiff中如果有dataSource改动，需要把转化后的key对应数据切片跟新，并且原ds数据直接修改不走setData
  if (component.__mapped_listSource__ && component.___listSource__) {
    const opreations = component.___listSource__.reduce((sum, config) => {
      const {name, mapto} = config
      if (mapto) {
        const originDs = dataDiff[name]
        const mappedDs = dataDiff[mapto]
        if (originDs && component.$scope.data[name]) {
          const lastIndex = component.$scope.data[name].length
          if (mappedDs.length > lastIndex) {
            for (let start = lastIndex; start < mappedDs.length; start++) {
              sum.add(`${mapto}[${start}]`, mappedDs[start])
            }
            delete dataDiff[mapto]
          } else {
            console.log('')
          }
          // 可直接操作 component.$scope.data.xx =value 这里的数据只是用于转化成loopArray中数据，不影响UI
          component.$scope.data[name] = originDs
          delete dataDiff[name]
        }
      }

      return sum
    }, {
      updateslice: [],
      sliceCount: 0,

      _temp: {},
      _count: 0,

      _limit: component.__wxBatchCount || 100,
      _updateSlice () {
        if (this._count) {
          this._count = 0
          this.updateslice.push(this._temp)
          this._temp = {}
          this.sliceCount += 1
        }
      },
      add (key, value) {
        this._temp[key] = value
        this._count++
        if (this._count >= this._limit) {
          this._updateSlice()
        }
      }
    })
    opreations._updateSlice()
    opreations.updateslice.forEach((slice, index) => {
      let cb
      if (index === 0) {
        Object.assign(slice, dataDiff)
        //  dataDiff = {} 报错dataDiff只读需要删除所有数据
        for (let k in dataDiff) {
          delete dataDiff[k]
        }
      }
      if (opreations.sliceCount === index - 1) { // 最后一批需要设置回调
        cb = callback
      }
      component.$scope.setData(slice, cb)
    })
  }

  Object.keys(dataDiff).length && component.$scope.setData(dataDiff, callback)

  function callback () {
    if (__mounted) {
      if (component['$$refs'] && component['$$refs'].length > 0) {
        component['$$refs'].forEach(ref => {
          // 只有 component 类型能做判断。因为 querySelector 每次调用都一定返回 nodeRefs，无法得知 dom 类型的挂载状态。
          if (ref.type !== 'component') return

          let target = component.$scope.selectComponent(`#${ref.id}`)
          target = target ? (target.$component || target) : null

          const prevRef = ref.target
          if (target !== prevRef) {
            if (ref.refName) component.refs[ref.refName] = target
            typeof ref.fn === 'function' && ref.fn.call(component, target)
            ref.target = target
          }
        })
      }

      if (typeof component.componentDidUpdate === 'function') {
        component.componentDidUpdate(prevProps, prevState)
      }
    }

    if (cbs.length) {
      let i = cbs.length
      while (--i >= 0) {
        typeof cbs[i] === 'function' && cbs[i].call(component)
      }
    }
  }
}

function initListSourceProp (component, data) {
  // GAI:17 初始化数据用来判定ds对应生成的新的数据源的变量名字
  if (!component.__mapped_listSource__ && component.___listSource__) {
    component.___listSource__.forEach(config => {
      const dsName = config.name
      // 找到dataSource对应的哪个重新loop生成的 属性所在的key名
      const originDs = data[dsName]
      if (originDs && originDs.length > 0) {
        const theMappedLoopKey = Object.keys(data).find(loopKey => {
          const len = data[loopKey] && data[loopKey].length
          return loopKey !== dsName &&
            len === originDs.length &&
            data[dsName][0] === data[loopKey][0].$original &&
            data[dsName][len - 1] === data[loopKey][len - 1].$original
        })
        if (theMappedLoopKey) {
          config.mapto = theMappedLoopKey
          component.__mapped_listSource__ = true
        }
      }
    })
  }
}


/* 各个组件的on* 类型事件，如果在转换wx时需要替换属性
  需要在此注册 替换所需映射

  此处的替换必须在render中被执行

*/
const onPress = {
  'onPress': (shouldCatch) => shouldCatch ? 'catchtap' : 'bindtap'
}

const CompPropNameReplaceRule = {
  ScrollView: {
    onScroll: 'bindscroll'
  },
  Image: {
    onLoad: 'bindload',
    onError: 'binderror'
  },
  Button: onPress,
  Text: onPress,
  View: onPress

}

const COMMON_PROP_MAP = {
  onPress
}

export default function findPropName (
  compName: string,
  propName: string,
  eventShouldBeCatched: boolean = false
) {
  // 如果没有精准定义的组件配置，则使用默认的配置
  const set = CompPropNameReplaceRule[compName] || COMMON_PROP_MAP[propName]
  if (!set) return null
  const trans = set[propName]
  if (!trans) return null
  if (typeof trans === 'function') {
    return trans(eventShouldBeCatched)
  }
  return trans
}

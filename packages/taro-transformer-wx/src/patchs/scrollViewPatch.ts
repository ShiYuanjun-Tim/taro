import * as t from 'babel-types'
import { NodePath } from 'babel-traverse'
import { addStyle2Items, addStyle } from './utils'

const scrollXStylePatch = {
  container: {
    whiteSpace: 'nowrap'
  },
  item: {
    display: 'inline-block'
  }
}

const attrNameMap = {
  onScroll: 'bindscroll', // on* 开头的属性必须在render.ts中处理
  scrollsToTop: 'enable-back-to-top'
}
// GAI:9 scrollView的RN到微信转化
export default function scrollViewTransformer (path: NodePath<t.JSXOpeningElement>) {

  const attrArr: Array<NodePath<t.JSXAttribute>> = path.get('attributes') as any
  /*
  wx横向滚动
  1.设置滚动项display：inline-block;
  2.设置滚动视图容器white-space: nowrap;
  3.滚动项不要用float
  */
  const horizontalPath = attrArr.find(attr => attr.node.name.name === 'horizontal')
  const isHorizontal = !!horizontalPath

  let contentContainerStylePath
  attrArr.forEach(attrPath => {
    const attrName = attrPath.node.name.name
    switch (attrName) {
      case 'contentContainerStyle':
        contentContainerStylePath = attrPath
        break
      case 'style':
        break
        // 只是换名字的属性在这里
      // case 'onScroll': //需要在render.ts中进行替换
      case 'scrollsToTop':
        attrPath.get('name').replaceWith(t.jSXIdentifier(attrNameMap[attrName]))
        break
      // 对独有的wx属性放行
      case 'upper-threshold':
      case 'lower-threshold	':
      case 'bindscrolltolower':
      case 'bindscrolltolower':
        break
      // 不转换的属性一起删除
      // default: attrPath.remove()
    }
  });

  (path as any).unshiftContainer('attributes',
    t.jSXAttribute(t.jSXIdentifier(isHorizontal ? 'scroll-x' : 'scroll-y')))

  if (contentContainerStylePath) {
      // 合并contentContainerStylePath 到 style
    addStyle(path , contentContainerStylePath.get('value.expression').node)
    contentContainerStylePath.remove()
  }

    // 处理水平滚动情况的样式
  if (isHorizontal) {
    addStyle(path , scrollXStylePatch.container)
    addStyle2Items(
      (path.parentPath.get('children') as any).filter(child => child.isJSXElement()),
      scrollXStylePatch.item
    )
  }
}

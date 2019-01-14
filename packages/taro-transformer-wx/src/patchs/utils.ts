import * as t from 'babel-types'
import { NodePath } from 'babel-traverse'

function build (val): t.Literal {
  switch (Object.prototype.toString.call(val)) {
    case '[object String]': return t.stringLiteral(val)
    case '[object Number]': return t.numericLiteral(val)
    case '[object Boolean]': return t.booleanLiteral(val)
    case '[object Undefined]':
    case '[object Null]': return t.nullLiteral()
    default: throw new Error('没有匹配到类型')
  }
}

/* 转化简易对象到 objectExpression*/
export function buildObjectExpression (obj2Trun: object): t.ObjectExpression {

  return t.objectExpression(Object.keys(obj2Trun).map(key => {
    return t.objectProperty(
      t.stringLiteral(key),
      build(obj2Trun[key])
      )
  }))
}

/* style样式辅助 */

export function appendStyle (stylePath: NodePath<t.JSXAttribute>, styleObj: object) {
  const additonalStyobj = buildObjectExpression(styleObj)
  const styExpressoinPath = stylePath.get('value.expression')
  if (styExpressoinPath.isArrayExpression()) {
    (styExpressoinPath as any).pushContainer('elements', additonalStyobj)
  } else {
    const newsStyleNode = t.arrayExpression([styExpressoinPath.node as t.Expression, additonalStyobj])
    styExpressoinPath.replaceWith(newsStyleNode)
  }
}

export function initStyle (path: NodePath<t.JSXOpeningElement>, styleObj: object) {
  const additonalStyobj = buildObjectExpression(styleObj);
  (path as any).pushContainer('attributes',
    t.jSXAttribute(
      t.jSXIdentifier('style'),
      t.jSXExpressionContainer(additonalStyobj)
    )
  )
}

export function addStyle2Items (itemPaths: Array<NodePath<t.JSXElement>>, styleObj: object) {

  itemPaths.forEach(itemPath => {
    const openingElePath = itemPath.get('openingElement') as NodePath<t.JSXOpeningElement>
    const styleAttrPath = openingElePath.get('attributes')
      .find(attrPath => attrPath.get('name').isJSXIdentifier({ name: 'style' })) as NodePath<t.JSXAttribute>

    if (styleAttrPath) {
      appendStyle(styleAttrPath, styleObj)
    } else {
      initStyle(openingElePath, styleObj)
    }
  })

}

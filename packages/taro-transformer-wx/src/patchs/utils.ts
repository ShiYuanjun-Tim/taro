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

/* style样式辅助方法
  add*  有style则append* / 无style则init*
  init*  添加style属性
  append* 追加（头部或尾部）样式
*/

// 添加新样式 可添加头部/尾部(default)
export function appendStyle (stylePath: NodePath<t.JSXAttribute>, styleObj: object, appendToHead?: boolean): void
export function appendStyle (stylePath: NodePath<t.JSXAttribute>, styleObj: t.ObjectExpression, appendToHead: boolean = false): void {
  const additonalStyobj = t.isObjectExpression(styleObj) ? styleObj : buildObjectExpression(styleObj)
  const styExpressoinPath = stylePath.get('value.expression')
  let availablePath
  if (styExpressoinPath.isArrayExpression() || styExpressoinPath.isObjectExpression()) {
    availablePath = styExpressoinPath
  } else if (styExpressoinPath.isCallExpression()) {
    availablePath = styExpressoinPath.get('arguments.0')
  } else {
    throw new Error('unknow typeof style value')
  }
  _appendStyleToArrayOrObject(availablePath , additonalStyobj , appendToHead)
}

export function initStyle (path: NodePath<t.JSXOpeningElement>, styleObj: object): void
export function initStyle (path: NodePath<t.JSXOpeningElement>, styleObj: t.ObjectExpression): void {
  const additonalStyobj = t.isObjectExpression(styleObj) ? styleObj : buildObjectExpression(styleObj);
  (path as any).pushContainer('attributes',
    t.jSXAttribute(
      t.jSXIdentifier('style'),
      t.jSXExpressionContainer(additonalStyobj)
    )
  )
}

export function addStyle2Items (itemPaths: Array<NodePath<t.JSXElement>>, styleObj: object , appendToHead?: boolean): void
export function addStyle2Items (itemPaths: Array<NodePath<t.JSXElement>>, styleObj: t.ObjectExpression , appendToHead: boolean = false): void {
  itemPaths.forEach(itemPath => addStyle(itemPath.get('openingElement') as NodePath<t.JSXOpeningElement> , styleObj , appendToHead))
}

export function addStyle (openingElePath: NodePath<t.JSXOpeningElement>, styleObj: object , appendToHead?: boolean): void
export function addStyle (openingElePath: NodePath<t.JSXOpeningElement>, styleObj: t.ObjectExpression , appendToHead: boolean = false): void {
  const styleAttrPath = openingElePath.get('attributes')
    .find(attrPath => attrPath.get('name').isJSXIdentifier({ name: 'style' })) as NodePath<t.JSXAttribute>
  if (styleAttrPath) {
    appendStyle(styleAttrPath, styleObj, appendToHead)
  } else {
    initStyle(openingElePath, styleObj)
  }
}

function _appendStyleToArrayOrObject (
  path: NodePath<t.ObjectExpression | t.ArrayExpression>,
  additonalStyObjExp: t.ObjectExpression,
  appendToHead: boolean
) {
  if (path.isArrayExpression()) {
    const funname = appendToHead ? 'unshiftContainer' : 'pushContainer';
    (path as any)[funname]('elements', additonalStyObjExp)
  } else if (path.isObjectExpression()) {
    const styleArr = [path.node as t.Expression, additonalStyObjExp]
    const newsStyleNode = t.arrayExpression(appendToHead ? styleArr.reverse() : styleArr)
    path.replaceWith(newsStyleNode)
  } else {
    throw new Error('error typeof path')
  }
}

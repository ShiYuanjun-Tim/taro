import * as t from 'babel-types'
import { NodePath } from 'babel-traverse'
import * as fs from 'fs'
import * as pathM from 'path'

function build (val) {
  switch (Object.prototype.toString.call(val)) {
    case '[object String]': return t.stringLiteral(val)
    case '[object Number]': return t.numericLiteral(val)
    case '[object Boolean]': return t.booleanLiteral(val)
    case '[object Undefined]':
    case '[object Null]': return t.nullLiteral()
    default: throw new Error('没有匹配到类型')
  }
}

function buildObjectExpression (obj2Trun) {

  return t.objectExpression(Object.keys(obj2Trun).map(key => {
    return t.objectProperty(
      t.stringLiteral(key),
      build(obj2Trun[key])
      )
  }))
}

const IMG_MODE_MAPPING = {
  cover: 'aspectFill'
  , contain: 'aspectFit'
  , stretch: 'scaleToFill'
  , repeat: 'scaleToFill'
  , center: 'aspectFit'
}

const objectExpressionOfModeMap = buildObjectExpression(IMG_MODE_MAPPING)
const propNameOfModeMap = 'IMG_MODE_MAPPING'
/**
 *
 * @param path
 * @param sourcePath
 *
 * 需要转化的属性有
 * source => src
 *
 * resizeMode => mode
 *
 */
export default function imageTransformer (path: NodePath<t.JSXOpeningElement>, sourcePath: string) {

  const attrArr: Array<NodePath<t.JSXAttribute>> = path.get('attributes') as any

  attrArr.forEach(attrPath => {
    const attrName = attrPath.node.name.name
    switch (attrName) {
      case 'source': sourceAttr2src(attrPath, sourcePath)
        break
      case 'resizeMode': resizeModeAttr2mode(attrPath)
        break
    }
  })
}

/**
 * GAI:8
 * @param path
 * 转化属性 resizeMode => mode
 * 属性对照表 IMG_MODE_MAPPING
 * repeat和center没有对应的wx属性 分别用stretch 和 contain 替代
 */
export function resizeModeAttr2mode (path: NodePath<t.JSXAttribute>) {
  let valuePath = path.get('value')
  let resizeModeVal = 'stretch'
  let resizeModeValExpression

  if (valuePath.isStringLiteral()) {
    resizeModeVal = valuePath.node.value
  }
  if (valuePath.isJSXExpressionContainer) {
    const expressionPath = valuePath.get('expression')
    if (expressionPath.isMemberExpression() || expressionPath.isIdentifier()) {
      const funcPath = valuePath.getFunctionParent();
      (funcPath.get('body') as any).unshiftContainer(
        'body'
        , t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(propNameOfModeMap),
            objectExpressionOfModeMap)
        ])
      )

      resizeModeValExpression = t.memberExpression(t.identifier(propNameOfModeMap), expressionPath.node, true)
    }
    if (expressionPath.isStringLiteral()) {
      resizeModeVal = expressionPath.node.value
    }
  }

  resizeModeValExpression = resizeModeValExpression
    ? resizeModeValExpression
    : t.stringLiteral(IMG_MODE_MAPPING[resizeModeVal])

  path.replaceWith(t.jSXAttribute(
    t.jSXIdentifier('mode'),
    t.jSXExpressionContainer(resizeModeValExpression)
  ))

}

/**
 * GAI:7
 * @param path
 * @param sourcePath
 *
 * 转化属性 source => src
 */
export function sourceAttr2src (path: NodePath<t.JSXAttribute>, sourcePath: string) {

  const sourceobjPath = path.get('value.expression')
  let srcVal: any;

  if (sourceobjPath.isObjectExpression()) {
    // transfer {{uri:xxx}}
    const uriPropertyPath = sourceobjPath.get('properties')
      .find(property => property.get('key').isIdentifier({ name: 'uri' }))
    srcVal = (uriPropertyPath.node as t.ObjectProperty).value
  } else if (sourceobjPath.isMemberExpression() || sourceobjPath.isIdentifier()) {
    // transfer {a} /  {a.b}
    srcVal = t.memberExpression(sourceobjPath.node, t.identifier('uri'))
  } else if (sourceobjPath.isCallExpression()
    && t.isIdentifier(sourceobjPath.node.callee, { name: 'require' })) {
    // transfer {require('xxxx')}
    srcVal = sourceobjPath.get('arguments.0').node

    // 本地图片base64编码
    const ext = pathM.extname(srcVal.value).substr(1)
    const imgPath = pathM.join(
      pathM.dirname(sourcePath),
      srcVal.value
    )
    const base64img = fs.readFileSync(imgPath).toString('base64')
    srcVal = t.stringLiteral(`data:image/${ext};base64,${base64img}`)
  }

  path.replaceWith(t.jSXAttribute(
    t.jSXIdentifier('src'),
    t.jSXExpressionContainer(srcVal)
  ))
}

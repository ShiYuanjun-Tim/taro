import * as t from 'babel-types'
import { NodePath } from 'babel-traverse'
import * as fs from 'fs'
import * as pathM from 'path'
import { rn2wx } from '@tarojs/taro'

export const varNameOfModeMap = '_modeMapping_' // 这个是在weapp模块导出的变量名

export const varNameOfSourceGuard = '_sourceGuard_'
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

      resizeModeValExpression = t.memberExpression(t.identifier(varNameOfModeMap), expressionPath.node, true)
    }
    if (expressionPath.isStringLiteral()) {
      resizeModeVal = expressionPath.node.value
    }
  }

  const key = rn2wx.varNames.modeMapping
  resizeModeValExpression = resizeModeValExpression
    ? resizeModeValExpression
    : t.stringLiteral(rn2wx[key][resizeModeVal])

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
  let srcVal: any

  if (sourceobjPath.isObjectExpression()) {
    // transfer {{uri:xxx}}
    const uriPropertyPath = sourceobjPath.get('properties')
      .find(property => property.get('key').isIdentifier({ name: 'uri' }))
    srcVal = (uriPropertyPath.node as t.ObjectProperty).value
  } else if (sourceobjPath.isMemberExpression() || sourceobjPath.isIdentifier()) {
    // transfer {a} /  {a.b}
    srcVal = t.callExpression(t.identifier(varNameOfSourceGuard), [sourceobjPath.node])
  } else if (sourceobjPath.isCallExpression()
    && t.isIdentifier(sourceobjPath.node.callee, { name: 'require' })) {
    // transfer {require('xxxx')}
    srcVal = turnRequireLocalImgToBase64Str(sourceobjPath , sourcePath)
  } else if (sourceobjPath.isStringLiteral()) {
  } else {
    console.log('image source is not recognized, please check!')
  }

  path.replaceWith(t.jSXAttribute(
    t.jSXIdentifier('src'),
    t.jSXExpressionContainer(srcVal)
  ))
}

/**
 * 把本地资源require("path/to/img") 转化为base64编码
 * @param requireCallExprPath
 * @param sourcePath
 */
export function turnRequireLocalImgToBase64Str (requireCallExprPath: NodePath<t.CallExpression>, sourcePath: string): t.StringLiteral | null {
  const srcVal = requireCallExprPath.get('arguments.0').node
  if (t.isStringLiteral(srcVal)) {
    // 本地图片base64编码
    const ext = pathM.extname(srcVal.value).substr(1)
    const imgPath = pathM.isAbsolute(srcVal.value) ? srcVal.value : pathM.join(
      pathM.dirname(sourcePath),
      srcVal.value
    )
    const base64img = fs.readFileSync(imgPath).toString('base64')
    return t.stringLiteral(`data:image/${ext};base64,${base64img}`)
  }
  return null
}

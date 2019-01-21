import * as t from 'babel-types'
import { NodePath } from 'babel-traverse'
const template = require('babel-template')
import { findJSXAttrByName , buildJSXAttr } from '../jsx'

const refPatchMap = {
  'ScrollView': scrollViewPatch
}

export default function getRefMethodsPatch (path: NodePath<t.JSXOpeningElement>) {

  const componentName = (path.node.name as t.JSXIdentifier).name

  const patcher = refPatchMap[componentName] || noop

  return patcher(path)
}

function noop () {
  return t.objectExpression()
}

// GAI:11 scrollview的method scrollTo方法的转码实现

function scrollViewPatch (path: NodePath<t.JSXOpeningElement>) {

  const isHorizontal = !!findJSXAttrByName(path.node.attributes, 'horizontal')
  const stateKeyStr = '_sv_state_' + path.scope.generateUid()

  const newAttrValTemp = template(`this.state.KEY || 0`)
  const valExp = newAttrValTemp({
    KEY: t.identifier(stateKeyStr)
    // ,LOCAL_VAR_NAME: t.stringLiteral('_local_' + path.scope.generateUid())
  })

  const newAttrNode = buildJSXAttr(isHorizontal ? 'scroll-left' : 'scroll-top' , (valExp.expression))

  path.node.attributes.push(newAttrNode)

  const buildReuqire = template(`const patch = {
    scrollTo : (v) =>{
      const position = typeof v === 'number' ? v : IS_HORIZONTAL ? v.x : v.y;
      this.setState({KEY: position})
    },
    scrollToEnd : (v) =>{
      this.setState({KEY: 100000})
    }
  }`)

  const exp = buildReuqire({
    IS_HORIZONTAL: t.booleanLiteral(isHorizontal),
    KEY: t.stringLiteral(stateKeyStr)
  })

  return exp.declarations[0].init
}

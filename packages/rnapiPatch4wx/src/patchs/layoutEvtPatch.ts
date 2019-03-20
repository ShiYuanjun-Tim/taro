import * as t from 'babel-types'
import { NodePath } from 'babel-traverse'
const template = require('babel-template')


const M1 = '__enqueLayout$$'
const M2 = '__execLayoutCalcu$$'
const M3 = '__noopRefFun$$'

const P1 = '__layoutEvtQueue$$'

/*
  GAI:18
  扩充方法 __enqueLayout$$ /  __execLayoutCalcu$$

  在 componentDidMount 添加执行点 __execLayoutCalcu$$

*/
export default function patchLayoutEvtHandler(path: NodePath<t.ClassBody>) {

  const methodContainer = path.node.body

  methodContainer.push(generateClassProperty(M1,
    ` (noderef , fn) =>{
      this.${P1} = this.${P1} ||[]
      this.${P1}.push({noderef,fn})
    }`))

  methodContainer.push(generateClassProperty(M2,
    ` () => {
      if(this.${P1}) {
        let candidate = this.${P1}.pop()
        while(candidate) {
          const {noderef , fn} = candidate;
          noderef.boundingClientRect((res)=>{
            const {left ,right ,top ,bottom ,width ,height} = res;
            fn.call(this, { nativeEvent: { layout: { x: left, y: top, width, height } } })
          }).exec();
          candidate = this.${P1}.pop()
        }
      }
      this.${M1}=function(){}
    }`))

  methodContainer.push(generateClassProperty(M3, ` (ref) =>{}`))

  // 找到 componentDidMount 方法添加触发__execLayoutCalcu$$

  const didMountMth = path.get('body').find(method => method.isClassMethod() && method.get('key').isIdentifier({ name: 'componentDidMount' }))

  if (didMountMth) {
    const hook = template(`this.${M2}()`)()
    didMountMth.node.body.body.push(hook.expression)
  } else {
    methodContainer.push(
      generateClassMethod('componentDidMount', [], `this.${M2}();`)
    )
  }

}


function generateClassProperty(methodName: string, body: string) {
  return t.classProperty(t.stringLiteral(methodName), template(body)().expression)
}

function generateClassMethod(methodName: string, params: [], body: string) {
  const bodyStatement = template(`{${body}}`)()
  return t.classMethod('method', t.stringLiteral(methodName), params, bodyStatement)
}


// 利用ref的方法 捕捉ref引用，注册layout事件
export function appendRefAttr(jsx: NodePath<t.JSXOpeningElement>) {

  const layoutAttr = jsx.get('attributes').find(attr => attr.get('name').isJSXIdentifier({ name: 'onLayout' }))
  const handler = layoutAttr.get('value.expression').node
  const exp = template(`(ref)=>{
     this.${M1}(ref ,  LAYOUT_HANDLER)
  }`)({
    LAYOUT_HANDLER: handler
  })
  jsx.node.attributes.push(
    t.jSXAttribute(
      t.jSXIdentifier('ref'),
      t.jSXExpressionContainer(exp.expression)
    )
  )

  layoutAttr.remove()
}

// 修改ref方法，如果是个引用则用匿名键头函数包裹，如果直接是个函数则在函数体添加
export function changeRefAttr(jsx: NodePath<t.JSXOpeningElement>, refAttrPath: NodePath<t.JSXAttribute>) {

  const layoutAttr = jsx.get('attributes').find(attr => attr.get('name').isJSXIdentifier({ name: 'onLayout' }))
  const handler = layoutAttr.get('value.expression').node

  const addHookExp = template(`this.${M1}(ref ,  LAYOUT_HANDLER)`)

  const refVal = refAttrPath.get('value.expression')
  //  如果是个匿名方法
  if (refVal.isArrowFunctionExpression()) {
    const exp = addHookExp({
      LAYOUT_HANDLER: handler,
      ref: refVal.get('params.0').node
    })
    refVal.node.body.body.push(exp.expression)
  } else { //如果是方法引用, 
      const exp = template(`(ref)=>{
        ORIGIN_REFFUN(ref)
        this.${M1}(ref ,  LAYOUT_HANDLER)
    }`)({
      LAYOUT_HANDLER: handler,
      ORIGIN_REFFUN: refVal.node
    })

    refVal.replaceWith( exp.expression)

  }


  layoutAttr.remove()
}
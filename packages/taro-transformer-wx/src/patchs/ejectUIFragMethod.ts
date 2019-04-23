import * as t from 'babel-types'
import { NodePath, Scope, Binding } from 'babel-traverse'
const template = require('babel-template')
const _ = require('lodash')

class DiffRecordSet<T> extends Set<T> {
  constructor (arr= []) {
    super(arr)
  }

  private records = new Map()

  recordAdd (maybeOldEle, newAddedEle) {
    if (this.has(maybeOldEle)) {
      this.delete(maybeOldEle)
      this.records.set(maybeOldEle, newAddedEle)
    }
    this.add(newAddedEle)
  }

  popRecords () {
    const temp = this.records
    this.records = new Map()
    return temp
  }

}

export class Ejector {

  private methodMap = new Map()
  // 收集一个类中的变量重命名后的变量， 基于重命名不会重复的原理进行替换去重,放到state中
  private identifierCollection: DiffRecordSet<string> = new DiffRecordSet()
  private uIFragMethodSet2Delete: Set<NodePath<any>> = new Set()
  private root: NodePath<t.ClassBody>

  constructor (root: NodePath<t.ClassBody>) {
    this.root = root
    this.nestCallExplorer(root)
    this._clear()
  }

  _clear () {

    // clear uIFragMethodQueue
    this.uIFragMethodSet2Delete.forEach(del => {
      this.methodMap.delete(del.node.key.name)
      del.remove()
    })
    this.methodMap.forEach(function(value, key) {
      const { path , statistic } = value
      if (key !== 'render' && key !== 'constructor' && statistic.onlyReturnUI && path) {
        path.remove()
      }
    })

    this.methodMap = null as any

  }

  getIdentifiersShouldInState () {
    return [...this.identifierCollection].map(id => t.identifier(id))
  }

  findMethodByName(methodName) {
    if (this.methodMap.has(methodName)) {
      return this.methodMap.get(methodName)
    }
    const clazElemsPath = this.root.get('body')
    const methodsArr = clazElemsPath.map((clzProPath) => {
      if (clzProPath.isClassMethod()) {
        return [clzProPath.node.key.name, { path: clzProPath, statistic: methodStatistic(clzProPath) }]
      } else if (clzProPath.isClassProperty() && (
        clzProPath.get('value').isFunctionExpression()
        || clzProPath.get('value').isArrowFunctionExpression()
      )
      ) {
        return [clzProPath.node.key.name, { path: clzProPath, statistic: methodStatistic(clzProPath) }]
      }
      return null

    }).filter(ele => ele != null)
    this.methodMap = new Map(methodsArr)

    return this.methodMap.get(methodName)
  }

  nestCallExplorer (toBeExplore: NodePath<t.Node>) {
    toBeExplore.traverse({
      CallExpression: (path: NodePath<t.CallExpression>) => {

        const callee = path.get('callee')

        if (
          callee.isMemberExpression()
          && callee.get('object').isThisExpression()
        ) {
          const methodName = (callee.get('property').node as t.Identifier).name
          const { path: methodPath , statistic } = this.findMethodByName(methodName)

          if (methodPath && statistic.isUIFragMethod()) {
            this.uIFragMethodSet2Delete.add(methodPath)
            // 需要深度优先遍历到最内的方法处理完后在一次处理上层调用
            this.nestCallExplorer(methodPath)
            this.ejectMethod(path, methodPath.isClassMethod() ? methodPath : methodPath.get('value'))
          }
        }
      }
    })

  }

  /*
    替换方法内容体到调用的地方
    1 获取方法参数 重命名
    2 获取调用处使用的变量
    3 将1-2中的内容组成var声明 （如果定义处和调用处参数个数不匹配，需要包含默认参数的赋值声明）
    4  把方法中的其他声明 改名字防止冲突
    5 把方法中的其他声明也提取 接到3中声明之后
    6 就近插入到调用法所在scope
    7 用方法的 return内容替换函数调用
  */
  ejectMethod (callExpPath: NodePath<t.CallExpression>, methodPath: NodePath<t.Function>) {

    // const identifierCollection: Set<string> = new Set()
    const methodParamsPathArr: Array<NodePath<any>> = methodPath.get('params') as any
    const methodReturnPath = assertOneReturn(methodPath)
    // 获取定义处参数的名字
    const newMethodParamNames = methodParamsPathArr.map((param) => {
      return this.varDefinationRenamer(param, callExpPath.scope)
    })

    // 获取调用处传入的参数 组成参数定义
    const params = callExpPath.node.arguments
    let varDeclarations = newMethodParamNames.map((paramDef, index) => {
      const rightexp = params[index]

      if (t.isAssignmentPattern(paramDef)) {
        return template(`const LEFT = RIGHT || DEFAULT`)({
          LEFT: paramDef.left,
          RIGHT: rightexp ? rightexp : t.nullLiteral(),
          DEFAULT: paramDef.right
        })
      }
      if (t.isRestElement(paramDef)) {
        return buildConstVariableDeclaration(paramDef.argument, t.arrayExpression(params.slice(index)))
      }

      return buildConstVariableDeclaration(paramDef, rightexp)
    })

    // 获取原方法中return之前的一些语句
    const methodBody = methodPath.get('body')
    const statementsArr = (methodBody.isBlockStatement() ? methodBody.get('body') as any : [])
      .filter(dec => !dec.isReturnStatement()).map(decpath => {
        if (decpath.isVariableDeclaration()) {
          // 变量换名字
          decpath.get('declarations').forEach(varDeclarator => {
            const oldId = varDeclarator.get('id')

            return this.varDefinationRenamer(oldId, callExpPath.scope)
          })
        } else if (
          !(
            decpath.isSwitchStatement()
            || decpath.isIfStatement()
            || decpath.isExpressionStatement()
            || decpath.isBlockStatement()
            || decpath.isFunctionExpression()
          )
        ) {
          throw new Error('该类型的申明未实现')
        }
        return decpath.node
      })
    // 所有的额外定义都需要添加到 调用法最进的方法定义出
    varDeclarations = varDeclarations.concat(statementsArr)
    const scopePath = callExpPath.scope.path
    // 添加这些变量申明到该调用所属的scope中， 位置最靠近调用方， 防止在申明前就使用变量
    const blockStatementPathWhereFunIsCalled: any = scopePath.isBlockStatement() ? scopePath : scopePath.get('body')
    const insertPosition = blockStatementPathWhereFunIsCalled.node.body.indexOf(callExpPath.getStatementParent().node)
    Array.prototype.splice.apply(
      blockStatementPathWhereFunIsCalled.node.body, [insertPosition, 0].concat(varDeclarations));
    // 重新注册新加的声明到binding中
    (blockStatementPathWhereFunIsCalled.get('body') as any).forEach(mayBeDecl => {
      if (mayBeDecl.isVariableDeclaration()) {
        callExpPath.scope.registerDeclaration(mayBeDecl)
      }
    })

    // 方法return部分替换调用
    callExpPath.replaceWith(_.cloneDeep(methodReturnPath))

  }

  /* 返回新的改名后的左边表达式变量， 用于构成新的变量定义
   包含 identifier   pattern
 */
  varDefinationRenamer (defPath: NodePath<t.LVal>, scope: Scope) {
    if (defPath.isPattern()) {
      this.exploreVarDefInPattern(defPath, scope)
      return _.cloneDeep(defPath.node)
    } else {
      if (defPath.isIdentifier()) {
        const newPname = this._renameIdentifier(defPath, scope)
        return t.identifier(newPname)
      } else if (defPath.isRestElement() || defPath.isRestProperty()) {
        const toRenamePath = defPath.get('argument') as any
        this._renameIdentifier(toRenamePath, scope)
        return _.cloneDeep(defPath.node)
      } else {
        throw new Error('在varDefinationRenamer 方法中 发现未知类型')
      }
    }
  }

  /* 将解构参数的变量重新命名
  collector 用于收集改动过的新变量
*/
  exploreVarDefInPattern (patternPath: NodePath<t.Pattern>, scope: Scope) {
    if (patternPath.isAssignmentPattern()) {
      this._renameIdentifier(patternPath.get('left') as any, scope)
    } else {
      let elepaths: Array<NodePath<any>> = []
      if (patternPath.isArrayPattern()) {
        elepaths = patternPath.get('elements') as any
      } else if (patternPath.isObjectPattern()) {
        elepaths = (patternPath.get('properties') as any).map(ele => {
          if (ele.isObjectProperty()) {
            return ele.get('value')
          }
          return ele
        })
      } else {
        throw new Error('在renamePatternParam 方法中 发现未知类型参数')
      }

      elepaths.forEach(elePath => {
        this.varDefinationRenamer(elePath as NodePath<t.LVal>, scope)
      })
    }

  }

  _renameIdentifier (idPath: NodePath<t.Identifier>, scope: Scope): string {
    const oldparamName = idPath.node.name
    const newParamName = `${oldparamName}${scope.generateUid()}`
    // idPath.scope.rename(oldparamName, newParamName)
    const funcParent = idPath.getFunctionParent()
    try {
      funcParent.scope.rename(oldparamName, newParamName)
    }catch(e){
      debugger
    }
    if (funcParent.isClassMethod() && funcParent.get('key').isIdentifier({ name: 'render' })) {
      this.identifierCollection.recordAdd(oldparamName, newParamName)
    }
    return newParamName
  }

}

/*
GAI:16
*/
export default function ejectUIFragMethod (classBodyPath: NodePath<t.ClassBody>): t.Identifier[] {
  return new Ejector(classBodyPath).getIdentifiersShouldInState()
}

export function methodStatistic (methodPath) {
  let onlyReturnUI = false
  let returnClauseCount = 0
  let jsxCount = 0
  methodPath.traverse({
    ReturnStatement (retPath) {
      const theMethodofReturn = retPath.getFunctionParent()
      // return 必须直接属于是类的方法或者属性
      if (theMethodofReturn === methodPath || theMethodofReturn.parentPath === methodPath) {
        returnClauseCount += 1
        const theReturned = retPath.get('argument')
        if (theReturned.isIdentifier()) {
          onlyReturnUI = ! predictSomeIdentifierType(theReturned, isNotJSXCompatible)
        } else if (!isNotJSXCompatible(theReturned)) {
          onlyReturnUI = true
        }
      }

    },
    ArrowFunctionExpression (arrowfunPath) {// 匹配 class中  prop=()=><JSX>形式的代码
      if (methodPath.isClassProperty()
        && arrowfunPath.node === methodPath.node.value
        && !arrowfunPath.get('body').isBlockStatement()
      ) {
        onlyReturnUI = true
        returnClauseCount += 1
      }
    },
    JSXElement () {
      jsxCount++
    }
  })

  return {
    isUIFragMethod() {
      return this.onlyReturnUI && this.returnClauseCount === 1 && this.jsxCount !== 0
    },
    onlyReturnUI, returnClauseCount, jsxCount
  }
}

function assertOneReturn (methodPath) {
  let count = 0
  let ret

  if (methodPath.isArrowFunctionExpression()) {
    if (methodPath.parentPath.isClassProperty()
      && !methodPath.get('body').isBlockStatement()
    ) {
      count += 1
      ret = methodPath.get('body').node
    }
  }

  methodPath.traverse({
    ReturnStatement (retPath) {
      if (retPath.getFunctionParent() === methodPath) {
        count += 1
        ret = retPath.get('argument').node
      }

    }
  })

  if (count !== 1) {
    throw new Error('only support one return caluse in method')
  }
  return ret
}

function buildConstVariableDeclaration (
  variableExp,
  expresion
) {
  return variableExp ? t.variableDeclaration('const', [
    t.variableDeclarator(variableExp, expresion)
  ]) : t.nullLiteral()
}

function predictSomeIdentifierType (identifierPath: NodePath<t.Identifier>, predictor: (expPath) => boolean): boolean {
  const binding: Binding | undefined = identifierPath.scope.getBinding(identifierPath.node.name)
  const bindingInit = binding && binding.path.get('init')
  let candiate = binding && binding.constantViolations || []

  bindingInit && bindingInit.node && candiate.push(bindingInit) // 未初始化的变量

  return (candiate).some((assign) => {
    if (assign.isAssignmentExpression()) {
      const rightPath = assign.get('right')
      if (rightPath.isIdentifier()) {
        return predictSomeIdentifierType(rightPath, predictor)
      } else {
        return predictor(rightPath)
      }
    } else {
      return predictor(assign)
    }
  })
}

function isNotJSXCompatible (theReturned: NodePath<t.Node>) {
  const isJSXCompatible = theReturned.isJSXElement()
    || theReturned.isNullLiteral()
    || (theReturned.isCallExpression() && theReturned.get('callee.property').isIdentifier({ name: 'map' })) // return [].map() style
  return !isJSXCompatible
}

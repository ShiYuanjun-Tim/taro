import * as t from 'babel-types'
import { NodePath, Scope } from 'babel-traverse'
 // const template = require('@babel/template').default
const _ = require('lodash')

/* GAI:16

*/
export default function ejectUIFragMethod (classBodyPath: NodePath<t.ClassBody>): t.Identifier[] {
  let methodMap = new Map()

  function findMethodByName (methodName) {
    if (methodMap.has(methodName)) {
      return methodMap.get(methodName)
    }
    const clazElemsPath = classBodyPath.get('body')
    const methodPath = clazElemsPath.find(prop => (prop.isClassMethod() || prop.isClassProperty()) && prop.get('key').isIdentifier({ name: methodName }))
    methodMap.set(methodName,methodPath)
    return methodPath
  }

  let identifierCollection: t.Identifier[] = []
  const uIFragMethodQueue2Delete: NodePath<any>[] = []
  classBodyPath.traverse({
    CallExpression (path: NodePath<t.CallExpression>) {

      const callee = path.get('callee')

      if (
        callee.isMemberExpression()
        && callee.get('object').isThisExpression()
      ) {
        const methodName = (callee.get('property').node as t.Identifier).name
        const methodPath = findMethodByName(methodName)
        const renderPath = findMethodByName('render')

        if (methodPath && isUIFragMethod(methodPath)) {
          uIFragMethodQueue2Delete.push(methodPath)
          const varIdentifiersThatNeededInState = ejectMethod(renderPath.scope, path,
            methodPath.isClassMethod() ? methodPath : methodPath.get('value'))

          identifierCollection = identifierCollection.concat(varIdentifiersThatNeededInState)
        }
      }
    }
  })

  methodMap = null as any
  // clear uIFragMethodQueue
  uIFragMethodQueue2Delete.forEach(del => del.remove())
  return identifierCollection
}

/*
  替换方法内容体到调用的地方
  1 获取方法参数 重命名
  2 获取调用处使用的变量
  3 将1-2中的内容组成var声明
  4  把方法中的其他声明 改名字防止冲突
  5 把方法中的其他声明也提取 接到3中声明之后
  6 就近插入到调用法所在scope
  7 用方法的 return内容替换函数调用
*/
function ejectMethod (scope: Scope, callExpPath: NodePath<t.CallExpression>, methodPath: NodePath<t.Function>): t.Identifier[] {

  const identifierCollection: t.Identifier[] = []
  const methodParamsPathArr: Array<NodePath<any>> = methodPath.get('params') as any
  const methodReturnPath = assertOneReturn(methodPath)
  // 获取定义的处参数名字
  const newMethodParamNames = methodParamsPathArr.map((param) => {
    return varDefinationRenamer(param,scope, identifierCollection)
  })

  // 获取调用处传入的参数 组成参数定义
  let varDeclarations = (callExpPath.get('arguments') as any).map((paramVal, index) => {
    return buildConstVariableDeclaration(newMethodParamNames[index] , paramVal.node)
  })
  // 获取原方法中return之前的一些语句
  const methodBody = methodPath.get('body')
  const statementsArr = (methodBody.isBlockStatement() ? methodBody.get('body') as any : [])
    .filter(dec => !dec.isReturnStatement()).map(decpath => {
      if (decpath.isVariableDeclaration()) {
        // 变量换名字
        decpath.get('declarations').forEach(varDeclarator => {
          const oldId = varDeclarator.get('id')

          return varDefinationRenamer(oldId , scope , identifierCollection)
        })
      } else {
        throw new Error('该类型的申明未实现')
      }
      return decpath.node
    })
  // 所有的额外定义都需要添加到 调用法最进的方法定义出
  varDeclarations = varDeclarations.concat(statementsArr)
  // 添加这些变量申明到该调用所属的scope中， 位置最靠近调用方， 防止在申明前就使用变量
  const insertPosition = (callExpPath.scope.block as any).body.body.indexOf(callExpPath.getStatementParent().node)
  Array.prototype.splice.apply((callExpPath.scope.block as any).body.body, [insertPosition, 0].concat(varDeclarations))
  // 方法return部分替换调用
  callExpPath.replaceWith(_.cloneDeep(methodReturnPath))

  return identifierCollection
}

/* 将解构参数的变量重新命名
  collector 用于收集改动过的新变量
*/
function exploreVarDefInPattern (patternPath: NodePath<t.Pattern>, scope: Scope, collector: t.Identifier[]= []) {
  if (patternPath.isAssignmentPattern()) {
    const newPname = _renameIdentifier(patternPath.get('left') as any, scope)
    collector.push(t.identifier(newPname))
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
      varDefinationRenamer(elePath as NodePath<t.LVal>, scope, collector)
    })
  }

}
/* 返回新的改名后的左边表达式变量， 用于构成新的变量定义
  包含 identifier   pattern
*/
function varDefinationRenamer (defPath: NodePath<t.LVal>, scope: Scope, newNameCollector: t.Identifier[] = []) {
  if (defPath.isPattern()) {
    exploreVarDefInPattern(defPath, scope, newNameCollector)
    return _.cloneDeep(defPath.node)
  } else {
    let toRenamePath
    if (defPath.isIdentifier()) {
      toRenamePath = defPath
    } else if (defPath.isRestElement() || defPath.isRestProperty()) {
      toRenamePath = defPath.get('argument')
    } else {
      throw new Error('在varDefinationRenamer 方法中 发现未知类型')
    }

    const newPname = _renameIdentifier(toRenamePath, scope)
    newNameCollector.push(t.identifier(newPname))
    return t.identifier(newPname)
  }
}

function _renameIdentifier (idPath: NodePath<t.Identifier>, scope: Scope): string {
  const oldparamName = idPath.node.name
  const newParamName = `${oldparamName}${scope.generateUid()}`
  idPath.scope.rename(oldparamName, newParamName)
  return newParamName
}

export function isUIFragMethod (methodPath) {
  let onlyReturnUI = false
  let returnClauseCount = 0
  methodPath.traverse({
    ReturnStatement (retPath) {
      const theMethodofReturn = retPath.getFunctionParent()
      // return 所属方法必须是类的方法或者属性
      if (theMethodofReturn === methodPath || theMethodofReturn.parentPath === methodPath) {
        returnClauseCount += 1
        const theReturned = retPath.get('argument')
        const isReturnJSX = theReturned.isJSXElement()
          || theReturned.isNullLiteral()
          || (theReturned.isCallExpression() && theReturned.get('callee.property').isIdentifier({ name: 'map' })) // return [].map() style
        if (!isReturnJSX) {
          onlyReturnUI = false
        } else {
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
    }
  })

  return onlyReturnUI && returnClauseCount === 1
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

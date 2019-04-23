import * as t from 'babel-types'
import { NodePath } from 'babel-traverse'
const template = require('babel-template')

const attrNameMap = {
  onEndReachedThreshold: 'lower-threshold', // on* 开头的属性必须在render.ts中处理
  onEndReached: 'onscrolltolower'
}

const ListViewSourceNamestorage = '___listSource__'

/*
  1 ListView 到ScrollView的改名
  2  属性改名
    onEndReachedThreshold		lower-threshold
    onEndReached 				onscrolltolower
  3 renderRow和dataSource 合并到标签之间
*/
export default function listViewTransformer (path: NodePath<t.JSXOpeningElement>) {

  renameTag(path, 'ScrollView')
  const attrArr: Array<NodePath<t.JSXAttribute>> = path.get('attributes') as any

  let renderRowAttrPath
  let dataSourceAttrPath
  attrArr.forEach(attrPath => {
    const attrName = attrPath.node.name.name
    switch (attrName) {
      case 'onEndReachedThreshold':
      case 'onEndReached':
        attrPath.get('name').replaceWith(t.jSXIdentifier(attrNameMap[attrName]))
        break
      case 'renderRow':
        renderRowAttrPath = attrPath
        break
      case 'dataSource':
        dataSourceAttrPath = attrPath
        break
      // 不转换的属性一起删除
      // default: attrPath.remove()
    }
  })

  ;(path.parentPath.node as any).children.push(
    t.jSXExpressionContainer(mapChildren(renderRowAttrPath, dataSourceAttrPath))
  )
   const name =assertDatasource(dataSourceAttrPath)

  recordlistSourceName(path, name)

  renderRowAttrPath.remove()
  dataSourceAttrPath.remove()
}

/* 重命名到scrollview */
function renameTag (path: NodePath<t.JSXOpeningElement>, newName: string) {
  path.get('name').replaceWith(t.jSXIdentifier(newName))
  const closeElemPath = path.getSibling('closingElement')
  closeElemPath.replaceWith(t.jSXClosingElement(t.jSXIdentifier(newName)))
}

/* 将listview的renderRow属性和datasource属性内容合并成scrollview、中的children元素*/
function mapChildren (renderRowAttrPath: NodePath<t.JSXAttribute>, dataSourceAttrPath: NodePath<t.JSXAttribute>): t.Expression {

  const children = template(`
    SOURCE.map((data,index)=>{
        return ROW(data,'hardcodeSectionId',index)
    })
  `)({
    SOURCE: dataSourceAttrPath.get('value.expression').node,
    ROW: renderRowAttrPath.get('value.expression').node
  })

  return children.expression
}


/* 获取datasource的对应的属性名，并且对格式校验*/
function assertDatasource ( dataSourceAttrPath: NodePath<t.JSXAttribute>): string {
 
  let sourceVal = dataSourceAttrPath.get('value.expression')
  let candidate = [sourceVal]
  if (sourceVal.isCallExpression()) {
    candidate = sourceVal.get('arguments')
  }
  for(let toJudege of candidate) {
    if( toJudege.isMemberExpression()){
      const obj = toJudege.get('object')
      const isThisStateOrPropMember = obj.isMemberExpression()
        && obj.get('object').isThisExpression()
        && (
          obj.get('property').isIdentifier({ name: 'state' }) 
          || obj.get('property').isIdentifier({ name: 'props' })
          )
      if(isThisStateOrPropMember){
        return toJudege.get('property').node.name
      }  
    }
  }
  
  throw new Error('出于性能考虑，强制ListView 的dataSource属性使用this.state/props.xxx形式, 可支持简单形式this.ds.cloneWithxx(this.state/props.xxx形式)')
}


/* 将listview的datasource对应的数据源名字记录下来，记录在类属性 ___listSource__ 上*/
function recordlistSourceName(path: NodePath<t.JSXOpeningElement>, name: string) {

    // 添加属性标明ListView数据元所使用的属性名
    const clzbodyPath = path.find(parent=>parent.isClassBody())
    let clzprop =clzbodyPath.get('body').find(prop=>prop.isClassProperty()&&prop.get('key').isIdentifier({name:ListViewSourceNamestorage}))
    const newConfig = template(`({name:NAME})`)({NAME:t.stringLiteral(name)}).expression
    if(!clzprop){
      clzprop = t.classProperty(t.identifier(ListViewSourceNamestorage) , t.arrayExpression([newConfig]))
      clzbodyPath.node.body.push(clzprop)
    } else {
      // clzprop.get('value.elements').node.push(newConfig)
      clzprop.node.value.elements.push(newConfig)
    }
   
}
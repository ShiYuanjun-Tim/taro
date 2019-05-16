import { NodePath } from 'babel-traverse'
import * as t from 'babel-types'
import * as template from 'babel-template'

// import generate from 'babel-generator'
import {turnRequireLocalImgToBase64Str} from "../patchs/imagePatch"
import listViewTransformer from "../patchs/ListViewPatch"
import patchLayoutEvtHandler , {appendRefAttr , changeRefAttr} from "../patchs/layoutEvtPatch"
declare const exports:any;
declare const module:any;

const RN_MODULE_NAME_REPLACEMENT = '@tarojsrn/rnap4wx'

const conversionMap = {
  // rename and remove
  TouchableWithoutFeedback: renameOfCompReference
  , TouchableHighlight: renameOfCompReference
  , TouchableOpacity: renameOfCompReference
  , TouchableNativeFeedback: renameOfCompReference

  // replacement with another lib with same name
  , Dimensions: importReplacement
  , PixelRatio: importReplacement
  , Platform: importReplacement
  , StyleSheet: importReplacement
  , NativeEventEmitter: importReplacement
  , NativeAppEventEmitter: importReplacement
  , ListView : importReplacement
  , ImageBackground : importReplacement
  , Image : importReplacement
  , NetInfo : importReplacement

}

function remove (/* path: NodePath<t.ImportSpecifier> */) {
  // console.log(`react-native[${path.node.imported.name}] is removed`)
  return
}

function importReplacement (path: NodePath<t.ImportSpecifier>) {
  return path.node
}

const refRenameCompCandidate = new Map<string, string>([
  ['TouchableWithoutFeedback', 'View'],
  ['TouchableHighlight', 'View'],
  ['TouchableOpacity', 'View'],
  ['TouchableNativeFeedback', 'View']
])

function renameOfCompReference (path: NodePath<t.ImportSpecifier>): void {
  // GAI:6  import的rn组件中一部分需要替换掉比如Touchable.* 全部用view替换
  const localImportName = path.node.local.name

  const isRNCompNeedReplace = refRenameCompCandidate.has(localImportName)
  if (isRNCompNeedReplace) {

    const replacement = refRenameCompCandidate.get(localImportName)
    const importBinding = path.scope.getBinding(localImportName)
    importBinding && importBinding.referencePaths.forEach(refsPath => {
      if (refsPath.isJSXIdentifier()) {
        refsPath.replaceWith(t.jSXIdentifier(replacement))
      }
    })

  }
}


exports.default = function() {
  return {
    // pre(a,state){
      
    // },
    // post(state){

    // },
    visitor: {
      // make sure run before the eslint
      Program(programPath, state) {

        // 是否已经给当前类patch 过layout需要的一些方法
        let layoutPatched =false

        programPath.traverse({
          ImportDeclaration: function conversionOfReactNativeImport (path: NodePath<t.ImportDeclaration>) {
            const depName = path.node.source.value
          
            switch(depName) {
    
              case 'react-native' : {
                const imports: Array<NodePath<t.ImportSpecifier>> = path.get('specifiers') as any
                const theReplaceArr = imports.map((impSpec) => {
                  const compName = impSpec.node.imported.name
                  return (conversionMap[compName] || remove)(impSpec)
                }).filter(path => path != null)
            
                if (theReplaceArr.length > 0) {
                  const newImport = t.importDeclaration(theReplaceArr , t.stringLiteral(RN_MODULE_NAME_REPLACEMENT))
                  path.insertBefore(newImport)
                }
                // GAI:2
                path.remove()
                break;
              }
    
              case 'axios': {
                const defaultImport  =path.get('specifiers.0')
                if(defaultImport && defaultImport.isImportDefaultSpecifier()) {
                    throw new Error('please implemnt here')
                }
                break
              }

            }
          },
          CallExpression (path ) {
            const callee = path.get('callee')
           
            if (callee.isIdentifier({ name: 'require' })) {
              const requiredpath = path.get('arguments.0')
              const libName = requiredpath.node.value
    
              switch(libName) {
    
                case 'react-native': {
                  requiredpath.replaceWith(t.stringLiteral(RN_MODULE_NAME_REPLACEMENT))
                  break
                }
    
                case 'axios' : {
                  const varNamePath = path.getSibling('id') || path.getSibling('left')
                  const varName = varNamePath.node.name
                  const toInsert = template(`
                  var _wechatAdapter = require('axios-miniprogram-adapter');
                  ${varName}.default.defaults.adapter = _wechatAdapter;
                  `)()
                  path.getStatementParent().insertAfter(toInsert)
                  break
                }
    
    
                default: {// img require repalce
                  const conf = state.opts;
                  if(conf.filepath) {
                    const base64 = turnRequireLocalImgToBase64Str(path, conf.filepath, conf.alias)
                    if (base64) {
                      path.replaceWith(base64)
                    }
                  }
                }
    
    
              }
            }
          },
          JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
            const { name } = path.node.name as t.JSXIdentifier

            if (name === 'ListView') {
              listViewTransformer(path)
            }
            // if (name === 'ScrollView') {
            //   scrollViewTransformer(path)
            // }



            let hasOnLayoutAttr = false
            let hasRefAttr = false
            let isRefStr =false
            let refAttrPath
            path.traverse({
              JSXAttribute(attrPath: NodePath<t.JSXAttribute>) {

                const attrNamePath = attrPath.get('name')
                if (attrNamePath.isJSXIdentifier({ name: 'onLayout' })) {
                  hasOnLayoutAttr = true
                  const clsbody = path.findParent(p => p.isClassBody())
                  if (clsbody && !layoutPatched) {
                    layoutPatched = true;
                    patchLayoutEvtHandler(clsbody);
                  }
                } else if (attrNamePath.isJSXIdentifier({ name: 'ref' })) {
                  hasRefAttr = true
                  refAttrPath= attrPath
                  // 检测ref是字符串的情况，应该报错 保证其他功能正常
                  const refVal  = attrPath.get('value')
                  if(refVal.isStringLiteral() || refVal.get('expression').isStringLiteral()){
                    isRefStr = true 
                  }
                }

              }
            })

            if(hasOnLayoutAttr && isRefStr) {
              // 有layout事件 并且还存在ref为str的形式
              throw new Error(`文件 ${state.opts.filepath} 中存在【 有layout事件 并且还存在ref为str的形式】，请使用回调式ref` )
            }

            if (hasOnLayoutAttr) {
              if(!hasRefAttr) {
                appendRefAttr(path)
              }else{
                changeRefAttr(path , refAttrPath)
              }
            }
          },

        })
      }
    },
  };
}
module.exports = exports["default"];
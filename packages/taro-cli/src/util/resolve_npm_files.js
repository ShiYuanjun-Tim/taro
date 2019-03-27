const fs = require('fs-extra')
const path = require('path')
const resolvePath = require('resolve')
const wxTransformer = require('@tarojs/transformer-wx')
const babel = require('babel-core')
const traverse = require('babel-traverse').default
const t = require('babel-types')
const generate = require('babel-generator').default
const _ = require('lodash')

const defaultUglifyConfig = require('../config/uglify')

const {
  isNpmPkg,
  promoteRelativePath,
  printLog,
  pocessTypeEnum,
  PROJECT_CONFIG,
  generateEnvList,
  replaceContentConstants,
  REG_TYPESCRIPT,
  BUILD_TYPES,
  REG_STYLE,
  recursiveFindNodeModules,
  resolveScriptPath
} = require('./index')

const CONFIG = require('../config')
const defaultBabelConfig = require('../config/babel')

const npmProcess = require('./npm')

const excludeNpmPkgs = ['ReactPropTypes', 'react-native', '@yqb/rnpack']

const resolvedCache = {}
const copyedFiles = {}

const basedir = process.cwd()
const configDir = path.join(basedir, PROJECT_CONFIG)
const projectConfig = require(configDir)(_.merge)
const pluginsConfig = projectConfig.plugins || {}
const outputDirName = projectConfig.outputRoot || CONFIG.OUTPUT_DIR
const pathAlias = projectConfig.alias || {}
// GAI:13
const skipRemoveRule = projectConfig.ignoredRequire || []

const babelConfig = _.mergeWith(defaultBabelConfig, pluginsConfig.babel, (objValue, srcValue) => {
  if (Array.isArray(objValue)) {
    return Array.from(new Set(srcValue.concat(objValue)))
  }
})

function resolveNpmPkgMainPath (pkgName, isProduction, npmConfig, buildAdapter = BUILD_TYPES.WEAPP, root = basedir) {
  try {
    return resolvePath.sync(pkgName, { basedir: root })
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log(`缺少npm包${pkgName}，开始安装...`)
      const installOptions = {}
      if (pkgName.indexOf(npmProcess.taroPluginPrefix) >= 0) {
        installOptions.dev = true
      }
      npmProcess.installNpmPkg(pkgName, installOptions)
      return resolveNpmPkgMainPath(pkgName, isProduction, npmConfig, buildAdapter, root)
    }
  }
}

function resolveNpmFilesPath (pkgName, isProduction, npmConfig, buildAdapter = BUILD_TYPES.WEAPP, root = basedir, compileInclude = []) {
  if (!resolvedCache[pkgName]) {
    const res = resolveNpmPkgMainPath(pkgName, isProduction, npmConfig, buildAdapter, root)
    resolvedCache[pkgName] = {
      main: res,
      files: []
    }
    resolvedCache[pkgName].files.push(res)
    recursiveRequire(res, resolvedCache[pkgName].files, isProduction, npmConfig, buildAdapter, compileInclude)
  }
  return resolvedCache[pkgName]
}

function parseAst (ast, filePath, files, isProduction, npmConfig, buildAdapter = BUILD_TYPES.WEAPP, compileInclude) {
  const excludeRequire = []
  traverse(ast, {
    IfStatement (astPath) {
      astPath.traverse({
        BinaryExpression (astPath) {
          const node = astPath.node
          const left = node.left
          if (generate(left).code === 'process.env.TARO_ENV' &&
            node.right.value !== buildAdapter) {
            const consequentSibling = astPath.getSibling('consequent')
            consequentSibling.traverse({
              CallExpression (astPath) {
                if (astPath.get('callee').isIdentifier({ name: 'require' })) {
                  const arg = astPath.get('arguments')[0]
                  if (t.isStringLiteral(arg.node)) {
                    excludeRequire.push(arg.node.value)
                  }
                }
              }
            })
          }
        }
      })
    },
    Program: {
      exit (astPath) {
        astPath.traverse({
          CallExpression (astPath) {
            const callee = astPath.get('callee')
            if (callee.node.name === 'require') {
              const args = astPath.get('arguments.0')
              let requirePath = args.node.value

              if (!args.isStringLiteral()) {
                if (args.isTemplateLiteral()) {
                  const result = tryTurnTemplateLiteral(args)
                  if (result.isString) {
                    requirePath = result.value
                  }
                }
              }
              if (!requirePath) {
                console.log('ERROR', `无法解析模块模块请使用字符串常量 ${generate(astPath.node).code}`)
                return
              }

              if (path.isAbsolute(requirePath)) {
                const requireReplacement = path.relative(path.dirname(filePath), requirePath)
                requireReplacement
                args.replaceWith(t.stringLiteral(requireReplacement))
                requirePath = requireReplacement
              }
              const requiredSource = path.resolve(path.dirname(filePath), requirePath)
              if (skipRemoveRule.some(rule => requiredSource.match(rule) !== null)) {
                console.log(`跳过  不解析 ${requiredSource} from ${filePath}`)
                const statementPath = astPath.getStatementParent()
                if (statementPath.isVariableDeclaration()) {
                  statementPath.get('declarations.0.init').replaceWith(t.objectExpression([]))
                } else if (statementPath.isExpressionStatement()) {
                  statementPath.get('expression.right').replaceWith(t.objectExpression([]))
                } else {
                  console.log('ERROR', 'unknown type ')
                }

                return
              }

              if (excludeRequire.indexOf(requirePath) < 0) {
                if (isNpmPkg(requirePath)) {
                  if (excludeNpmPkgs.indexOf(requirePath) < 0) {
                    const res = resolveNpmFilesPath(requirePath, isProduction, npmConfig, buildAdapter, path.dirname(recursiveFindNodeModules(filePath)), compileInclude)
                    let relativeRequirePath = promoteRelativePath(path.relative(filePath, res.main))
                    relativeRequirePath = relativeRequirePath.replace(/node_modules/g, npmConfig.name)
                    if (buildAdapter === BUILD_TYPES.ALIPAY) {
                      relativeRequirePath = relativeRequirePath.replace(/@/g, '_')
                    }
                    args.node.value = relativeRequirePath
                  }
                } else { // GAI:14
                  let realRequirePath = path.resolve(path.dirname(filePath), requirePath)
                  const resolvedFilePath = resolveScriptPath(realRequirePath)
                  if (fs.existsSync(resolvedFilePath)) {
                    realRequirePath = resolvedFilePath

                    const basePart = '/' + path.basename(requirePath)
                    const repalcePosition = resolvedFilePath.lastIndexOf(basePart)
                    if (repalcePosition < 0) {
                      throw new Error('解析required路径有错，请查看代码')
                    }
                    requirePath = requirePath.replace(new RegExp(basePart + '$'), resolvedFilePath.substr(repalcePosition))
                  } else {
                    const msg = `路径解析失败请查看文件${filePath}中引用：${realRequirePath}\n => ${resolvedFilePath}`
                    console.log('ERROR', msg)
                    throw new Error(msg)
                  }

                  /*  路径解析 被上面方法 resolveScriptPath 替换
                   let tempPathWithJS = `${realRequirePath}.js`
                  let tempPathWithIndexJS = `${realRequirePath}${path.sep}index.js`
                  if (fs.existsSync(tempPathWithJS)) {
                    realRequirePath = tempPathWithJS
                    requirePath += '.js'
                  } else if (fs.existsSync(tempPathWithIndexJS)) {
                    realRequirePath = tempPathWithIndexJS
                    requirePath += '/index.js'
                  } */

                  if (files.indexOf(realRequirePath) < 0) {
                    files.push(realRequirePath)
                    recursiveRequire(realRequirePath, files, isProduction, npmConfig, buildAdapter, compileInclude)
                  }
                  args.node.value = requirePath
                }
              }
            }
          }
        })
      }
    }
  })
  return generate(ast).code
}

function tryTurnTemplateLiteral (tlPath) {
  const expressions = tlPath.node.expressions
  const quasis = tlPath.node.quasis
  const expLen = expressions.length
  const qLen = quasis.length
  const allStr = []
  for (let i = 0; i < qLen; i++) {
    allStr.push(quasis[i].value.cooked)
    if (i < expLen) {
      if (!t.isStringLiteral(expressions[i])) {
        return {
          isString: false,
          value: allStr.join(''),
          err: generate(expressions[i]).code
        }
      }
      allStr.push(expressions[i].value)
    }
  }
  return {
    isString: true,
    value: allStr.join('')
  }
}

async function recursiveRequire (filePath, files, isProduction, npmConfig = {}, buildAdapter, compileInclude = []) {
  let fileContent
  try {
    fileContent = fs.readFileSync(filePath).toString()
  } catch (e) {
    console.log('ERROR', '读取文件失败', filePath)
    throw e
  }
  let outputNpmPath
  if (!npmConfig.dir) {
    const cwdRelate2Npm = path.relative(
      filePath.slice(0, filePath.search('node_modules')),
      process.cwd()
    )
    outputNpmPath = filePath.replace('node_modules', path.join(cwdRelate2Npm, outputDirName, npmConfig.name))
    outputNpmPath = outputNpmPath.replace(/node_modules/g, npmConfig.name)
  } else {
    let npmFilePath = filePath.match(/(?=(node_modules)).*/)[0]
    npmFilePath = npmFilePath.replace(/node_modules/g, npmConfig.name)
    outputNpmPath = path.join(path.resolve(configDir, '..', npmConfig.dir), npmFilePath)
  }
  if (buildAdapter === BUILD_TYPES.ALIPAY) {
    outputNpmPath = outputNpmPath.replace(/@/g, '_')
  }
  if (REG_STYLE.test(path.basename(filePath))) {
    return
  }
  fileContent = npmCodeHack(filePath, fileContent, buildAdapter)
  try {
    const constantsReplaceList = Object.assign({
      'process.env.TARO_ENV': buildAdapter
    }, generateEnvList(projectConfig.env || {}),
    replaceContentConstants(projectConfig.defineConstants || {}))
    const transformResult = wxTransformer({
      code: fileContent,
      sourcePath: filePath,
      outputPath: outputNpmPath,
      isNormal: true,
      adapter: buildAdapter,
      isTyped: REG_TYPESCRIPT.test(filePath),
      env: constantsReplaceList,
      alias: pathAlias
    })
    const ast = babel.transformFromAst(transformResult.ast, '', {
      plugins: [
        [require('babel-plugin-transform-define').default, constantsReplaceList]
      ]
    }).ast
    fileContent = parseAst(ast, filePath, files, isProduction, npmConfig, buildAdapter, compileInclude)
  } catch (err) {
    console.log(err)
  }
  if (!copyedFiles[outputNpmPath]) {
    if (compileInclude && compileInclude.length) {
      const filePathArr = filePath.split(path.sep)
      const nodeModulesIndex = filePathArr.indexOf('node_modules')
      const npmPkgName = filePathArr[nodeModulesIndex + 1]
      if (compileInclude.indexOf(npmPkgName) >= 0) {
        const compileScriptRes = await npmProcess.callPlugin('babel', fileContent, filePath, babelConfig)
        fileContent = compileScriptRes.code
      }
    }
    if (isProduction) {
      const uglifyPluginConfig = pluginsConfig.uglify || { enable: true }
      if (uglifyPluginConfig.enable) {
        const uglifyConfig = Object.assign(defaultUglifyConfig, uglifyPluginConfig.config || {})
        const uglifyResult = npmProcess.callPluginSync('uglifyjs', fileContent, outputNpmPath, uglifyConfig)
        if (uglifyResult.error) {
          printLog(pocessTypeEnum.ERROR, '压缩错误', `文件${filePath}`)
          console.log(uglifyResult.error)
        } else {
          fileContent = uglifyResult.code
        }
      }
    }
    fs.ensureDirSync(path.dirname(outputNpmPath))
    fs.writeFileSync(outputNpmPath, fileContent)
    let modifyOutput = outputNpmPath.replace(basedir + path.sep, '')
    modifyOutput = modifyOutput.split(path.sep).join('/')
    printLog(pocessTypeEnum.COPY, 'NPM文件', modifyOutput)
    copyedFiles[outputNpmPath] = true
  }
}

function npmCodeHack (filePath, content, buildAdapter) {
  const basename = path.basename(filePath)
  switch (basename) {
    case 'lodash.js':
    case '_global.js':
    case 'lodash.min.js':
      if (buildAdapter === BUILD_TYPES.ALIPAY || buildAdapter === BUILD_TYPES.SWAN) {
        content = content.replace(/Function\(['"]return this['"]\)\(\)/, '{}')
      } else {
        content = content.replace(/Function\(['"]return this['"]\)\(\)/, 'this')
      }
      break
    case 'mobx.js':
      // 解决支付宝小程序全局window或global不存在的问题
      content = content.replace(
        /typeof window\s{0,}!==\s{0,}['"]undefined['"]\s{0,}\?\s{0,}window\s{0,}:\s{0,}global/,
        'typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {}'
      )
      break
    case '_html.js':
      content = 'module.exports = false;'
      break
    case '_microtask.js':
      content = content.replace('if(Observer)', 'if(false && Observer)')
      // IOS 1.10.2 Promise BUG
      content = content.replace('Promise && Promise.resolve', 'false && Promise && Promise.resolve')
      break
    case '_freeGlobal.js':
      content = content.replace('module.exports = freeGlobal;', 'module.exports = freeGlobal || this || global || {};')
      break
  }
  if (buildAdapter === BUILD_TYPES.ALIPAY && content.replace(/\s\r\n/g, '').length <= 0) {
    content = '// Empty file'
  }
  return content
}

function getResolvedCache () {
  return resolvedCache
}

module.exports = {
  getResolvedCache,
  resolveNpmFilesPath,
  resolveNpmPkgMainPath
}
